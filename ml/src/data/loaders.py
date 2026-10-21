"""
Dataset loaders and graph construction module for ogbl-ddi, DrugBank, and TWOSIDES.
Integrates SMILES fingerprinting and S1/S2/S3 split generation.
"""

from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import os
import torch
import numpy as np
import pandas as pd

from torch_geometric.data import Data
from ogb.linkproppred import PygLinkPropPredDataset, Evaluator

from ml.src.data.features import build_drug_fingerprint_matrix
from ml.src.data.splits import (
    create_s1_transductive_split,
    create_s2_inductive_split,
    create_s3_inductive_split
)
from ml.src.utils import get_logger, ML_ROOT

logger = get_logger("DataLoader")
DATA_DIR = ML_ROOT / "data"


def load_ogbl_ddi(data_dir: Optional[Path] = None) -> Dict[str, Any]:
    """
    Load official ogbl-ddi benchmark graph and edge splits.
    Metric: Hits@20 via OGB Evaluator.
    """
    data_dir = data_dir or DATA_DIR
    logger.info("Loading ogbl-ddi dataset from OGB...")

    dataset = PygLinkPropPredDataset(name="ogbl-ddi", root=str(data_dir))
    data = dataset[0]
    split_edge = dataset.get_edge_split()
    evaluator = Evaluator(name="ogbl-ddi")

    logger.info(
        f"ogbl-ddi loaded successfully: {data.num_nodes} nodes, {data.num_edges} edges. "
        f"Train: {split_edge['train']['edge'].shape[0]}, "
        f"Val: {split_edge['valid']['edge'].shape[0]}, "
        f"Test: {split_edge['test']['edge'].shape[0]}"
    )

    return {
        "name": "ogbl-ddi",
        "pyg_data": data,
        "split_edge": split_edge,
        "evaluator": evaluator,
        "num_nodes": data.num_nodes,
        "num_edges": data.num_edges
    }


