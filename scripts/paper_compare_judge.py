"""Lightweight paper-style LLM comparison of LightRAG modes (not a full Ragas eval).

Mirrors the LightRAG paper's LLM-as-judge dimensions:
  - Comprehensiveness
  - Diversity
  - Empowerment
plus a simple overall ranking.

Uses any OpenAI-compatible chat API (DeepSeek, Groq, SiliconFlow, Ollama, …).

Examples:
  

  # Groq
  $env:JUDGE_API_KEY = "gsk_..."
  $env:JUDGE_BASE_URL = "https://api.groq.com/openai/v1"
  $env:JUDGE_MODEL = "llama-3.3-70b-versatile"
  python scripts/paper_compare_judge.py

  # Local Ollama (weaker judge, free)
  $env:JUDGE_API_KEY = "ollama"
  $env:JUDGE_BASE_URL = "http://127.0.0.1:11434/v1"
  $env:JUDGE_MODEL = "llama3.1:8b"
  python scripts/paper_compare_judge.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
COMPARE_PATH = REPO_ROOT / "workspace" / "mode_comparison.json"

# Keep prompts small; global answers can be hundreds of KB of repetition.
MAX_ANSWER_CHARS = 3500

SYSTEM = """You are an impartial evaluator comparing RAG system answers.
You score answers the way the LightRAG paper does (LLM-as-judge), NOT with
retrieval metrics like precision/recall.
Be strict. Prefer concrete, well-grounded answers over long repetitive ones.
Return ONLY valid JSON."""

USER_TEMPLATE = """Question:
{question}

Below are answers from four LightRAG retrieval modes for the SAME question.

{answers_block}

Score EACH mode from 1–10 on:
1. Comprehensiveness — covers important aspects of the question
2. Diversity — varied perspectives / facets, not repetitive fluff
3. Empowerment — helps a reader understand / act on the topic

Also pick an overall winner mode.

Return JSON exactly in this shape:
{{
  "scores": {{
    "naive": {{"comprehensiveness": 0, "diversity": 0, "empowerment": 0}},
    "local": {{"comprehensiveness": 0, "diversity": 0, "empowerment": 0}},
    "global": {{"comprehensiveness": 0, "diversity": 0, "empowerment": 0}},
    "hybrid": {{"comprehensiveness": 0, "diversity": 0, "empowerment": 0}}
  }},
  "winner": "naive|local|global|hybrid",
  "rationale": "2-4 sentences comparing the modes"
}}
"""


def clip(text: str, limit: int = MAX_ANSWER_CHARS) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit] + "\n\n…[truncated for judge]…"


def extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise
        return json.loads(match.group(0))


def main() -> int:
    load_dotenv(REPO_ROOT / ".env")

    base = os.getenv("JUDGE_BASE_URL", "").rstrip("/")
    key = os.getenv("JUDGE_API_KEY", "")
    model = os.getenv("JUDGE_MODEL", "")

    if not base or not model:
        print(
            "Set JUDGE_BASE_URL and JUDGE_MODEL (and JUDGE_API_KEY unless local).\n"
            "See script docstring for DeepSeek / Groq / Ollama examples.",
            file=sys.stderr,
        )
        return 1
    if not key:
        key = "ollama"

    if not COMPARE_PATH.exists():
        print(f"Missing {COMPARE_PATH}", file=sys.stderr)
        return 1

    payload = json.loads(COMPARE_PATH.read_text(encoding="utf-8"))
    question = payload.get("prompt") or ""
    results = payload.get("results") or []
    by_mode = {r.get("mode"): r for r in results if r.get("mode")}

    blocks = []
    for mode in ("naive", "local", "global", "hybrid"):
        row = by_mode.get(mode) or {}
        if row.get("ok") and row.get("response"):
            body = clip(row["response"])
        else:
            body = f"[NO ANSWER — {row.get('error') or 'failed'}]"
        blocks.append(f"### Mode: {mode}\n{body}")

    user = USER_TEMPLATE.format(
        question=question,
        answers_block="\n\n".join(blocks),
    )

    url = f"{base}/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "temperature": 0.0,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
    }

    print(f"Judging via {model} @ {base} …", flush=True)
    resp = requests.post(url, headers=headers, json=body, timeout=180)
    if resp.status_code >= 400:
        print(f"HTTP {resp.status_code}: {resp.text[:500]}", file=sys.stderr)
        return 1

    content = resp.json()["choices"][0]["message"]["content"]
    judged = extract_json(content)

    payload["paper_judge"] = {
        "provider": base,
        "model": model,
        "judged_at": datetime.now(timezone.utc).isoformat(),
        "method": "LightRAG-paper-style LLM comparison (comprehensiveness/diversity/empowerment)",
        "not_a_full_eval": True,
        **judged,
    }
    COMPARE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"winner={judged.get('winner')}")
    print(json.dumps(judged.get("scores"), indent=2))
    print(f"Wrote {COMPARE_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
