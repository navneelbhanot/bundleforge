"""Pytest suite for the FBT recommender (M-125)."""
from recommender import co_occurrence_counts, recommend_for


def test_empty_returns_empty():
    assert recommend_for([], "anything") == []


def test_single_basket_no_target_returns_empty():
    # target is in the basket but there are no co-occurring products
    # other than itself; recommend_for filters self out.
    out = recommend_for([["a", "b"]], "a")
    assert out
    assert {row["product_id"] for row in out} == {"b"}


def test_co_occurrence_counts_handles_duplicates_within_basket():
    singles, pairs = co_occurrence_counts([["a", "a", "b"]])
    # frozenset normalization de-dups.
    assert singles["a"] == 1
    assert singles["b"] == 1
    assert pairs[("a", "b")] == 1


def test_lift_ranks_strongest_pair_first():
    baskets = [
        ["a", "b"],
        ["a", "b"],
        ["a", "b"],
        ["a", "c"],
        ["c"],
        ["d"],
    ]
    out = recommend_for(baskets, "a", top_n=5)
    # b appears with a 3 of 4 a-baskets; c appears with a 1 of 4.
    ids = [row["product_id"] for row in out]
    assert ids[0] == "b"
    assert "c" in ids


def test_top_n_clamps_results():
    baskets = [["t", chr(ord("a") + i)] for i in range(10)]
    out = recommend_for(baskets, "t", top_n=3)
    assert len(out) == 3


def test_unknown_target_returns_empty():
    baskets = [["a", "b"], ["a", "c"]]
    assert recommend_for(baskets, "ZZZ") == []
