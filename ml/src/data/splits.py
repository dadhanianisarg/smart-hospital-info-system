"""
Split protocols and negative sampling for drug-drug interaction benchmarks.
Implements:
1. S1 (Transductive): Random 80/10/10 edge split over known pairs.
2. S2 (Inductive - One New Drug): 10% held-out test drugs. Test pairs contain exactly
   one held-out drug and one training drug. All held-out drug edges are absent from training.
3. S3 (Inductive - Two New Drugs): Test pairs connect two held-out drugs. Neither drug
   appears in any training edge.
4. Uniform negative pair sampling under the open-world assumption.
"""

from typing import Dict, List, Set, Tuple
import numpy as np
import torch


def sample_negative_pairs(
    num_nodes: int,
    positive_pairs: Set[Tuple[int, int]],
    num_samples: int,
    seed: int = 42
) -> List[Tuple[int, int]]:
    """
    Sample negative (non-interacting) drug pairs uniformly at random.
    Under the open-world assumption, unobserved pairs are assumed non-interacting
    for benchmark modeling, but do not imply verified biological safety.
    """
    rng = np.random.default_rng(seed)
    negatives = set()
    max_attempts = num_samples * 20
    attempts = 0

    while len(negatives) < num_samples and attempts < max_attempts:
        batch_size = (num_samples - len(negatives)) * 2
        u = rng.integers(0, num_nodes, size=batch_size)
        v = rng.integers(0, num_nodes, size=batch_size)
        attempts += batch_size

        for a, b in zip(u, v):
            if a == b:
                continue
            pair = (min(a, b), max(a, b))
            if pair not in positive_pairs and pair not in negatives:
                negatives.add(pair)
                if len(negatives) >= num_samples:
                    break

    return list(negatives)


def create_s1_transductive_split(
    positive_pairs: List[Tuple[int, int]],
    num_nodes: int,
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
    seed: int = 42
) -> Dict[str, Dict[str, torch.Tensor]]:
    """
    S1 Split Protocol: Random transductive split across interaction pairs.
    All drugs are present in the training graph.
    """
    rng = np.random.default_rng(seed)
    pos_array = np.array(positive_pairs)
    n_total = len(pos_array)
    indices = rng.permutation(n_total)

    n_train = int(train_ratio * n_total)
    n_val = int(val_ratio * n_total)

    train_pos = pos_array[indices[:n_train]]
    val_pos = pos_array[indices[n_train:n_train + n_val]]
    test_pos = pos_array[indices[n_train + n_val:]]

    all_pos_set = set((min(a, b), max(a, b)) for a, b in positive_pairs)

    # Sample negatives
    train_neg = np.array(sample_negative_pairs(num_nodes, all_pos_set, len(train_pos), seed=seed))
    val_neg = np.array(sample_negative_pairs(num_nodes, all_pos_set, len(val_pos), seed=seed + 100))
    test_neg = np.array(sample_negative_pairs(num_nodes, all_pos_set, len(test_pos), seed=seed + 200))

    return {
        "train": {
            "pos_edge": torch.tensor(train_pos, dtype=torch.long),
            "neg_edge": torch.tensor(train_neg, dtype=torch.long),
        },
        "val": {
            "pos_edge": torch.tensor(val_pos, dtype=torch.long),
            "neg_edge": torch.tensor(val_neg, dtype=torch.long),
        },
        "test": {
            "pos_edge": torch.tensor(test_pos, dtype=torch.long),
            "neg_edge": torch.tensor(test_neg, dtype=torch.long),
        },
        "train_nodes": list(range(num_nodes)),
        "held_out_nodes": []
    }