def load_drugbank(
    data_dir: Optional[Path] = None,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Load DrugBank DDI dataset via PyTDC, compute 2048-bit Morgan fingerprints,
    and generate S1, S2, and S3 experimental splits.
    """
    data_dir = data_dir or DATA_DIR
    logger.info("Loading DrugBank DDI dataset via PyTDC...")

    from tdc.multi_pred.ddi import DDI
    tdc_data = DDI(name="DrugBank", path=str(data_dir))
    df = tdc_data.get_data()

    # DrugBank License Notice per Global Rule 6 & Phase 1 requirements
    logger.info("[License Notice] DrugBank dataset is distributed under academic research license via PyTDC.")

    # Unique drugs and their SMILES
    drug_to_smiles = {}
    for _, row in df.iterrows():
        d1, s1 = row["Drug1_ID"], row["Drug1"]
        d2, s2 = row["Drug2_ID"], row["Drug2"]
        if d1 not in drug_to_smiles and isinstance(s1, str):
            drug_to_smiles[d1] = s1
        if d2 not in drug_to_smiles and isinstance(s2, str):
            drug_to_smiles[d2] = s2

    all_drugs = sorted(list(drug_to_smiles.keys()))
    drug_id_to_idx = {d: i for i, d in enumerate(all_drugs)}
    idx_to_drug_id = {i: d for d, i in drug_id_to_idx.items()}
    num_drugs = len(all_drugs)

    # Compute chemical fingerprints
    logger.info(f"Extracting 2048-bit Morgan fingerprints for {num_drugs} DrugBank drugs...")
    x_features, invalid_drugs = build_drug_fingerprint_matrix(drug_to_smiles, drug_id_to_idx)
    logger.info(f"Fingerprint matrix computed. Valid: {num_drugs - len(invalid_drugs)}, Invalid/Imputed: {len(invalid_drugs)}")

    # Extract interaction pairs
    positive_pairs_set = set()
    for _, row in df.iterrows():
        d1, d2 = row["Drug1_ID"], row["Drug2_ID"]
        if d1 in drug_id_to_idx and d2 in drug_id_to_idx:
            u, v = drug_id_to_idx[d1], drug_id_to_idx[d2]
            if u != v:
                positive_pairs_set.add((min(u, v), max(u, v)))

    positive_pairs = sorted(list(positive_pairs_set))
    logger.info(f"Extracted {len(positive_pairs)} unique undirected interaction pairs across {num_drugs} drugs.")

    # Generate S1, S2, S3 splits
    logger.info("Constructing S1 (Transductive), S2 (1-Unseen), and S3 (2-Unseen) splits...")
    s1_split = create_s1_transductive_split(positive_pairs, num_drugs, seed=seed)
    s2_split = create_s2_inductive_split(positive_pairs, num_drugs, seed=seed)
    s3_split = create_s3_inductive_split(positive_pairs, num_drugs, seed=seed)

    # Build base PyG Data object (training edges from S1)
    train_edges_s1 = s1_split["train"]["pos_edge"].t()
    bidirectional_s1_edges = torch.cat([train_edges_s1, train_edges_s1.flip(0)], dim=1)

    pyg_graph = Data(
        x=torch.tensor(x_features, dtype=torch.float32),
        edge_index=bidirectional_s1_edges,
        num_nodes=num_drugs
    )

    return {
        "name": "DrugBank",
        "df": df,
        "pyg_data": pyg_graph,
        "x_features": torch.tensor(x_features, dtype=torch.float32),
        "num_nodes": num_drugs,
        "num_interactions": len(positive_pairs),
        "drug_to_smiles": drug_to_smiles,
        "drug_id_to_idx": drug_id_to_idx,
        "idx_to_drug_id": idx_to_drug_id,
        "invalid_drugs": invalid_drugs,
        "splits": {
            "S1": s1_split,
            "S2": s2_split,
            "S3": s3_split
        }
    }


def load_twosides_top_n(
    data_dir: Optional[Path] = None,
    top_n_relations: int = 20,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Load TWOSIDES dataset via PyTDC, restricted to top N relations to conform to 16 GB RAM constraints.
    """
    data_dir = data_dir or DATA_DIR
    logger.info(f"Loading TWOSIDES restricted to top N={top_n_relations} relations...")

    from tdc.multi_pred.ddi import DDI
    tdc_data = DDI(name="TWOSIDES", path=str(data_dir))
    df = tdc_data.get_data()

    # Filter to most frequent relation types
    top_rels = df["Y"].value_counts().head(top_n_relations).index.tolist()
    df_filtered = df[df["Y"].isin(top_rels)].copy()
    logger.info(f"Filtered TWOSIDES from {len(df)} rows down to {len(df_filtered)} rows across top {top_n_relations} side effect relations.")

    # Unique drugs and SMILES
    drug_to_smiles = {}
    for _, row in df_filtered.iterrows():
        d1, s1 = row["Drug1_ID"], row["Drug1"]
        d2, s2 = row["Drug2_ID"], row["Drug2"]
        if d1 not in drug_to_smiles and isinstance(s1, str):
            drug_to_smiles[d1] = s1
        if d2 not in drug_to_smiles and isinstance(s2, str):
            drug_to_smiles[d2] = s2

    all_drugs = sorted(list(drug_to_smiles.keys()))
    drug_id_to_idx = {d: i for i, d in enumerate(all_drugs)}
    num_drugs = len(all_drugs)

    x_features, invalid_drugs = build_drug_fingerprint_matrix(drug_to_smiles, drug_id_to_idx)

    # Pairs
    positive_pairs_set = set()
    for _, row in df_filtered.iterrows():
        d1, d2 = row["Drug1_ID"], row["Drug2_ID"]
        if d1 in drug_id_to_idx and d2 in drug_id_to_idx:
            u, v = drug_id_to_idx[d1], drug_id_to_idx[d2]
            if u != v:
                positive_pairs_set.add((min(u, v), max(u, v)))

    positive_pairs = sorted(list(positive_pairs_set))
    s1_split = create_s1_transductive_split(positive_pairs, num_drugs, seed=seed)

    return {
        "name": "TWOSIDES_Top20",
        "num_nodes": num_drugs,
        "num_interactions": len(positive_pairs),
        "num_relations": top_n_relations,
        "invalid_drugs": invalid_drugs,
        "splits": {"S1": s1_split}
    }
