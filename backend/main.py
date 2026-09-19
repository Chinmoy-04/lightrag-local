"""FastAPI bridge between LightRAG (Ollama-backed) and the React frontend.

Run:  uvicorn backend.main:app --host 127.0.0.1 --port 8000

Hardware notes (RTX 5060 Laptop, 8GB VRAM):
  * Generation and embedding both run in Ollama; this process never imports torch.
  * num_ctx is 8192 and MAX_TOTAL_TOKENS is 6000 (must stay below num_ctx - 2000).
  * Concurrency is pinned to 1 so two generations never sit in VRAM together.
"""

from __future__ import annotations

import logging
import os
import re
import time
from contextlib import asynccontextmanager
from functools import partial
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from lightrag import LightRAG, QueryParam
from lightrag.llm.ollama import ollama_embed, ollama_model_complete
from lightrag.utils import EmbeddingFunc, setup_logger

# ------------------------------------------------------------------ config
REPO_ROOT = Path(__file__).resolve().parents[1]
WORKING_DIR = REPO_ROOT / "workspace"
CORPUS_PATH = WORKING_DIR / "corpus.txt"

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.1:8b")
EMBED_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
EMBED_DIM = int(os.getenv("EMBEDDING_DIM", "768"))  # nomic-embed-text
NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "8192"))
CHUNK_TOKENS = int(os.getenv("CHUNK_SIZE", "512"))  # conservative for 8GB VRAM
MAX_TOTAL_TOKENS = int(os.getenv("MAX_TOTAL_TOKENS", "6000"))

DOC_DELIMITER_RE = re.compile(r"^=====\s*PAPER:\s*(\S+)\s*=====\s*$", re.MULTILINE)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
setup_logger("lightrag", level="INFO")  # LightRAG's own progress logs
log = logging.getLogger("backend")

rag: LightRAG | None = None


# ------------------------------------------------------------- construction
async def build_rag() -> LightRAG:
    WORKING_DIR.mkdir(parents=True, exist_ok=True)
    log.info("initializing LightRAG in %s", WORKING_DIR)
    log.info(
        "llm=%s embed=%s(dim=%d) num_ctx=%d chunk=%d",
        LLM_MODEL,
        EMBED_MODEL,
        EMBED_DIM,
        NUM_CTX,
        CHUNK_TOKENS,
    )

    instance = LightRAG(
        working_dir=str(WORKING_DIR),
        # --- generation (Ollama) ---
        llm_model_func=ollama_model_complete,
        llm_model_name=LLM_MODEL,
        llm_model_kwargs={
            "host": OLLAMA_HOST,
            "options": {"num_ctx": NUM_CTX, "temperature": 0.0},
            "timeout": int(os.getenv("TIMEOUT", "600")),
        },
        llm_model_max_async=1,  # one generation at a time: 8GB ceiling
        max_parallel_insert=1,  # one document at a time
        summary_max_tokens=600,  # must exceed LightRAG's summary_length_recommended (600)
        # --- embeddings (Ollama). `.func` avoids double EmbeddingFunc wrapping ---
        embedding_func=EmbeddingFunc(
            embedding_dim=EMBED_DIM,
            max_token_size=8192,
            func=partial(
                ollama_embed.func,
                embed_model=EMBED_MODEL,
                host=OLLAMA_HOST,
            ),
        ),
        embedding_batch_num=8,
        embedding_func_max_async=2,
        # --- chunking ---
        chunk_token_size=CHUNK_TOKENS,
        chunk_overlap_token_size=64,
        enable_llm_cache=True,
        enable_llm_cache_for_entity_extract=True,
    )

    await instance.initialize_storages()

    # Fail loudly now rather than mid-index if Ollama or the dim is wrong.
    probe = await instance.embedding_func(["dimension probe"])
    detected = int(probe.shape[1])
    log.info("embedding probe ok: detected dim=%d", detected)
    if detected != EMBED_DIM:
        raise RuntimeError(
            f"embedding dim mismatch: configured {EMBED_DIM}, model returned {detected}. "
            "Fix EMBEDDING_DIM and delete workspace/ vector stores before re-indexing."
        )
    return instance


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag
    rag = await build_rag()
    log.info("LightRAG ready")
    try:
        yield
    finally:
        if rag is not None:
            log.info("finalizing storages")
            await rag.finalize_storages()
            rag = None