def create_s2_inductive_split(
    positive_pairs: List[Tuple[int, int]],
    num_nodes: int,
    holdout_ratio: float = 0.15,
    seed: int = 42
) -> Dict[str, Dict[str, torch.Tensor]]:
    """
    S2 Split Protocol (One Unseen Drug):
    A subset of drugs is held out. Test pairs consist strictly of (seen_drug, unseen_drug).
    Crucial: Training graph edges contain ZERO instances of any held-out drug.
    """
    rng = np.random.default_rng(seed)
    perm_nodes = rng.permutation(num_nodes)
    n_holdout = int(holdout_ratio * num_nodes)
    held_out_nodes = set(perm_nodes[:n_holdout])
    seen_nodes = set(perm_nodes[n_holdout:])

    all_pos_set = set((min(a, b), max(a, b)) for a, b in positive_pairs)

    train_pos = []
    test_pos = []
    val_pos = []

    for a, b in positive_pairs:
        a_held = a in held_out_nodes
        b_held = b in held_out_nodes

        if not a_held and not b_held:
            # Both seen -> training pool
            train_pos.append((a, b))
        elif a_held ^ b_held:
            # Exactly one held-out drug -> evaluate inductive 1-unseen capability
            if rng.random() < 0.2:
                val_pos.append((a, b))
            else:
                test_pos.append((a, b))

    train_pos = np.array(train_pos)
    val_pos = np.array(val_pos)
    test_pos = np.array(test_pos)

    # Negative sampling tailored for S2: seen with unseen drug
    def sample_s2_negatives(count: int, seed_offset: int) -> np.ndarray:
        s_rng = np.random.default_rng(seed + seed_offset)
        seen_list = list(seen_nodes)
        held_list = list(held_out_nodes)
        negs = set()
        while len(negs) < count:
            s = seen_list[s_rng.integers(0, len(seen_list))]
            h = held_list[s_rng.integers(0, len(held_list))]
            pair = (min(s, h), max(s, h))
            if pair not in all_pos_set and pair not in negs:
                negs.add(pair)
        return np.array(list(negs))

    train_neg = np.array(sample_negative_pairs(num_nodes, all_pos_set, len(train_pos), seed=seed))
    val_neg = sample_s2_negatives(len(val_pos), seed_offset=101)
    test_neg = sample_s2_negatives(len(test_pos), seed_offset=201)

    return {
        "train": {
            "pos_edge": torch.tensor(train_pos, dtype=torch.long),
            "neg_edge": torch.tensor(train_neg, dtype=torch.long),
        },
        "val": {
            "pos_edge": torch.tensor(val_pos, dtype=torch.long),
            "neg_edge": torch.tensor(val_neg, dtype=torch.long),
        },
        "test": {
            "pos_edge": torch.tensor(test_pos, dtype=torch.long),
            "neg_edge": torch.tensor(test_neg, dtype=torch.long),
        },
        "train_nodes": list(seen_nodes),
        "held_out_nodes": list(held_out_nodes)
    }


def create_s3_inductive_split(
    positive_pairs: List[Tuple[int, int]],
    num_nodes: int,
    holdout_ratio: float = 0.20,
    seed: int = 42
) -> Dict[str, Dict[str, torch.Tensor]]:
    """
    S3 Split Protocol (Two Unseen Drugs):
    Test pairs connect two held-out drugs (held_out_drug, held_out_drug).
    Neither drug appears anywhere in the training graph.
    """
    rng = np.random.default_rng(seed)
    perm_nodes = rng.permutation(num_nodes)
    n_holdout = int(holdout_ratio * num_nodes)
    held_out_nodes = set(perm_nodes[:n_holdout])
    seen_nodes = set(perm_nodes[n_holdout:])

    all_pos_set = set((min(a, b), max(a, b)) for a, b in positive_pairs)

    train_pos = []
    test_pos = []
    val_pos = []

    for a, b in positive_pairs:
        a_held = a in held_out_nodes
        b_held = b in held_out_nodes

        if not a_held and not b_held:
            train_pos.append((a, b))
        elif a_held and b_held:
            if rng.random() < 0.2:
                val_pos.append((a, b))
            else:
                test_pos.append((a, b))

    train_pos = np.array(train_pos)
    val_pos = np.array(val_pos)
    test_pos = np.array(test_pos)

    def sample_s3_negatives(count: int, seed_offset: int) -> np.ndarray:
        s_rng = np.random.default_rng(seed + seed_offset)
        held_list = list(held_out_nodes)
        negs = set()
        while len(negs) < count:
            h1 = held_list[s_rng.integers(0, len(held_list))]
            h2 = held_list[s_rng.integers(0, len(held_list))]
            if h1 == h2:
                continue
            pair = (min(h1, h2), max(h1, h2))
            if pair not in all_pos_set and pair not in negs:
                negs.add(pair)
        return np.array(list(negs))

    train_neg = np.array(sample_negative_pairs(num_nodes, all_pos_set, len(train_pos), seed=seed))
    val_neg = sample_s3_negatives(len(val_pos), seed_offset=102)
    test_neg = sample_s3_negatives(len(test_pos), seed_offset=202)

    return {
        "train": {
            "pos_edge": torch.tensor(train_pos, dtype=torch.long),
            "neg_edge": torch.tensor(train_neg, dtype=torch.long),
        },
        "val": {
            "pos_edge": torch.tensor(val_pos, dtype=torch.long),
            "neg_edge": torch.tensor(val_neg, dtype=torch.long),
        },
        "test": {
            "pos_edge": torch.tensor(test_pos, dtype=torch.long),
            "neg_edge": torch.tensor(test_neg, dtype=torch.long),
        },
        "train_nodes": list(seen_nodes),
        "held_out_nodes": list(held_out_nodes)
    }
