"""
Offline check: the local knowledge-base fallback must not return the same
document twice.

`_retrieve_from_local_knowledge_base` globs `*.txt`, so byte-identical Finder
copies ("melanoma 2.txt") used to be scored and returned alongside their
originals. That inflated the high-quality-document count in
`_evaluate_retrieval_quality`, which feeds the ReAct loop's 0.75 confidence gate.

Run from the repo root:
    PYTHONPATH=backend backend/venv/bin/python tests/test_local_kb_dedupe.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.agents.react_cot_agent import react_cot_agent  # noqa: E402


def test_no_duplicate_content():
    docs = react_cot_agent._retrieve_from_local_knowledge_base(
        "melanoma carcinoma risk", top_k=40
    )
    assert docs, "local knowledge base returned nothing; check app/data/knowledge_base"

    contents = [d["content"] for d in docs]
    assert len(contents) == len(set(contents)), (
        f"duplicate content in local KB results: "
        f"{len(contents)} docs, {len(set(contents))} distinct"
    )

    sources = [d["source"] for d in docs]
    assert len(sources) == len(set(sources)), f"duplicate sources: {sources}"

    print(f"✅ {len(docs)} local KB docs, all distinct: {sources}")


def test_duplicate_file_is_skipped(tmp_copy=True):
    """Drop a copy of an existing KB file and confirm it is not returned twice."""
    kb = Path(__file__).resolve().parent.parent / "backend/app/data/knowledge_base"
    original = kb / "melanoma.txt"
    if not original.exists():
        print("⏭  melanoma.txt missing, skipping recurrence check")
        return

    shadow = kb / "melanoma 99.txt"
    shadow.write_text(original.read_text(encoding="utf-8"), encoding="utf-8")
    try:
        docs = react_cot_agent._retrieve_from_local_knowledge_base(
            "melanoma carcinoma risk", top_k=40
        )
        contents = [d["content"] for d in docs]
        assert len(contents) == len(set(contents)), (
            "a re-introduced duplicate file was returned twice — "
            "the content-hash dedupe is not working"
        )
        print(f"✅ re-introduced duplicate skipped, still {len(docs)} distinct docs")
    finally:
        shadow.unlink()


if __name__ == "__main__":
    test_no_duplicate_content()
    test_duplicate_file_is_skipped()
    print("\nAll local KB dedupe checks passed.")
