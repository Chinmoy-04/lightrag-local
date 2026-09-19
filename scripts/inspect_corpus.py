"""Report corpus statistics used to size the Phase 3 indexing run.

Usage:  python scripts/inspect_corpus.py
"""

from __future__ import annotations

import re
from pathlib import Path

import tiktoken

REPO_ROOT = Path(__file__).resolve().parents[1]
CORPUS_PATH = REPO_ROOT / "workspace" / "corpus.txt"

DOC_DELIMITER_RE = re.compile(r"^=====\s*PAPER:\s*(\S+)\s*=====\s*$", re.MULTILINE)
CHUNK_TOKENS = 512


def main() -> None:
    text = CORPUS_PATH.read_text(encoding="utf-8")
    matches = list(DOC_DELIMITER_RE.finditer(text))
    encoder = tiktoken.encoding_for_model("gpt-4o-mini")

    print(f"corpus: {CORPUS_PATH}")
    print(f"chars: {len(text):,}")
    print(f"documents: {len(matches)}")

    total_tokens = 0
    rows = []
    for i, match in enumerate(matches):
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        # Match LightRAG's tokenizer, which encodes literal special-token
        # strings as ordinary text instead of raising.
        tokens = len(encoder.encode(body, disallowed_special=()))
        total_tokens += tokens
        rows.append((match.group(1), tokens, tokens // CHUNK_TOKENS + 1))

    print(f"total tokens: {total_tokens:,}")
    print(f"chunks at {CHUNK_TOKENS} tokens: ~{sum(r[2] for r in rows):,}")
    print()
    print(f"{'paper':<16}{'tokens':>10}{'chunks':>9}")
    for arxiv_id, tokens, chunks in rows:
        print(f"{arxiv_id:<16}{tokens:>10,}{chunks:>9}")


if __name__ == "__main__":
    main()
