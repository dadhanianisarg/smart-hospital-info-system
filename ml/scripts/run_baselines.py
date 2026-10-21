"""
Phase 2 Baselines Experiment Runner.
Trains and evaluates 7 baselines across Seeds 0, 1, 2, 3, 4:
- Fingerprint MLP (S1, S2, S3)
- Fingerprint Logistic Regression (S1, S2, S3)
- GCN (S1, ogbl-ddi)
- GraphSAGE (S1, ogbl-ddi)
- TransE (S1 Transductive)
- DistMult (S1 Transductive)
- R-GCN with Fingerprint Features (S1, S2, S3 Inductive)

Metrics: AUROC, AUPRC, Hits@20, Hits@50, ECE.
Outputs: Individual run JSONs in results/ and consolidated results/baselines.csv.
"""

import sys
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.src.utils import setup_cpu_threads, set_seed, get_logger, save_result_json, RESULTS_DIR
from ml.src.data.loaders import load_drugbank, load_ogbl_ddi
from ml.src.metrics import evaluate_all_metrics
from ml.src.models.baselines import (
    FingerprintMLP,
    FingerprintLogisticRegressionWrapper,
    GCNBaseline,
    GraphSAGEBaseline,
    TransEBaseline,
    DistMultBaseline,
    RGCNBaseline
)

logger = get_logger("Baselines")
SEEDS = [0, 1, 2, 3, 4]


# ====================================================================
# Evaluation Helpers
# ====================================================================

def eval_torch_model_on_split(
    model: nn.Module,
    split_data: Dict[str, Any],
    x_features: torch.Tensor,
    graph_edge_index: torch.Tensor,
    edge_type: Optional[torch.Tensor] = None,
    batch_size: int = 4096
) -> Dict[str, float]:
    """Evaluate GNN or MLP model on test edges in mini-batches."""
    model.eval()
    pos_edges = split_data["test"]["pos_edge"]
    neg_edges = split_data["test"]["neg_edge"]

    all_pairs = torch.cat([pos_edges, neg_edges], dim=0)
    y_true = np.concatenate([np.ones(len(pos_edges)), np.zeros(len(neg_edges))])

    probs = []
    with torch.no_grad():
        for i in range(0, len(all_pairs), batch_size):
            batch_pairs = all_pairs[i:i + batch_size]
            if isinstance(model, FingerprintMLP):
                u, v = batch_pairs[:, 0], batch_pairs[:, 1]
                logits = model(x_features[u], x_features[v])
            elif isinstance(model, (TransEBaseline, DistMultBaseline)):
                logits = model(batch_pairs)
            elif isinstance(model, RGCNBaseline):
                logits = model(x_features, graph_edge_index, edge_type, batch_pairs)
            else:
                logits = model(x_features, graph_edge_index, batch_pairs)
            prob = torch.sigmoid(logits).cpu().numpy()
            probs.append(prob)

    y_prob = np.concatenate(probs)
    return evaluate_all_metrics(y_true, y_prob)


# ====================================================================
# Experiment Runners
# ====================================================================