app = FastAPI(title="LightRAG Local API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------ schemas
class QueryRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    mode: Literal["naive", "local", "global", "hybrid"] = "hybrid"


class QueryResponse(BaseModel):
    response: str
    latency_seconds: float
    mode: str


class IndexResponse(BaseModel):
    status: str
    documents: int
    characters: int
    latency_seconds: float


def require_rag() -> LightRAG:
    if rag is None:
        raise HTTPException(status_code=503, detail="LightRAG is still initializing")
    return rag


def split_corpus(text: str) -> tuple[list[str], list[str]]:
    """Split corpus.txt on the paper delimiter into (documents, file_paths)."""
    matches = list(DOC_DELIMITER_RE.finditer(text))
    if not matches:
        return [text], ["corpus.txt"]

    docs, paths = [], []
    for i, match in enumerate(matches):
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            docs.append(body)
            paths.append(f"arxiv:{match.group(1)}")
    return docs, paths


# ------------------------------------------------------------------- routes
@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok" if rag is not None else "initializing",
        "llm_model": LLM_MODEL,
        "embedding_model": EMBED_MODEL,
        "corpus_present": CORPUS_PATH.exists(),
    }


@app.post("/index", response_model=IndexResponse)
async def index_corpus() -> IndexResponse:
    """Insert workspace/corpus.txt. Slow on local hardware: watch the logs."""
    instance = require_rag()
    if not CORPUS_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="workspace/corpus.txt not found. Run scripts/fetch_and_parse.py first.",
        )

    text = CORPUS_PATH.read_text(encoding="utf-8")
    docs, paths = split_corpus(text)
    log.info("indexing %d documents, %.1f K chars total", len(docs), len(text) / 1000)
    log.info("graph extraction is LLM-bound and will take a long time on 8GB VRAM")

    started = time.perf_counter()
    try:
        for i, (doc, path) in enumerate(zip(docs, paths), start=1):
            doc_start = time.perf_counter()
            log.info("[%d/%d] inserting %s (%d chars)", i, len(docs), path, len(doc))
            await instance.ainsert(doc, file_paths=path)
            log.info("[%d/%d] done in %.1fs", i, len(docs), time.perf_counter() - doc_start)
    except Exception as exc:  # noqa: BLE001
        log.exception("indexing failed")
        raise HTTPException(status_code=500, detail=f"indexing failed: {exc}") from exc

    elapsed = time.perf_counter() - started
    log.info("indexing complete in %.1fs", elapsed)
    return IndexResponse(
        status="ok",
        documents=len(docs),
        characters=len(text),
        latency_seconds=round(elapsed, 2),
    )


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest) -> QueryResponse:
    instance = require_rag()
    log.info("query mode=%s prompt=%r", req.mode, req.prompt[:120])

    param = QueryParam(
        mode=req.mode,
        top_k=20,  # default 60 is too heavy for an 8k context
        chunk_top_k=5,
        max_entity_tokens=2000,
        max_relation_tokens=2000,
        max_total_tokens=MAX_TOTAL_TOKENS,
        response_type="Multiple Paragraphs",
        enable_rerank=False,  # no local reranker configured
        stream=False,
    )

    started = time.perf_counter()
    try:
        answer = await instance.aquery(req.prompt, param=param)
    except Exception as exc:  # noqa: BLE001
        log.exception("query failed")
        raise HTTPException(status_code=500, detail=f"query failed: {exc}") from exc
    elapsed = time.perf_counter() - started

    if not isinstance(answer, str):
        answer = str(answer)

    log.info("query mode=%s finished in %.2fs (%d chars)", req.mode, elapsed, len(answer))
    return QueryResponse(
        response=answer,
        latency_seconds=round(elapsed, 2),
        mode=req.mode,
    )
