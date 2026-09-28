# LightRAG Local

## Product
Local-first desktop web app for running [LightRAG](https://arxiv.org/abs/2410.05779) against a small arXiv RAG corpus: index papers into a NetworkX graph, chat with naive/local/global/hybrid retrieval, inspect the graph, and compare modes with optional LLM-as-judge scores.

## Audience
Someone reproducing or demoing LightRAG on a Windows laptop (~8GB VRAM). They care about seeing the pipeline work, mode differences, and honest limits, not marketing polish.

## Mode
**Operate.** Task UI: configure mode, ask questions, build/view graph, read compare results.

## Constraints
- Keep the **amber terminal** palette (warm cream / near-black + single amber accent). No purple/indigo AI slop.
- Fully usable offline for index/chat when query is Ollama; DeepSeek optional for query/judge.
- Prefer clarity over decoration. Scanability of status, mode, and answers first.

## Brand commitments
- Product name: **LightRAG Local**
- Paper reference: arXiv:2410.05779
- Visual world: amber terminal (documented in DESIGN.md)
