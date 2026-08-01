"""
Offline regression check for CNN weight loading.

Guards the bug where the checkpoint's head (stored as classifier.classifier.*) did not match
the architecture (classifier.*) and was silently dropped by strict=False, leaving the head
randomly initialised. Symptoms were: confidence pinned near 1/7 (chance), predictions
collapsing onto whichever class the random projection favoured, and the diagnosis changing
on every process restart.

Needs only torch + the checkpoint. No backend, no Supabase, no network.

    cd backend && source venv/bin/activate && python test_cnn_model_load.py
"""

import sys
from pathlib import Path

import torch
import torch.nn.functional as F

sys.path.insert(0, str(Path(__file__).parent))

from app.models.cnn_architecture import CLASS_NAMES  # noqa: E402
from app.services.cnn_model_service import CNNModelService  # noqa: E402

CHANCE = 1.0 / len(CLASS_NAMES)  # 7 classes -> 0.143


def _probs(service, images):
    metadata = torch.zeros(len(images), 16, device=service.device)
    with torch.no_grad():
        return F.softmax(service.model(images.to(service.device), metadata), dim=1).cpu()


def main():
    torch.manual_seed(42)
    images = torch.randn(8, 3, 224, 224) * 0.8

    # 1. the load itself must be exact -- this is what strict=True buys us
    service = CNNModelService()
    service.load_model()
    print(f"[1] load_state_dict(strict=True) OK on {service.device}")

    probs = _probs(service, images)
    peak = probs.max(dim=1).values

    # 2. a loaded head is decisive; a random one sits at chance
    assert peak.mean() > 0.25, (
        f"mean peak confidence {peak.mean():.3f} is near chance ({CHANCE:.3f}) -- "
        "the classifier head is probably not loaded"
    )
    print(f"[2] mean peak confidence {peak.mean():.3f} > 0.25 (chance is {CHANCE:.3f})")

    # 3. output must track the input, and must not depend on random init
    assert probs.std(dim=0).max() > 0.01, "predictions do not vary with the input"

    second = CNNModelService()
    second.load_model()
    assert torch.allclose(probs, _probs(second, images), atol=1e-5), (
        "two loads disagree -- weights are being randomly initialised per process"
    )
    print("[3] input-dependent and stable across reloads")

    top = probs[0]
    print("\nsample: " + "  ".join(f"{c}={p:.3f}" for c, p in zip(CLASS_NAMES.values(), top)))
    print("\nPASS")


if __name__ == "__main__":
    main()
