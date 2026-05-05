"""
Frequently-Bought-Together recommender (M-125).

Pure function. Given a list of order baskets (each a set of product
ids), return the top-N co-occurring products for a target product
ranked by lift (Pᴬᴮ / (Pᴬ × Pᴮ)).

The implementation uses pandas/numpy/scikit-learn-style logic but
without those deps so the service stays lean — install them when the
recommender outgrows in-memory counting.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Iterable, List, Mapping, Sequence


def _normalize(baskets: Iterable[Iterable[str]]) -> List[frozenset]:
    out: List[frozenset] = []
    for b in baskets:
        s = frozenset(p for p in b if p)
        if len(s) >= 2:
            out.append(s)
    return out


def co_occurrence_counts(
    baskets: Iterable[Iterable[str]],
) -> tuple[Counter, dict]:
    """Return (single_count, pair_count) over a list of baskets."""
    singles: Counter = Counter()
    pairs: dict = defaultdict(int)
    for basket in _normalize(baskets):
        items = sorted(basket)
        for item in items:
            singles[item] += 1
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                pairs[(items[i], items[j])] += 1
    return singles, pairs


def recommend_for(
    baskets: Sequence[Iterable[str]],
    target: str,
    top_n: int = 5,
) -> List[Mapping[str, float]]:
    """
    Return up to `top_n` products co-occurring with `target`, ranked
    by lift (descending). Each item is a dict:
      { product_id, support, confidence, lift }
    """
    norm = _normalize(baskets)
    if not norm:
        return []
    singles, pairs = co_occurrence_counts(norm)
    if singles.get(target, 0) == 0:
        return []
    total = float(len(norm))
    p_target = singles[target] / total
    out = []
    for (a, b), count in pairs.items():
        other = b if a == target else a if b == target else None
        if other is None:
            continue
        support = count / total
        confidence = count / singles[target]
        p_other = singles[other] / total
        lift = (support / (p_target * p_other)) if p_target * p_other > 0 else 0.0
        out.append(
            {
                "product_id": other,
                "support": round(support, 6),
                "confidence": round(confidence, 6),
                "lift": round(lift, 6),
            }
        )
    out.sort(key=lambda r: (-r["lift"], -r["confidence"], r["product_id"]))
    return out[:top_n]
