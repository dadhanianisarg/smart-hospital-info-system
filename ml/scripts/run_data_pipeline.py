"""
Phase 1 Data Pipeline Runner.
Loads ogbl-ddi and DrugBank DDI datasets.
Extracts 2048-bit Morgan fingerprints.
Constructs S1 (transductive), S2 (one unseen drug), and S3 (two unseen drugs) splits.
Logs auditable dataset statistics to results/ and reports/PHASE_1_REPORT.md.
"""

import sys
import time
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import torch
import numpy as np

from ml.src.data.loaders import load_ogbl_ddi, load_drugbank
from ml.src.utils import get_logger, save_result_json, RESULTS_DIR, REPORTS_DIR

logger = get_logger("DataPipeline")


def run_pipeline():
    start_time = time.time()
    logger.info("==================================================")
    logger.info("   PHASE 1: DDI DATASET PIPELINE & SPLIT ENGINE   ")
    logger.info("==================================================")

    # 1. Load ogbl-ddi
    logger.info("[1/3] Ingesting official ogbl-ddi benchmark...")
    ogb_data = load_ogbl_ddi()
    ogb_stats = {
        "dataset": "ogbl-ddi",
        "num_nodes": ogb_data["num_nodes"],
        "num_edges": ogb_data["num_edges"],
        "train_edges": int(ogb_data["split_edge"]["train"]["edge"].shape[0]),
        "val_edges": int(ogb_data["split_edge"]["valid"]["edge"].shape[0]),
        "test_edges": int(ogb_data["split_edge"]["test"]["edge"].shape[0]),
        "primary_metric": "Hits@20 (ranking vs all negatives)",
        "feature_type": "Learned Node Embeddings (standard OGB setup)"
    }

    # 2. Load DrugBank DDI & build S1, S2, S3 splits
    logger.info("[2/3] Ingesting DrugBank DDI and generating S1, S2, S3 splits...")
    db_data = load_drugbank(seed=42)
    s1 = db_data["splits"]["S1"]
    s2 = db_data["splits"]["S2"]
    s3 = db_data["splits"]["S3"]

    db_stats = {
        "dataset": "DrugBank DDI",
        "license": "Academic Research License (via PyTDC)",
        "num_unique_drugs": db_data["num_nodes"],
        "num_undirected_interactions": db_data["num_interactions"],
        "invalid_smiles_count": len(db_data["invalid_drugs"]),
        "valid_fingerprint_count": db_data["num_nodes"] - len(db_data["invalid_drugs"]),
        "fingerprint_bits": 2048,
        "splits": {
            "S1_Transductive": {
                "train_pos": int(s1["train"]["pos_edge"].shape[0]),
                "train_neg": int(s1["train"]["neg_edge"].shape[0]),
                "val_pos": int(s1["val"]["pos_edge"].shape[0]),
                "val_neg": int(s1["val"]["neg_edge"].shape[0]),
                "test_pos": int(s1["test"]["pos_edge"].shape[0]),
                "test_neg": int(s1["test"]["neg_edge"].shape[0]),
                "held_out_nodes": len(s1["held_out_nodes"])
            },
            "S2_One_Unseen_Drug": {
                "train_pos": int(s2["train"]["pos_edge"].shape[0]),
                "train_neg": int(s2["train"]["neg_edge"].shape[0]),
                "val_pos": int(s2["val"]["pos_edge"].shape[0]),
                "val_neg": int(s2["val"]["neg_edge"].shape[0]),
                "test_pos": int(s2["test"]["pos_edge"].shape[0]),
                "test_neg": int(s2["test"]["neg_edge"].shape[0]),
                "train_nodes": len(s2["train_nodes"]),
                "held_out_nodes": len(s2["held_out_nodes"])
            },
            "S3_Two_Unseen_Drugs": {
                "train_pos": int(s3["train"]["pos_edge"].shape[0]),
                "train_neg": int(s3["train"]["neg_edge"].shape[0]),
                "val_pos": int(s3["val"]["pos_edge"].shape[0]),
                "val_neg": int(s3["val"]["neg_edge"].shape[0]),
                "test_pos": int(s3["test"]["pos_edge"].shape[0]),
                "test_neg": int(s3["test"]["neg_edge"].shape[0]),
                "train_nodes": len(s3["train_nodes"]),
                "held_out_nodes": len(s3["held_out_nodes"])
            }
        }
    }

    # Save summary stats artifact
    stats_payload = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "ogbl_ddi": ogb_stats,
        "drugbank": db_stats
    }
    stats_file = RESULTS_DIR / "dataset_statistics.json"
    with open(stats_file, "w", encoding="utf-8") as f:
        json.dump(stats_payload, f, indent=2)

    elapsed = time.time() - start_time
    logger.info(f"Phase 1 data pipeline completed in {elapsed:.2f} seconds.")
    logger.info(f"Auditable dataset statistics recorded to: {stats_file}")
    return stats_payload


if __name__ == "__main__":
    run_pipeline()
