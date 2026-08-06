#!/usr/bin/env python3
"""Extract the deployed CNN checkpoint's recorded evaluation metrics.

One-shot. Run manually after a retrain, commit the output. Not a build step.

    backend/venv/bin/python scripts/extract_model_metrics.py

The point of the artifact is to be the single committed record of what the
deployed model actually scored, so nobody invents a number again. It carries
its own caveats and an explicit exclusion list, because the two numbers most
likely to be cited by mistake are both wrong (see EXCLUDED_SOURCES).
"""

from __future__ import annotations

import hashlib
import inspect
import json
import pathlib
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CHECKPOINT = REPO_ROOT / "backend" / "models" / "midas_v1_final_best.pth"
OUTPUT = REPO_ROOT / "backend" / "models" / "midas_v1_final_best.metrics.json"

# Caveats are not optional garnish — every figure below was measured under
# conditions the deployed service does not reproduce. Asserted non-empty.
CAVEATS = [
    {
        "id": "metadata-branch-zeroed",
        "severity": "critical",
        "text": (
            "MIDASCNNModel fuses an EfficientNet-B0 image encoder with a 16-dim "
            "MetadataEncoder. These figures were measured with the real patient "
            "metadata vector present. Production inference supplies "
            "torch.zeros(1, 16) (backend/app/services/cnn_model_service.py). "
            "These figures therefore do not describe the deployed system, whose "
            "accuracy is unknown and expected to be lower."
        ),
    },
    {
        "id": "selection-split",
        "severity": "critical",
        "text": (
            "Validation split, not a held-out test set. Model selection ran on "
            "this same split (early stopping on balanced_accuracy), so the "
            "figures are optimistically biased."
        ),
    },
    {
        "id": "not-reproducible",
        "severity": "important",
        "text": (
            "No dataset is present in the repo and the split definition is not "
            "recoverable, so these numbers cannot be re-derived from source."
        ),
    },
]

NOT_MEASURED = [
    "per-class precision / recall / F1 (the checkpoint records only aggregate scalars per epoch)",
    "held-out test performance",
    "inference latency",
    "accuracy of the deployed zero-metadata pipeline",
    "training set size",
]

EXCLUDED_SOURCES = [
    {
        "source": "midas.ipynb cell 22 — test accuracy 0.8488, macro-F1 0.7287, n=1481",
        "reason": (
            "Different model. That notebook run's Optuna search space (cell 18) was "
            "[convnext_tiny, swin_v2_t, tf_efficientnetv2_s] and its log reads "
            "'Best trial: backbone: tf_efficientnetv2_s'. The deployed checkpoint is "
            "efficientnet_b0. Do not cite these figures for this model."
        ),
    },
    {
        "source": "midas.ipynb cell 14 — test accuracy 0.72, macro-F1 0.58",
        "reason": "Earlier pre-finetune run of that same non-deployed model. Superseded and not applicable.",
    },
]


def load_checkpoint(path: Path):
    """torch.load the checkpoint, working around how it was pickled.

    Shim lifted from backend/app/services/cnn_model_service.py — the checkpoint
    was written on Windows from a __main__ script, so it pickles WindowsPath
    objects and three config classes that no longer exist under that module.
    Without both patches this raises AttributeError, then NotImplementedError.
    """
    import numpy as np
    import torch

    class MIDASConfig:
        pass

    class HyperparameterSearchConfig:
        pass

    class FinalModelConfig:
        pass

    for cls in (MIDASConfig, HyperparameterSearchConfig, FinalModelConfig):
        cls.__module__ = "__main__"
        setattr(sys.modules["__main__"], cls.__name__, cls)

    pathlib.WindowsPath = pathlib.PureWindowsPath

    if hasattr(torch.serialization, "add_safe_globals"):
        torch.serialization.add_safe_globals([
            np.core.multiarray.scalar,
            np.dtype,
            np.dtypes.Float64DType,
            (pathlib.PureWindowsPath, "pathlib.WindowsPath"),
            (MIDASConfig, "__main__.MIDASConfig"),
            (HyperparameterSearchConfig, "__main__.HyperparameterSearchConfig"),
            (FinalModelConfig, "__main__.FinalModelConfig"),
        ])

    load_params = {"map_location": "cpu"}
    if "weights_only" in inspect.signature(torch.load).parameters:
        load_params["weights_only"] = False
    return torch.load(path, **load_params)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def as_float(value) -> float:
    """numpy scalars round-trip through JSON as strings otherwise."""
    return float(value)


def main() -> int:
    if not CHECKPOINT.exists():
        print(f"checkpoint not found: {CHECKPOINT}", file=sys.stderr)
        return 1

    ckpt = load_checkpoint(CHECKPOINT)
    config = ckpt["config"]
    config = config.__dict__ if hasattr(config, "__dict__") else config
    history = ckpt["training_history"]
    val_metrics = history["val_metrics"]
    best_epoch = int(ckpt["best_epoch"])

    # best_epoch is a 0-based index into val_metrics; if that ever stops being
    # true the recorded scalars would silently describe the wrong epoch.
    if not 0 <= best_epoch < len(val_metrics):
        print(
            f"best_epoch {best_epoch} out of range for {len(val_metrics)} recorded epochs",
            file=sys.stderr,
        )
        return 1
    best = val_metrics[best_epoch]

    selection_metric = config.get("early_stopping_metric", "balanced_accuracy")
    if selection_metric in best and "best_metric" in ckpt:
        recorded, claimed = as_float(best[selection_metric]), as_float(ckpt["best_metric"])
        if abs(recorded - claimed) > 1e-12:
            print(
                f"best_metric {claimed} != val_metrics[{best_epoch}].{selection_metric} {recorded}",
                file=sys.stderr,
            )
            return 1

    class_names = list(config["class_names"])
    assert CAVEATS, "caveats must never be empty"

    artifact = {
        "modelVersion": "midas_v1_final",
        "checkpointFile": CHECKPOINT.name,
        "checkpointSha256": sha256(CHECKPOINT),
        "architecture": (
            f"{ckpt['best_params']['backbone']} + "
            f"{config['num_metadata_features']}-dim metadata MLP, "
            f"{ckpt['best_params'].get('fusion_type', 'unknown')} fusion"
        ),
        "numClasses": int(config["num_classes"]),
        "classNames": class_names,
        "selection": {
            "metric": selection_metric,
            "bestEpochIndex": best_epoch,
            "epochsRecorded": len(val_metrics),
        },
        "validation": {
            "accuracy": as_float(best["accuracy"]),
            "balancedAccuracy": as_float(best["balanced_accuracy"]),
            "auroc": as_float(best["auroc"]),
            "loss": as_float(best["loss"]),
        },
        "provenance": {
            "source": "training_history.val_metrics[best_epoch] in the checkpoint",
            "split": "internal validation (also the model-selection split)",
            "extractedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "extractedBy": "scripts/extract_model_metrics.py",
        },
        "caveats": CAVEATS,
        "notMeasured": NOT_MEASURED,
        "excludedSources": EXCLUDED_SOURCES,
    }

    OUTPUT.write_text(json.dumps(artifact, indent=2) + "\n")
    v = artifact["validation"]
    print(f"wrote {OUTPUT.relative_to(REPO_ROOT)}")
    print(
        f"  {artifact['architecture']}, {artifact['numClasses']} classes, "
        f"epoch {best_epoch}/{len(val_metrics)}"
    )
    print(
        f"  val: accuracy {v['accuracy']:.4f}  balanced {v['balancedAccuracy']:.4f}  "
        f"auroc {v['auroc']:.4f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
