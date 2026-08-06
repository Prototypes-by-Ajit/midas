"""Self-check for resolve_risk_level. Run: python backend/test_risk_level.py

No framework, no fixtures -- the repo has no test runner. This exists because
the risk tier is a decision, not a display: it picks the clinical advice, goes
into the PDF, and is fed to the report LLM.
"""

from app.models.cnn_architecture import RISK_INDETERMINATE, resolve_risk_level


def dist(**kwargs):
    """Fill the 7 classes, spreading any remainder over the unnamed ones."""
    classes = ["AKIEC", "BCC", "BKL", "DF", "MEL", "NV", "VASC"]
    rest = [c for c in classes if c not in kwargs]
    spare = max(0.0, 1.0 - sum(kwargs.values()))
    out = dict(kwargs)
    for c in rest:
        out[c] = spare / len(rest) if rest else 0.0
    return out


CASES = [
    # (name, predicted, distribution, expected)
    ("decisive nevus stays low",
     "NV", dist(NV=0.93, MEL=0.02, BCC=0.01), "low"),
    ("decisive melanoma stays high",
     "MEL", dist(MEL=0.88, NV=0.05, BKL=0.03), "high"),
    ("low-confidence nevus is not low",
     "NV", dist(NV=0.22, MEL=0.20, BKL=0.19, BCC=0.15), "medium"),
    ("low-confidence melanoma is not high",
     "MEL", dist(MEL=0.18, NV=0.17, BKL=0.17, BCC=0.16), "medium"),
    ("majority nevus with heavy melanoma mass escalates",
     "NV", dist(NV=0.55, MEL=0.30, BCC=0.04, BKL=0.06), "medium"),
    ("no distribution is indeterminate",
     "NV", {}, RISK_INDETERMINATE),
    ("unknown class is indeterminate",
     "XXX", {"XXX": 0.99}, RISK_INDETERMINATE),
    ("flat distribution with no high-risk contender is indeterminate",
     "BKL", dist(BKL=0.30, DF=0.28, VASC=0.26), RISK_INDETERMINATE),
]


def main():
    failures = 0
    for name, predicted, probabilities, expected in CASES:
        got = resolve_risk_level(predicted, probabilities)
        ok = got == expected
        failures += not ok
        print(f"{'PASS' if ok else 'FAIL'}  {name:<48} -> {got}"
              f"{'' if ok else f'  (expected {expected})'}")

    # The invariant the tier exists to protect: never call something low when
    # the alternatives outweigh the prediction.
    for p_top in (0.10, 0.25, 0.40, 0.49):
        got = resolve_risk_level("NV", dist(NV=p_top, MEL=(1 - p_top) / 2))
        if got == "low":
            print(f"FAIL  nevus at {p_top} returned 'low'")
            failures += 1

    print(f"\n{'all passed' if not failures else f'{failures} failed'}")
    return failures


if __name__ == "__main__":
    raise SystemExit(main())
