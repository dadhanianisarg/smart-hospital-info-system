"""
Compute Wilcoxon Signed-Rank Test Significance between PatientConditionedDDI and Baselines.
Saves results/significance_tests.json.
"""

import sys
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd
import numpy as np
from scipy import stats

from ml.src.utils import RESULTS_DIR, get_logger

logger = get_logger("SignificanceTest")


def main():
    df_main = pd.read_csv(RESULTS_DIR / "main.csv")
    df_baselines = pd.read_csv(RESULTS_DIR / "baselines.csv")

    significance_results = []

    # 1. S1: Our Model vs Fingerprint_MLP
    our_s1 = df_main[(df_main["task"] == "Task_A") & (df_main["split"] == "S1")]["auroc"].values
    base_s1_mlp = df_baselines[(df_baselines["model"] == "Fingerprint_MLP") & (df_baselines["split"] == "S1")]["auroc"].values
    if len(our_s1) == len(base_s1_mlp) and len(our_s1) >= 5:
        w_stat, p_val = stats.wilcoxon(our_s1, base_s1_mlp)
        significance_results.append({
            "comparison": "Our Model vs Fingerprint_MLP (S1 AUROC)",
            "our_mean": float(np.mean(our_s1)),
            "base_mean": float(np.mean(base_s1_mlp)),
            "wilcoxon_stat": float(w_stat),
            "p_value": float(p_val),
            "significant_p05": bool(p_val < 0.05)
        })

    # 2. S2: Our Model vs Fingerprint_LR
    our_s2 = df_main[(df_main["task"] == "Task_A") & (df_main["split"] == "S2")]["auroc"].values
    base_s2_lr = df_baselines[(df_baselines["model"] == "Fingerprint_LR") & (df_baselines["split"] == "S2")]["auroc"].values
    if len(our_s2) == len(base_s2_lr) and len(our_s2) >= 5:
        w_stat, p_val = stats.wilcoxon(our_s2, base_s2_lr)
        significance_results.append({
            "comparison": "Our Model vs Fingerprint_LR (S2 AUROC)",
            "our_mean": float(np.mean(our_s2)),
            "base_mean": float(np.mean(base_s2_lr)),
            "wilcoxon_stat": float(w_stat),
            "p_value": float(p_val),
            "significant_p05": bool(p_val < 0.05)
        })

    # 3. S3: Our Model vs RGCN (demonstrating cold-start superiority over pure graph)
    our_s3 = df_main[(df_main["task"] == "Task_A") & (df_main["split"] == "S3")]["auroc"].values
    base_s3_rgcn = df_baselines[(df_baselines["model"] == "RGCN") & (df_baselines["split"] == "S3")]["auroc"].values
    if len(our_s3) == len(base_s3_rgcn) and len(our_s3) >= 5:
        w_stat, p_val = stats.wilcoxon(our_s3, base_s3_rgcn)
        significance_results.append({
            "comparison": "Our Model vs RGCN Graph (S3 AUROC)",
            "our_mean": float(np.mean(our_s3)),
            "base_mean": float(np.mean(base_s3_rgcn)),
            "wilcoxon_stat": float(w_stat),
            "p_value": float(p_val),
            "significant_p05": bool(p_val < 0.05)
        })

    # 4. Task B vs Ablation 1 (No Patient Context)
    df_abl = pd.read_csv(RESULTS_DIR / "ablations.csv")
    our_task_b = df_main[df_main["task"] == "Task_B_PatientConditioned"]["auroc"].values
    no_ctx_task_b = df_abl[df_abl["ablation"] == "1_No_Patient_Context"]["auroc"].values
    if len(our_task_b) == len(no_ctx_task_b) and len(our_task_b) >= 5:
        w_stat, p_val = stats.wilcoxon(our_task_b, no_ctx_task_b)
        significance_results.append({
            "comparison": "Patient-Conditioned vs No-Context Ablation (Task B AUROC)",
            "our_mean": float(np.mean(our_task_b)),
            "base_mean": float(np.mean(no_ctx_task_b)),
            "wilcoxon_stat": float(w_stat),
            "p_value": float(p_val),
            "significant_p05": bool(p_val < 0.05)
        })

    out_file = RESULTS_DIR / "significance_tests.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(significance_results, f, indent=2)

    logger.info(f"Wilcoxon signed-rank tests computed and saved to {out_file}.")
    for r in significance_results:
        logger.info(f" - {r['comparison']}: our={r['our_mean']:.4f}, base={r['base_mean']:.4f}, W={r['wilcoxon_stat']}, p={r['p_value']:.4f} (sig={r['significant_p05']})")


if __name__ == "__main__":
    main()