def run_fingerprint_baselines(db_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Train and evaluate Fingerprint MLP and Logistic Regression on S1, S2, S3."""
    results = []
    x_features = db_data["x_features"]
    x_np = x_features.numpy()

    for split_name in ["S1", "S2", "S3"]:
        split_dict = db_data["splits"][split_name]
        logger.info(f"--- Running Fingerprint Baselines on {split_name} ---")

        for seed in SEEDS:
            set_seed(seed)
            t0 = time.time()

            # 1. Logistic Regression
            lr_model = FingerprintLogisticRegressionWrapper()
            train_pos = split_dict["train"]["pos_edge"].numpy()
            train_neg = split_dict["train"]["neg_edge"].numpy()
            n_sample = min(20000, len(train_pos))  # Subsample for CPU training speed

            train_pairs = np.vstack([train_pos[:n_sample], train_neg[:n_sample]])
            y_train = np.concatenate([np.ones(n_sample), np.zeros(n_sample)])

            lr_model.fit(x_np[train_pairs[:, 0]], x_np[train_pairs[:, 1]], y_train)

            test_pos = split_dict["test"]["pos_edge"].numpy()
            test_neg = split_dict["test"]["neg_edge"].numpy()
            test_pairs = np.vstack([test_pos, test_neg])
            y_test = np.concatenate([np.ones(len(test_pos)), np.zeros(len(test_neg))])

            test_prob = lr_model.predict_proba(x_np[test_pairs[:, 0]], x_np[test_pairs[:, 1]])
            lr_metrics = evaluate_all_metrics(y_test, test_prob)
            wall_time = time.time() - t0

            save_result_json("Fingerprint_LR", {"split": split_name}, seed, lr_metrics, wall_time)
            results.append({
                "model": "Fingerprint_LR",
                "split": split_name,
                "seed": seed,
                **lr_metrics
            })

            # 2. Fingerprint MLP
            t0_mlp = time.time()
            mlp = FingerprintMLP(in_bits=2048, hidden_dim=128)
            optimizer = optim.Adam(mlp.parameters(), lr=0.003)
            criterion = nn.BCEWithLogitsLoss()

            # Train MLP for 5 epochs
            mlp.train()
            batch_size = 512
            train_pos_t = split_dict["train"]["pos_edge"]
            train_neg_t = split_dict["train"]["neg_edge"]
            n_train_samples = min(25000, len(train_pos_t))
            perm = torch.randperm(len(train_pos_t))[:n_train_samples]

            p_batch = train_pos_t[perm]
            n_batch = train_neg_t[perm]
            pairs_cat = torch.cat([p_batch, n_batch], dim=0)
            labels_cat = torch.cat([torch.ones(n_train_samples), torch.zeros(n_train_samples)], dim=0)

            for epoch in range(5):
                shuff = torch.randperm(len(pairs_cat))
                for i in range(0, len(pairs_cat), batch_size):
                    idx = shuff[i:i + batch_size]
                    b_pairs = pairs_cat[idx]
                    b_labels = labels_cat[idx]
                    u, v = b_pairs[:, 0], b_pairs[:, 1]
                    logits = mlp(x_features[u], x_features[v])
                    loss = criterion(logits, b_labels)
                    optimizer.zero_grad()
                    loss.backward()
                    optimizer.step()

            mlp_metrics = eval_torch_model_on_split(mlp, split_dict, x_features, None)
            wall_time_mlp = time.time() - t0_mlp
            save_result_json("Fingerprint_MLP", {"split": split_name}, seed, mlp_metrics, wall_time_mlp)
            results.append({
                "model": "Fingerprint_MLP",
                "split": split_name,
                "seed": seed,
                **mlp_metrics
            })

    return results


def run_gnn_baselines(db_data: Dict[str, Any], ogb_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Train and evaluate GCN and GraphSAGE on DrugBank S1 and ogbl-ddi."""
    results = []
    x_features = db_data["x_features"]
    pyg_data = db_data["pyg_data"]
    s1_split = db_data["splits"]["S1"]

    for model_name, model_cls in [("GCN", GCNBaseline), ("GraphSAGE", GraphSAGEBaseline)]:
        logger.info(f"--- Running {model_name} on DrugBank S1 ---")
        for seed in SEEDS:
            set_seed(seed)
            t0 = time.time()

            model = model_cls(in_dim=2048, hidden_dim=64, out_dim=32)
            optimizer = optim.Adam(model.parameters(), lr=0.005)
            criterion = nn.BCEWithLogitsLoss()

            # Train for 5 epochs
            train_pos = s1_split["train"]["pos_edge"]
            train_neg = s1_split["train"]["neg_edge"]
            n_sub = min(20000, len(train_pos))
            pairs = torch.cat([train_pos[:n_sub], train_neg[:n_sub]], dim=0)
            labels = torch.cat([torch.ones(n_sub), torch.zeros(n_sub)], dim=0)

            model.train()
            batch_size = 1024
            for epoch in range(5):
                shuff = torch.randperm(len(pairs))
                for i in range(0, len(pairs), batch_size):
                    idx = shuff[i:i + batch_size]
                    b_pairs = pairs[idx]
                    b_labels = labels[idx]
                    logits = model(x_features, pyg_data.edge_index, b_pairs)
                    loss = criterion(logits, b_labels)
                    optimizer.zero_grad()
                    loss.backward()
                    optimizer.step()

            metrics = eval_torch_model_on_split(model, s1_split, x_features, pyg_data.edge_index)
            wall_time = time.time() - t0
            save_result_json(model_name, {"dataset": "DrugBank_S1"}, seed, metrics, wall_time)
            results.append({
                "model": model_name,
                "split": "DrugBank_S1",
                "seed": seed,
                **metrics
            })

    # Sanity Check on ogbl-ddi (Hits@20)
    logger.info("--- Running ogbl-ddi GCN & GraphSAGE Sanity Check ---")
    ogb_pyg = ogb_data["pyg_data"]
    ogb_nodes = ogb_pyg.num_nodes
    ogb_split = ogb_data["split_edge"]

    for model_name, model_cls in [("GCN_ogbl", GCNBaseline), ("GraphSAGE_ogbl", GraphSAGEBaseline)]:
        set_seed(42)
        t0 = time.time()
        # Initialize learned node feature embeddings
        emb = nn.Embedding(ogb_nodes, 64)
        nn.init.xavier_uniform_(emb.weight)
        x_emb = emb.weight

        model = model_cls(in_dim=64, hidden_dim=64, out_dim=32)
        optimizer = optim.Adam(list(model.parameters()) + list(emb.parameters()), lr=0.005)
        criterion = nn.BCEWithLogitsLoss()

        train_pos = ogb_split["train"]["edge"]
        n_train = 30000
        pos_idx = torch.randperm(len(train_pos))[:n_train]
        train_pairs = train_pos[pos_idx]

        # Negative sampling
        neg_pairs = torch.randint(0, ogb_nodes, (n_train, 2))
        pairs = torch.cat([train_pairs, neg_pairs], dim=0)
        labels = torch.cat([torch.ones(n_train), torch.zeros(n_train)], dim=0)

        # Train 3 epochs
        model.train()
        for epoch in range(3):
            for i in range(0, len(pairs), 2048):
                b_pairs = pairs[i:i + 2048]
                b_labels = labels[i:i + 2048]
                logits = model(x_emb, ogb_pyg.edge_index, b_pairs)
                loss = criterion(logits, b_labels)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

        # Evaluate Hits@20 on test
        model.eval()
        with torch.no_grad():
            t_pos = ogb_split["test"]["edge"][:2000]
            t_neg = ogb_split["test"]["edge_neg"][:2000] if "edge_neg" in ogb_split["test"] else torch.randint(0, ogb_nodes, (2000, 2))
            pos_scores = torch.sigmoid(model(x_emb, ogb_pyg.edge_index, t_pos)).cpu().numpy()
            neg_scores = torch.sigmoid(model(x_emb, ogb_pyg.edge_index, t_neg)).cpu().numpy()
            y_true = np.concatenate([np.ones(len(pos_scores)), np.zeros(len(neg_scores))])
            y_prob = np.concatenate([pos_scores, neg_scores])
            ogb_metrics = evaluate_all_metrics(y_true, y_prob, pos_scores, neg_scores)

        wall_time = time.time() - t0
        logger.info(f"{model_name} on ogbl-ddi: Hits@20 = {ogb_metrics['hits@20']*100:.1f}%, AUROC = {ogb_metrics['auroc']:.4f}")
        save_result_json(model_name, {"dataset": "ogbl-ddi"}, 42, ogb_metrics, wall_time)
        results.append({
            "model": model_name,
            "split": "ogbl-ddi",
            "seed": 42,
            **ogb_metrics
        })

    return results


def run_kge_baselines(db_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Train and evaluate TransE and DistMult (Transductive, S1 only)."""
    results = []
    num_nodes = db_data["num_nodes"]
    s1_split = db_data["splits"]["S1"]

    for model_name, model_cls in [("TransE", TransEBaseline), ("DistMult", DistMultBaseline)]:
        logger.info(f"--- Running {model_name} on DrugBank S1 (Transductive) ---")
        for seed in SEEDS:
            set_seed(seed)
            t0 = time.time()
            model = model_cls(num_nodes=num_nodes, dim=64)
            optimizer = optim.Adam(model.parameters(), lr=0.01)
            criterion = nn.BCEWithLogitsLoss()

            train_pos = s1_split["train"]["pos_edge"]
            train_neg = s1_split["train"]["neg_edge"]
            n_sub = min(20000, len(train_pos))
            pairs = torch.cat([train_pos[:n_sub], train_neg[:n_sub]], dim=0)
            labels = torch.cat([torch.ones(n_sub), torch.zeros(n_sub)], dim=0)

            model.train()
            for epoch in range(5):
                shuff = torch.randperm(len(pairs))
                for i in range(0, len(pairs), 1024):
                    idx = shuff[i:i + 1024]
                    b_pairs = pairs[idx]
                    b_labels = labels[idx]
                    scores = model(b_pairs)
                    loss = criterion(scores, b_labels)
                    optimizer.zero_grad()
                    loss.backward()
                    optimizer.step()

            metrics = eval_torch_model_on_split(model, s1_split, None, None)
            wall_time = time.time() - t0
            save_result_json(model_name, {"split": "S1_Transductive"}, seed, metrics, wall_time)
            results.append({
                "model": model_name,
                "split": "S1",
                "seed": seed,
                **metrics
            })

    return results


def run_rgcn_baseline(db_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Train and evaluate R-GCN with fingerprint initialization on S1, S2, and S3."""
    results = []
    x_features = db_data["x_features"]

    for split_name in ["S1", "S2", "S3"]:
        split_dict = db_data["splits"][split_name]
        logger.info(f"--- Running R-GCN Baseline on DrugBank {split_name} ---")

        # Build training message-passing graph strictly from training edges
        train_edges = split_dict["train"]["pos_edge"].t()
        bidirectional = torch.cat([train_edges, train_edges.flip(0)], dim=1)
        edge_type = torch.zeros(bidirectional.shape[1], dtype=torch.long)

        for seed in SEEDS:
            set_seed(seed)
            t0 = time.time()
            model = RGCNBaseline(in_dim=2048, hidden_dim=64, out_dim=32, num_relations=1)
            optimizer = optim.Adam(model.parameters(), lr=0.005)
            criterion = nn.BCEWithLogitsLoss()

            train_pos = split_dict["train"]["pos_edge"]
            train_neg = split_dict["train"]["neg_edge"]
            n_sub = min(20000, len(train_pos))
            pairs = torch.cat([train_pos[:n_sub], train_neg[:n_sub]], dim=0)
            labels = torch.cat([torch.ones(n_sub), torch.zeros(n_sub)], dim=0)

            model.train()
            for epoch in range(5):
                shuff = torch.randperm(len(pairs))
                for i in range(0, len(pairs), 1024):
                    idx = shuff[i:i + 1024]
                    b_pairs = pairs[idx]
                    b_labels = labels[idx]
                    logits = model(x_features, bidirectional, edge_type, b_pairs)
                    loss = criterion(logits, b_labels)
                    optimizer.zero_grad()
                    loss.backward()
                    optimizer.step()

            metrics = eval_torch_model_on_split(model, split_dict, x_features, bidirectional, edge_type)
            wall_time = time.time() - t0
            save_result_json("R-GCN", {"split": split_name}, seed, metrics, wall_time)
            results.append({
                "model": "R-GCN",
                "split": split_name,
                "seed": seed,
                **metrics
            })

    return results


def main():
    setup_cpu_threads(8)
    logger.info("==================================================")
    logger.info("        PHASE 2: BASELINES EVALUATION RUN         ")
    logger.info("==================================================")

    db_data = load_drugbank(seed=42)
    ogb_data = load_ogbl_ddi()

    all_records = []

    # 1. Chemical Fingerprint Baselines (MLP, Logistic Regression)
    all_records.extend(run_fingerprint_baselines(db_data))

    # 2. Knowledge Graph Embedding Baselines (TransE, DistMult)
    all_records.extend(run_kge_baselines(db_data))

    # 3. Homogeneous GNN Baselines (GCN, GraphSAGE)
    all_records.extend(run_gnn_baselines(db_data, ogb_data))

    # 4. Multi-Relational GCN with Inductive Fingerprints (R-GCN)
    all_records.extend(run_rgcn_baseline(db_data))

    # Compile consolidated CSV report
    df_results = pd.DataFrame(all_records)
    csv_path = RESULTS_DIR / "baselines.csv"
    df_results.to_csv(csv_path, index=False)
    logger.info(f"Consolidated baselines metrics saved to: {csv_path}")

    # Generate Mean +/- Std Summary
    summary = df_results.groupby(["model", "split"])[["auroc", "auprc", "hits@20", "hits@50", "ece"]].agg(
        ["mean", "std"]
    ).round(4)
    summary_path = RESULTS_DIR / "baselines_summary.csv"
    summary.to_csv(summary_path)
    logger.info(f"Summary mean +/- std table saved to: {summary_path}")
    print("\n=== CONSOLIDATED BASELINES SUMMARY ===")
    print(summary)


if __name__ == "__main__":
    main()
