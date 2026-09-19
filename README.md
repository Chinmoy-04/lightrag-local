# LightRAG Local

Fully local reproduction of [LightRAG](https://arxiv.org/abs/2410.05779) (arXiv:2410.05779) on native Windows. No cloud APIs — Ollama runs the LLM and embeddings on your GPU, FastAPI bridges the graph store, and a React chat UI lets you compare retrieval modes.

## Stack

| Layer | Choice |
| --- | --- |
| LLM | Ollama `llama3.1:8b` (`num_ctx=8192`) |
| Embeddings | Ollama `nomic-embed-text` (768-d) |
| Graph / KV | NetworkX GraphML under `workspace/` |
| API | FastAPI + `lightrag-hku` |
| UI | Vite + React + Tailwind (amber terminal theme) |

Tuned for ~8GB VRAM (e.g. RTX 5060 Laptop): chunk size 512, single-flight LLM concurrency, `MAX_TOTAL_TOKENS=6000`.

## Prerequisites

- Windows 10/11
- NVIDIA GPU + recent drivers
- [Node.js 20+](https://nodejs.org) LTS
- [Ollama](https://ollama.com) installed and running
- ~20GB free disk (models + PDFs + graph)

## Quick start

### 1. Bootstrap

From an elevated or normal PowerShell in the repo root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup.ps1
```

This installs/reuses Miniconda, creates the `lightrag` conda env, installs PyTorch cu128 + Python deps, pulls Ollama models, and scaffolds the frontend if needed.

### 2. Activate and build the corpus

```powershell
conda activate lightrag
python scripts\fetch_and_parse.py
```

Downloads ~30 recent arXiv papers on retrieval-augmented generation, strips references, sanitizes special tokens, and writes `workspace/corpus.txt`.

### 3. Start the API

```powershell
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 4. Start the UI

```powershell
cd frontend
npm install   # first time only
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite proxies `/api` → the FastAPI server.

### 5. Index the corpus

In the UI (or via curl), hit **Index**. Full ingest of ~30 papers / ~560 chunks typically takes **7–10 hours** overnight on 8GB VRAM with `llama3.1:8b`. Progress appears in the API terminal.

```powershell
curl -X POST http://127.0.0.1:8000/index
```

After indexing, the knowledge graph is at:

`workspace/graph_chunk_entity_relation.graphml`

Open it in [Gephi](https://gephi.org/) or yEd. There is no in-app graph viewer yet.

## Query modes

The chat UI supports LightRAG’s retrieval modes:

| Mode | Behavior |
| --- | --- |
| `naive` | Vector search over chunks only |
| `local` | Entity-neighborhood graph retrieval |
| `global` | Community / high-level graph retrieval |
| `hybrid` | Combines local + global |

Each reply shows the mode badge and measured latency.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Ollama + LightRAG readiness |
| `POST` | `/index` | Ingest `workspace/corpus.txt` into the graph |
| `POST` | `/query` | Body: `{ "query": "...", "mode": "hybrid" }` |

## Project layout

```
├── setup.ps1              # Windows bootstrap
├── requirements.txt
├── backend/main.py        # FastAPI + LightRAG lifespan
├── scripts/
│   ├── fetch_and_parse.py # arXiv → corpus.txt
│   ├── inspect_corpus.py
│   ├── bench_ollama.py
│   └── probe_queries.py
├── frontend/              # React chat UI
└── workspace/             # corpus, PDFs, GraphML (gitignored)
```

## Configuration

Environment variables (optional; defaults match the 8GB profile):

| Variable | Default | Notes |
| --- | --- | --- |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | |
| `LLM_MODEL` | `llama3.1:8b` | Generation + extraction |
| `EXTRACT_LLM_MODEL` | (same as `LLM_MODEL`) | Optional extract-only override; smaller 3B models were slower in practice due to parse recoveries |
| `EMBEDDING_MODEL` | `nomic-embed-text` | |
| `EMBEDDING_DIM` | `768` | |
| `OLLAMA_NUM_CTX` | `8192` | |
| `CHUNK_SIZE` | `512` | |
| `MAX_TOTAL_TOKENS` | `6000` | Must stay below `num_ctx - 2000` |

## Helper scripts

```powershell
conda activate lightrag
python scripts\inspect_corpus.py    # paper count / chunk estimate
python scripts\bench_ollama.py      # raw Ollama throughput
python scripts\probe_queries.py     # sample queries after index
```

## License

Research / local reproduction. LightRAG is from HKUDS (`lightrag-hku`). See upstream licenses for the library and model weights.
