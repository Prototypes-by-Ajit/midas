"""
Export the trained CNN checkpoint to the ONNX graph the live service runs.

    cd backend && source venv/bin/activate && python scripts/export_cnn_onnx.py

Needs torch + timm + onnx (export-time only). Re-run whenever the .pth changes,
then run test_cnn_model_load.py to confirm parity.
"""

import sys
from pathlib import Path

import torch

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.models.cnn_architecture import OnnxExportWrapper, load_trained_model  # noqa: E402

PTH = BACKEND / "models" / "midas_v1_final_best.pth"
ONNX = BACKEND / "models" / "midas_v1_final_best.onnx"


def main():
    wrapper = OnnxExportWrapper(load_trained_model(PTH)).eval()
    torch.onnx.export(
        wrapper,
        (torch.zeros(1, 3, 224, 224), torch.zeros(1, 16)),
        str(ONNX),
        input_names=["image", "metadata"],
        output_names=["logits", "cams"],
        dynamic_axes={name: {0: "batch"} for name in ("image", "metadata", "logits", "cams")},
        opset_version=17,
        dynamo=False,
    )
    print(f"wrote {ONNX} ({ONNX.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
