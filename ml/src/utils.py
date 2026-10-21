"""
Core utility functions for reproducibility, CPU optimization, logging, and metrics recording.
Global Rules enforced:
- CPU only with torch.set_num_threads(8)
- Reproducible multi-seed initialization (0, 1, 2, 3, 4)
- Structured results logging with git commit hash, configuration, metrics, and execution time
"""

import os
import sys
import time
import random
import logging
import subprocess
import json
from pathlib import Path
from typing import Dict, Any, Optional

import numpy as np
import torch

# PyTorch 2.6+ unpickler patch for OGB and legacy checkpoints
_orig_torch_load = torch.load

def _patched_torch_load(*args, **kwargs):
    if "weights_only" not in kwargs:
        kwargs["weights_only"] = False
    return _orig_torch_load(*args, **kwargs)

torch.load = _patched_torch_load

# Base directories
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ML_ROOT = PROJECT_ROOT / "ml"
DATA_DIR = ML_ROOT / "data"
CONFIGS_DIR = ML_ROOT / "configs"
RESULTS_DIR = PROJECT_ROOT / "results"
REPORTS_DIR = PROJECT_ROOT / "reports"
FIGURES_DIR = PROJECT_ROOT / "figures"

# Enforce directory existence
for d in [RESULTS_DIR, REPORTS_DIR, FIGURES_DIR, DATA_DIR, CONFIGS_DIR]:
    d.mkdir(parents=True, exist_ok=True)


def setup_cpu_threads(num_threads: int = 8) -> int:
    """Enforce CPU thread count per Global Rule 1."""
    torch.set_num_threads(num_threads)
    os.environ["OMP_NUM_THREADS"] = str(num_threads)
    os.environ["MKL_NUM_THREADS"] = str(num_threads)
    return torch.get_num_threads()


def set_seed(seed: int = 0) -> None:
    """Ensure strict multi-seed reproducibility across Python, NumPy, and PyTorch."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def get_git_commit_hash() -> str:
    """Retrieve current git commit hash for auditability."""
    try:
        commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=str(PROJECT_ROOT),
            stderr=subprocess.DEVNULL
        ).decode("ascii").strip()
        return commit
    except Exception:
        return "git-unavailable"


def get_logger(name: str = "HIS_DDI", level: int = logging.INFO) -> logging.Logger:
    """Configure standardized logger with timestamps."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(level)
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger


def save_result_json(
    experiment_name: str,
    config: Dict[str, Any],
    seed: int,
    metrics: Dict[str, Any],
    wall_clock_seconds: float,
    extra_metadata: Optional[Dict[str, Any]] = None
) -> Path:
    """
    Save execution run artifact to results/ directory per Global Rule 3.
    Contains config, seed, git commit hash, metrics, and wall-clock execution time.
    """
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    filename = f"{experiment_name}_seed{seed}_{timestamp}.json"
    target_path = RESULTS_DIR / filename

    payload = {
        "experiment_name": experiment_name,
        "seed": seed,
        "git_commit": get_git_commit_hash(),
        "wall_clock_seconds": round(wall_clock_seconds, 3),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "threads": torch.get_num_threads(),
        "config": config,
        "metrics": metrics,
        "metadata": extra_metadata or {}
    }

    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    return target_path


# Initialize CPU threads by default on import
setup_cpu_threads(8)
