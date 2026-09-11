"""
Offline regression check for CNN weight loading and the ONNX serving path.

Guards the bug where the checkpoint's head (stored as classifier.classifier.*) did not match
the architecture (classifier.*) and was silently dropped by strict=False, leaving the head
randomly initialised. Symptoms were: confidence pinned near 1/7 (chance), predictions
collapsing onto whichever class the random projection favoured, and the diagnosis changing
on every process restart.

Also guards the ONNX graph the live service runs: it must agree with the torch checkpoint
(a stale export after retraining fails here), its preprocessing must match the torchvision
transforms it replaced, and its in-graph Grad-CAM must match autograd Grad-CAM.

Needs torch + the checkpoint + the exported .onnx. No backend, no Supabase, no network.

    cd backend && source venv/bin/activate && python test_cnn_model_load.py
"""

import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
import torchvision.transforms as transforms
from PIL import Image

BACKEND = Path(__file__).parent
sys.path.insert(0, str(BACKEND))

from app.models.cnn_architecture import CLASS_NAMES, load_trained_model  # noqa: E402
from app.services.cnn_model_service import CNNModelService, preprocess  # noqa: E402

CHANCE = 1.0 / len(CLASS_NAMES)  # 7 classes -> 0.143
PTH = BACKEND / "models" / "midas_v1_final_best.pth"
SAMPLES = [BACKEND.parent / "frontend" / "public" / n
           for n in ("melanoma_sample.jpg", "benign_mole_sample.jpg")]


def _probs(model, images):
    with torch.no_grad():
        return F.softmax(model(images, torch.zeros(len(images), 16)), dim=1)


def _autograd_gradcam(model, image, target_class):
    """Reference Grad-CAM with hooks + backward, at the layer the ONNX graph uses."""
    store = {}
    layer = model.image_encoder.backbone.bn2
    h1 = layer.register_forward_hook(lambda m, i, o: store.update(act=o))
    h2 = layer.register_full_backward_hook(lambda m, gi, go: store.update(grad=go[0]))
    model.zero_grad()
    model(image, torch.zeros(1, 16))[0, target_class].backward()
    h1.remove(); h2.remove()
    weights = store["grad"].mean(dim=(2, 3), keepdim=True)
    return F.relu((weights * store["act"]).sum(dim=1))[0].detach().numpy()


def main():
    torch.manual_seed(42)
    images = torch.randn(8, 3, 224, 224) * 0.8

    # 1. the load itself must be exact -- this is what strict=True buys us
    model = load_trained_model(PTH)
    print("[1] load_state_dict(strict=True) OK")

    probs = _probs(model, images)
    peak = probs.max(dim=1).values

    # 2. a loaded head is decisive; a random one sits at chance
    assert peak.mean() > 0.25, (
        f"mean peak confidence {peak.mean():.3f} is near chance ({CHANCE:.3f}) -- "
        "the classifier head is probably not loaded"
    )
    print(f"[2] mean peak confidence {peak.mean():.3f} > 0.25 (chance is {CHANCE:.3f})")

    # 3. output must track the input, and must not depend on random init
    assert probs.std(dim=0).max() > 0.01, "predictions do not vary with the input"
    assert torch.allclose(probs, _probs(load_trained_model(PTH), images), atol=1e-5), (
        "two loads disagree -- weights are being randomly initialised per process"
    )
    print("[3] input-dependent and stable across reloads")

    # 4. numpy preprocessing == the torchvision transforms it replaced
    tv = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    pils = [Image.open(p).convert("RGB") for p in SAMPLES]
    for pil in pils:
        diff = np.abs(preprocess(pil) - tv(pil).unsqueeze(0).numpy()).max()
        assert diff < 1e-5, f"preprocess drifted from torchvision by {diff}"
    print("[4] preprocessing matches torchvision")

    # 5. the ONNX graph the service runs == the torch checkpoint
    service = CNNModelService()
    service.load_model()
    real = torch.from_numpy(np.concatenate([preprocess(p) for p in pils]))
    batch = torch.cat([images, real])
    onnx_logits, onnx_cams = service.session.run(
        None, {"image": batch.numpy(), "metadata": np.zeros((len(batch), 16), np.float32)}
    )
    with torch.no_grad():
        torch_logits = model(batch, torch.zeros(len(batch), 16)).numpy()
    diff = np.abs(onnx_logits - torch_logits).max()
    assert diff < 1e-3, f"ONNX logits differ from torch by {diff} -- re-run scripts/export_cnn_onnx.py"
    assert (onnx_logits.argmax(1) == torch_logits.argmax(1)).all()
    print(f"[5] ONNX matches torch (max |logit diff| {diff:.2e})")

    # 6. in-graph CAM == autograd Grad-CAM (the ONNX map skips the positive 1/(H*W) factor)
    for i in range(len(images), len(batch)):
        c = int(torch_logits[i].argmax())
        ref = _autograd_gradcam(model, batch[i:i + 1], c) * 49
        diff = np.abs(onnx_cams[i, c] - ref).max() / (ref.max() + 1e-8)
        assert diff < 1e-3, f"ONNX CAM differs from autograd Grad-CAM by {diff:.2e} (relative)"
    print("[6] ONNX Grad-CAM matches autograd")

    top = probs[0]
    print("\nsample: " + "  ".join(f"{c}={p:.3f}" for c, p in zip(CLASS_NAMES.values(), top)))
    print("\nPASS")


if __name__ == "__main__":
    main()
