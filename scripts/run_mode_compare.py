"""Run the four LightRAG modes against a live /query API and save mode_comparison.json."""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT = REPO_ROOT / "workspace" / "mode_comparison.json"
API = "http://127.0.0.1:8000/query"
PROMPT = (
    "How do these papers combine knowledge graphs with retrieval-augmented generation?"
)
MODES = ("naive", "local", "global", "hybrid")
# Cloud generation should finish well under this; local global was ~26 min.
TIMEOUT = 600


def main() -> int:
    health = requests.get("http://127.0.0.1:8000/health", timeout=30)
    health.raise_for_status()
    meta = health.json()
    print("health:", meta, flush=True)

    results = []
    for mode in MODES:
        print(f"\n=== {mode} ===", flush=True)
        started = time.perf_counter()
        try:
            resp = requests.post(
                API,
                json={"prompt": PROMPT, "mode": mode},
                timeout=TIMEOUT,
            )
            elapsed = time.perf_counter() - started
            if resp.status_code >= 400:
                results.append(
                    {
                        "mode": mode,
                        "ok": False,
                        "latency_seconds": round(elapsed, 2),
                        "error": f"HTTP {resp.status_code}: {resp.text[:500]}",
                    }
                )
                print("FAIL", resp.status_code, resp.text[:300], flush=True)
                continue
            data = resp.json()
            answer = data.get("response") or ""
            results.append(
                {
                    "mode": mode,
                    "ok": True,
                    "latency_seconds": data.get("latency_seconds", round(elapsed, 2)),
                    "chars": len(answer),
                    "response": answer,
                    "note": f"query LLM={meta.get('llm_model_query')} provider={meta.get('llm_provider')}",
                }
            )
            print(
                f"ok in {results[-1]['latency_seconds']}s, {len(answer)} chars",
                flush=True,
            )
        except Exception as exc:  # noqa: BLE001
            elapsed = time.perf_counter() - started
            results.append(
                {
                    "mode": mode,
                    "ok": False,
                    "latency_seconds": round(elapsed, 2),
                    "wall_seconds": round(elapsed, 2),
                    "error": str(exc),
                }
            )
            print("FAIL", exc, flush=True)

    payload = {
        "prompt": PROMPT,
        "queried_at": datetime.now(timezone.utc).isoformat(),
        "llm": meta,
        "results": results,
    }
    # Preserve prior paper_judge until we re-judge.
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text(encoding="utf-8"))
            if old.get("paper_judge"):
                payload["paper_judge_previous"] = old["paper_judge"]
        except Exception:  # noqa: BLE001
            pass

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT}", flush=True)
    return 0 if all(r.get("ok") for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
