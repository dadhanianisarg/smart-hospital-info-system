"""
Unit tests for S1, S2, and S3 split protocols.
Asserts zero data leakage and strict topological isolation of cold-start drugs.
"""

import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pytest
import numpy as np
import torch

from ml.src.data.splits import (
    sample_negative_pairs,
    create_s1_transductive_split,
    create_s2_inductive_split,
    create_s3_inductive_split
)


@pytest.fixture
def synthetic_interaction_graph():
    """Create a synthetic connected graph with 100 nodes and 500 edges."""
    rng = np.random.default_rng(42)
    num_nodes = 100
    num_edges = 500
    pos_set = set()
    while len(pos_set) < num_edges:
        u = int(rng.integers(0, num_nodes))
        v = int(rng.integers(0, num_nodes))
        if u != v:
            pos_set.add((min(u, v), max(u, v)))
    return list(pos_set), num_nodes


def test_negative_sampling_disjointness(synthetic_interaction_graph):
    """Assert negatives are strictly non-interacting and contain no self-loops."""
    pos_pairs, num_nodes = synthetic_interaction_graph
    pos_set = set(pos_pairs)

    neg_pairs = sample_negative_pairs(num_nodes, pos_set, num_samples=200, seed=42)
    assert len(neg_pairs) == 200

    for u, v in neg_pairs:
        assert u != v, "Negative pair contains self-loop"
        assert (min(u, v), max(u, v)) not in pos_set, "Negative pair overlaps with ground-truth interaction"


def test_s1_transductive_split_integrity(synthetic_interaction_graph):
    """Test S1 split partitions edges without overlap."""
    pos_pairs, num_nodes = synthetic_interaction_graph
    split = create_s1_transductive_split(pos_pairs, num_nodes, train_ratio=0.8, val_ratio=0.1, seed=42)

    train_edges = set((int(u), int(v)) for u, v in split["train"]["pos_edge"])
    val_edges = set((int(u), int(v)) for u, v in split["val"]["pos_edge"])
    test_edges = set((int(u), int(v)) for u, v in split["test"]["pos_edge"])

    assert len(train_edges.intersection(val_edges)) == 0, "Train and Val edges leak in S1"
    assert len(train_edges.intersection(test_edges)) == 0, "Train and Test edges leak in S1"
    assert len(val_edges.intersection(test_edges)) == 0, "Val and Test edges leak in S1"
    assert len(train_edges) + len(val_edges) + len(test_edges) == len(pos_pairs)


def test_s2_zero_leakage_one_new_drug(synthetic_interaction_graph):
    """
    Assert S2 protocol has zero leakage:
    1. Training graph edges contain ZERO instances of any held-out drug.
    2. Test edges contain exactly ONE held-out drug and ONE seen drug.
    """
    pos_pairs, num_nodes = synthetic_interaction_graph
    split = create_s2_inductive_split(pos_pairs, num_nodes, holdout_ratio=0.15, seed=42)

    held_out = set(split["held_out_nodes"])
    seen = set(split["train_nodes"])
    assert len(held_out.intersection(seen)) == 0, "Node partition overlap in S2"

    train_pos = split["train"]["pos_edge"].numpy()
    test_pos = split["test"]["pos_edge"].numpy()

    # Rule 1: No held-out drug in ANY training edge
    for u, v in train_pos:
        assert u not in held_out, f"Leakage: held-out drug {u} found in training edge"
        assert v not in held_out, f"Leakage: held-out drug {v} found in training edge"
        assert u in seen and v in seen

    # Rule 2: Test edges connect exactly one seen and one held-out drug
    for u, v in test_pos:
        is_u_held = u in held_out
        is_v_held = v in held_out
        assert is_u_held ^ is_v_held, f"S2 test edge ({u}, {v}) must connect exactly 1 seen and 1 held-out drug"


def test_s3_zero_leakage_two_new_drugs(synthetic_interaction_graph):
    """
    Assert S3 protocol has zero leakage:
    1. Training graph edges contain ZERO instances of any held-out drug.
    2. Test edges connect TWO held-out drugs.
    """
    pos_pairs, num_nodes = synthetic_interaction_graph
    split = create_s3_inductive_split(pos_pairs, num_nodes, holdout_ratio=0.20, seed=42)

    held_out = set(split["held_out_nodes"])
    seen = set(split["train_nodes"])

    train_pos = split["train"]["pos_edge"].numpy()
    test_pos = split["test"]["pos_edge"].numpy()

    # Rule 1: Zero held-out drugs in training edges
    for u, v in train_pos:
        assert u not in held_out, f"Leakage: held-out drug {u} found in S3 training edge"
        assert v not in held_out, f"Leakage: held-out drug {v} found in S3 training edge"

    # Rule 2: Test edges connect strictly two held-out drugs
    for u, v in test_pos:
        assert u in held_out and v in held_out, f"S3 test edge ({u}, {v}) must connect two held-out drugs"
