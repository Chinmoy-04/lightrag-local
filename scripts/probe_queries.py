"""Compare candidate arXiv queries by result count before committing to one."""

from __future__ import annotations

import arxiv

DATE_RANGE = "submittedDate:[202401010000 TO 202612312359]"

CANDIDATES = {
    "rag_cslg": f'cat:cs.LG AND abs:"retrieval-augmented generation" AND {DATE_RANGE}',
    "rag_any": f'abs:"retrieval-augmented generation" AND {DATE_RANGE}',
    "rag_or_kg": (
        'abs:"retrieval-augmented generation" AND '
        '(abs:"knowledge graph" OR abs:"graph") AND '
        f"{DATE_RANGE}"
    ),
    "graph_rag": f'abs:"graph retrieval" AND {DATE_RANGE}',
}


def main() -> None:
    client = arxiv.Client(page_size=100, delay_seconds=3.0, num_retries=3)
    for name, query in CANDIDATES.items():
        search = arxiv.Search(
            query=query,
            max_results=5,
            sort_by=arxiv.SortCriterion.SubmittedDate,
        )
        results = list(client.results(search))
        print(f"\n--- {name}: {len(results)} sampled")
        print(f"    query: {query}")
        for r in results:
            print(f"    {r.published.date()}  {r.title[:72]}")


if __name__ == "__main__":
    main()
