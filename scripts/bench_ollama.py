"""Measure one extraction-sized Ollama call to size the indexing run.

Usage:  python scripts/bench_ollama.py
"""

from __future__ import annotations

import time
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
CORPUS_PATH = REPO_ROOT / "workspace" / "corpus.txt"
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"


def main() -> None:
    text = CORPUS_PATH.read_text(encoding="utf-8")
    chunk = text[2000:4200]  # roughly one 512-token chunk
    prompt = (
        "Extract all entities and relationships from the following text "
        "as a list.\n\n" + chunk
    )

    started = time.perf_counter()
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": "llama3.1:8b",
            "prompt": prompt,
            "stream": False,
            "options": {"num_ctx": 8192, "temperature": 0.0},
        },
        timeout=900,
    )
    response.raise_for_status()
    elapsed = time.perf_counter() - started
    data = response.json()

    eval_count = data.get("eval_count") or 0
    eval_duration = data.get("eval_duration") or 1
    print(f"latency_s: {elapsed:.1f}")
    print(f"prompt_tokens: {data.get('prompt_eval_count')}")
    print(f"output_tokens: {eval_count}")
    print(f"gen_tokens_per_s: {eval_count / (eval_duration / 1e9):.1f}")

    for chunks in (749,):
        hours = chunks * elapsed / 3600
        print(f"est_hours_for_{chunks}_chunks_1_call_each: {hours:.1f}")


if __name__ == "__main__":
    main()
