"""Download recent cs.LG papers from arXiv and build workspace/corpus.txt.

References/Bibliography sections are stripped to conserve the local LLM's
context budget during graph extraction.

Usage:  python scripts/fetch_and_parse.py [--limit 30]
"""

from __future__ import annotations

import argparse
import logging
import re
import time
from pathlib import Path

import arxiv
import pymupdf
import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = REPO_ROOT / "workspace"
PDF_DIR = WORKSPACE / "pdfs"
CORPUS_PATH = WORKSPACE / "corpus.txt"

DOC_DELIMITER = "===== PAPER: {arxiv_id} ====="

# arXiv asks API clients to identify themselves.
USER_AGENT = "lightrag-local/1.0 (research reproduction; contact: local user)"

# Matches a standalone References/Bibliography heading near the tail of a paper.
REFERENCES_RE = re.compile(
    r"^\s*(?:\d+\.?\s*)?(?:references|bibliography|references\s+cited)\s*$",
    re.IGNORECASE | re.MULTILINE,
)

# Papers about LLMs quote literal special-token markers such as <|endoftext|>.
# Left intact they trip tokenizers and muddy the extraction prompts.
SPECIAL_TOKEN_RE = re.compile(r"<\|([a-zA-Z0-9_\-]{1,32})\|>")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("fetch_and_parse")


def short_id(result: arxiv.Result) -> str:
    """'http://arxiv.org/abs/2401.12345v2' -> '2401.12345v2'."""
    return result.entry_id.rsplit("/", 1)[-1]


def search_papers(limit: int) -> list[arxiv.Result]:
    """Newest cs.LG submissions, filtered to 2024-2026."""
    client = arxiv.Client(page_size=100, delay_seconds=3.0, num_retries=5)
    # Over-fetch so the date filter can still yield `limit` papers.
    search = arxiv.Search(
        query="cat:cs.LG AND submittedDate:[202401010000 TO 202612312359]",
        max_results=limit * 3,
        sort_by=arxiv.SortCriterion.SubmittedDate,
        sort_order=arxiv.SortOrder.Descending,
    )

    picked: list[arxiv.Result] = []
    for result in client.results(search):
        year = result.published.year
        if not 2024 <= year <= 2026:
            continue
        picked.append(result)
        log.info(
            "selected [%d/%d] %s (%d) - %s",
            len(picked),
            limit,
            short_id(result),
            year,
            result.title[:70],
        )
        if len(picked) >= limit:
            break
    return picked


def download_pdf(result: arxiv.Result, session: requests.Session) -> Path | None:
    """Fetch via pdf_url; Result.download_pdf was removed in arxiv v4."""
    target = PDF_DIR / f"{short_id(result)}.pdf"
    if target.exists() and target.stat().st_size > 0:
        log.info("cached  %s", target.name)
        return target
    try:
        with session.get(result.pdf_url, timeout=60, stream=True) as response:
            response.raise_for_status()
            with target.open("wb") as handle:
                for chunk in response.iter_content(chunk_size=1 << 16):
                    handle.write(chunk)
        log.info("downloaded %s (%.1f KB)", target.name, target.stat().st_size / 1024)
        time.sleep(1.0)  # be polite to arXiv
        return target
    except Exception as exc:  # noqa: BLE001 - one bad PDF must not kill the run
        log.warning("download failed for %s: %s", short_id(result), exc)
        target.unlink(missing_ok=True)
        return None


def extract_text(pdf_path: Path) -> str:
    with pymupdf.open(pdf_path) as doc:
        pages = [page.get_text("text") for page in doc]
        log.info("parsed  %s (%d pages)", pdf_path.name, len(pages))
    return "\n".join(pages)


def strip_references(text: str) -> str:
    """Cut from the LAST References heading in the final two thirds."""
    matches = list(REFERENCES_RE.finditer(text))
    if not matches:
        return text
    cutoff = len(text) // 3
    tail = [m for m in matches if m.start() > cutoff]
    if not tail:
        return text
    return text[: tail[-1].start()]


def clean(text: str) -> str:
    text = text.replace("\x00", " ")
    text = SPECIAL_TOKEN_RE.sub(r"[\1]", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Drop lines that are just a page number.
    text = "\n".join(
        line for line in text.splitlines() if not re.fullmatch(r"\s*\d{1,4}\s*", line)
    )
    return text.strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=30, help="number of papers")
    args = parser.parse_args()

    PDF_DIR.mkdir(parents=True, exist_ok=True)

    log.info("searching arXiv cs.LG for %d papers (2024-2026)", args.limit)
    results = search_papers(args.limit)
    log.info("search returned %d papers", len(results))

    blocks: list[str] = []
    total_chars = 0

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    for i, result in enumerate(results, start=1):
        log.info("[%d/%d] processing %s", i, len(results), short_id(result))
        pdf_path = download_pdf(result, session)
        if pdf_path is None:
            continue
        try:
            raw = extract_text(pdf_path)
        except Exception as exc:  # noqa: BLE001
            log.warning("parse failed for %s: %s", pdf_path.name, exc)
            continue

        body = clean(strip_references(raw))
        if len(body) < 2000:
            log.warning(
                "skipping %s: only %d chars after cleaning", short_id(result), len(body)
            )
            continue

        removed = len(raw) - len(body)
        log.info(
            "cleaned %s: %d chars kept, %d stripped", short_id(result), len(body), removed
        )

        header = DOC_DELIMITER.format(arxiv_id=short_id(result))
        blocks.append(
            f"{header}\nTITLE: {result.title.strip()}\n"
            f"CATEGORIES: {', '.join(result.categories)}\n"
            f"PUBLISHED: {result.published.date().isoformat()}\n\n{body}\n"
        )
        total_chars += len(body)

    if not blocks:
        raise SystemExit("no papers processed; nothing written")

    CORPUS_PATH.write_text("\n\n".join(blocks), encoding="utf-8")
    log.info(
        "wrote %s: %d papers, %.1f K chars (~%.0f K tokens)",
        CORPUS_PATH,
        len(blocks),
        total_chars / 1000,
        total_chars / 4000,
    )


if __name__ == "__main__":
    main()
