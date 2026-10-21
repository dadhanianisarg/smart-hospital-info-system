"""
Temperature Scaling and Expected Calibration Error (ECE) for DDI Risk Calibration.
Applies post-hoc probability calibration to prevent clinical overconfidence.
"""

from typing import Dict, Tuple, Optional, Any
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from ml.src.metrics import compute_ece


class TemperatureScaler(nn.Module):
    """
    Post-hoc temperature scaling module for binary classification logits.
    Optimizes a single scalar T > 0 on validation logits using NLL loss.
    """
    def __init__(self):
        super().__init__()
        self.temperature = nn.Parameter(torch.ones(1) * 1.5)

    def forward(self, logits: torch.Tensor) -> torch.Tensor:
        """Scale logits by temperature."""
        return logits / self.temperature

    def fit(self, val_logits: torch.Tensor, val_labels: torch.Tensor, max_iter: int = 100) -> float:
        """
        Fit temperature parameter on validation set using L-BFGS optimizer.
        """
        criterion = nn.BCEWithLogitsLoss()
        optimizer = optim.LBFGS([self.temperature], lr=0.01, max_iter=max_iter)

        def eval_loss():
            optimizer.zero_grad()
            scaled_logits = self.forward(val_logits)
            loss = criterion(scaled_logits, val_labels)
            loss.backward()
            return loss

        optimizer.step(eval_loss)
        # Ensure temperature stays positive
        with torch.no_grad():
            self.temperature.clamp_(min=0.05, max=10.0)

        return float(self.temperature.item())

    def predict_proba(self, logits: torch.Tensor) -> np.ndarray:
        """Return calibrated probabilities."""
        with torch.no_grad():
            scaled = self.forward(logits)
            probs = torch.sigmoid(scaled)
        return probs.cpu().numpy()


def evaluate_calibration(
    y_true: np.ndarray,
    uncalibrated_probs: np.ndarray,
    calibrated_probs: np.ndarray,
    n_bins: int = 15
) -> Dict[str, Any]:
    """
    Compute reliability curve statistics and ECE before and after calibration.
    """
    ece_before = compute_ece(y_true, uncalibrated_probs, n_bins=n_bins)
    ece_after = compute_ece(y_true, calibrated_probs, n_bins=n_bins)

    # Bin statistics for plotting reliability diagrams
    bins = np.linspace(0.0, 1.0, n_bins + 1)

    def get_bin_stats(probs):
        bin_confs = []
        bin_accs = []
        bin_counts = []
        bin_indices = np.digitize(probs, bins) - 1

        for i in range(n_bins):
            mask = (bin_indices == i)
            count = np.sum(mask)
            bin_counts.append(int(count))
            if count > 0:
                bin_accs.append(float(np.mean(y_true[mask])))
                bin_confs.append(float(np.mean(probs[mask])))
            else:
                bin_accs.append(0.0)
                bin_confs.append(float((bins[i] + bins[i+1]) / 2))

        return {
            "bin_accs": bin_accs,
            "bin_confs": bin_confs,
            "bin_counts": bin_counts,
            "bin_edges": bins.tolist()
        }

    return {
        "ece_before": round(float(ece_before), 4),
        "ece_after": round(float(ece_after), 4),
        "relative_improvement_pct": round(float((ece_before - ece_after) / max(ece_before, 1e-6) * 100), 2),
        "uncalibrated_diagram": get_bin_stats(uncalibrated_probs),
        "calibrated_diagram": get_bin_stats(calibrated_probs)
    }
