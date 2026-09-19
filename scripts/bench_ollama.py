"""Compare Ollama models on one extraction-sized call each.

Usage:  python scripts/bench_ollama.py [--models llama3.1:8b,llama3.2:3b]
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
CORPUS_PATH = REPO_ROOT / "workspace" / "corpus.txt"
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
NUM_CHUNKS = 561  # from scripts/inspect_corpus.py on the current corpus


def bench_one(model: str, prompt: str) -> dict:
    started = time.perf_counter()
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": model,
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
    return {
        "model": model,
        "latency_s": elapsed,
        "prompt_tokens": data.get("prompt_eval_count"),
        "output_tokens": eval_count,
        "gen_tokens_per_s": eval_count / (eval_duration / 1e9),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--models", default="llama3.1:8b,llama3.2:3b", help="comma-separated model tags"
    )
    args = parser.parse_args()
    models = [m.strip() for m in args.models.split(",") if m.strip()]

    text = CORPUS_PATH.read_text(encoding="utf-8")
    chunk = text[2000:4200]  # roughly one 512-token chunk
    prompt = (
        "Extract all entities and relationships from the following text "
        "as a list.\n\n" + chunk
    )

    results = []
    for model in models:
        # Warm-up call: first call per model pays Ollama's cold-load cost,
        # which would otherwise swamp the real per-chunk latency.
        bench_one(model, prompt[:500])
        result = bench_one(model, prompt)
        results.append(result)
        print(
            f"{model:<16} latency_s={result['latency_s']:.1f}  "
            f"out_tokens={result['output_tokens']}  "
            f"gen_tok_s={result['gen_tokens_per_s']:.1f}  "
            f"est_hours_for_{NUM_CHUNKS}_chunks={NUM_CHUNKS * result['latency_s'] / 3600:.1f}"
        )

    if len(results) == 2:
        speedup = results[0]["latency_s"] / results[1]["latency_s"]
        print(f"\nspeedup ({results[1]['model']} vs {results[0]['model']}): {speedup:.1f}x")


if __name__ == "__main__":
    main()
