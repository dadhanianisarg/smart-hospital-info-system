"""
Evaluation metrics module for DDI link prediction and calibration assessment.
Implements:
- AUROC (Area under ROC curve)
- AUPRC (Area under Precision-Recall curve)
- Hits@K (Hits@20, Hits@50 ranking evaluation)
- ECE (Expected Calibration Error with M=15 bins)
"""

from typing import Dict, Union, Tuple, Optional
import numpy as np
import torch
from sklearn.metrics import roc_auc_score, average_precision_score


def compute_auroc(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Compute Area Under Receiver Operating Characteristic Curve."""
    try:
        return float(roc_auc_score(y_true, y_pred))
    except Exception:
        return 0.5


def compute_auprc(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Compute Area Under Precision-Recall Curve (Average Precision)."""
    try:
        return float(average_precision_score(y_true, y_pred))
    except Exception:
        return 0.0


def compute_hits_at_k(
    pos_scores: np.ndarray,
    neg_scores: np.ndarray,
    k: int = 20
) -> float:
    """
    Compute Hits@K ranking metric standard in ogbl-ddi and link prediction literature:
    For each positive edge, evaluate what fraction rank within the top K against
    the pool of negative candidate edges.
    """
    if len(pos_scores) == 0 or len(neg_scores) == 0:
        return 0.0

    # Sort all negative scores in descending order
    sorted_neg = np.sort(neg_scores)[::-1]
    n_neg = len(sorted_neg)

    # Threshold for top-K rank
    k_idx = min(k - 1, n_neg - 1)
    threshold = sorted_neg[k_idx]

    # Fraction of positive scores >= the K-th negative score
    hits = np.mean(pos_scores >= threshold)
    return float(hits)


def compute_ece(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    n_bins: int = 15
) -> float:
    """
    Compute Expected Calibration Error (ECE) across M=15 uniform confidence bins:
    ECE = sum_{m=1}^{M} (|B_m| / N) * |acc(B_m) - conf(B_m)|
    """
    y_true = np.asarray(y_true).astype(float)
    y_prob = np.asarray(y_prob).astype(float)

    bin_boundaries = np.linspace(0.0, 1.0, n_bins + 1)
    bin_lowers = bin_boundaries[:-1]
    bin_uppers = bin_boundaries[1:]

    ece = 0.0
    n_samples = len(y_prob)
    if n_samples == 0:
        return 0.0

    for bin_lower, bin_upper in zip(bin_lowers, bin_uppers):
        # Items falling in bin m
        in_bin = (y_prob > bin_lower) & (y_prob <= bin_upper)
        prop_in_bin = np.mean(in_bin)

        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(y_true[in_bin])
            avg_confidence_in_bin = np.mean(y_prob[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin

    return float(ece)


def evaluate_all_metrics(
    y_true: Union[np.ndarray, torch.Tensor],
    y_prob: Union[np.ndarray, torch.Tensor],
    pos_scores: Optional[np.ndarray] = None,
    neg_scores: Optional[np.ndarray] = None
) -> Dict[str, float]:
    """
    Compute full evaluation metric dictionary:
    AUROC, AUPRC, Hits@20, Hits@50, and ECE.
    """
    if isinstance(y_true, torch.Tensor):
        y_true = y_true.detach().cpu().numpy()
    if isinstance(y_prob, torch.Tensor):
        y_prob = y_prob.detach().cpu().numpy()

    y_true = np.asarray(y_true).ravel()
    y_prob = np.asarray(y_prob).ravel()

    auroc = compute_auroc(y_true, y_prob)
    auprc = compute_auprc(y_true, y_prob)
    ece = compute_ece(y_true, y_prob, n_bins=15)

    if pos_scores is None or neg_scores is None:
        pos_scores = y_prob[y_true == 1]
        neg_scores = y_prob[y_true == 0]

    hits20 = compute_hits_at_k(pos_scores, neg_scores, k=20)
    hits50 = compute_hits_at_k(pos_scores, neg_scores, k=50)

    return {
        "auroc": round(auroc, 4),
        "auprc": round(auprc, 4),
        "hits@20": round(hits20, 4),
        "hits@50": round(hits50, 4),
        "ece": round(ece, 4),
        "AUROC": round(auroc, 4),
        "AUPRC": round(auprc, 4),
        "Hits@20": round(hits20, 4),
        "Hits@50": round(hits50, 4),
        "ECE": round(ece, 4)
    }
