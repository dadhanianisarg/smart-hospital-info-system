"""
Phase 0 Smoke Test:
1. Verify importability of all 14 required libraries.
2. Verify CPU threading configuration (8 threads).
3. Build a tiny graph with PyTorch Geometric.
4. Execute one forward and backward GNN pass on CPU.
"""

import sys
import os
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pytest
import numpy as np
import pandas as pd
import scipy
import yaml
import matplotlib
import sklearn
import rdkit
import fastapi
import uvicorn
import ogb
import torch
import torch.nn as nn
from torch_geometric.data import Data
from torch_geometric.nn import GCNConv, SAGEConv

from ml.src.utils import setup_cpu_threads, set_seed


def test_library_imports():
    """Verify all critical libraries are present and importable."""
    from tdc.multi_pred.ddi import DDI
    assert DDI is not None
    assert torch.__version__ is not None
    assert rdkit.__version__ is not None
    assert ogb.__version__ is not None


def test_cpu_threading():
    """Verify thread count is explicitly configured to 8 threads per Global Rule 1."""
    threads = setup_cpu_threads(8)
    assert threads == 8, f"Expected 8 threads, got {threads}"
    assert torch.get_num_threads() == 8
    print(f"\n[SmokeTest] PyTorch CPU thread count: {torch.get_num_threads()}")


def test_gnn_forward_backward_pass():
    """Build a tiny graph and execute forward + backward passes on CPU."""
    set_seed(42)
    device = torch.device("cpu")

    # Construct tiny synthetic graph (10 nodes, 16 edges, 64-dim features)
    num_nodes = 10
    feature_dim = 64
    x = torch.randn(num_nodes, feature_dim, device=device, requires_grad=True)

    # Undirected edges
    edge_index = torch.tensor([
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 0],
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 1, 2, 3, 4, 5]
    ], dtype=torch.long, device=device)

    # Binary labels for node classification dummy task
    y = torch.tensor([0, 1, 0, 1, 0, 1, 0, 1, 0, 1], dtype=torch.float, device=device)

    # 2-layer GNN model
    class SimpleGNN(nn.Module):
        def __init__(self, in_channels, hidden_channels, out_channels):
            super().__init__()
            self.conv1 = GCNConv(in_channels, hidden_channels)
            self.conv2 = SAGEConv(hidden_channels, out_channels)
            self.relu = nn.ReLU()

        def forward(self, x, edge_index):
            h = self.conv1(x, edge_index)
            h = self.relu(h)
            out = self.conv2(h, edge_index)
            return out.squeeze(-1)

    model = SimpleGNN(in_channels=feature_dim, hidden_channels=64, out_channels=1).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    criterion = nn.BCEWithLogitsLoss()

    # Forward pass
    logits = model(x, edge_index)
    loss = criterion(logits, y)

    assert torch.isfinite(loss), "Loss must be finite"
    assert logits.shape == (num_nodes,), f"Expected shape ({num_nodes},), got {logits.shape}"

    # Backward pass
    optimizer.zero_grad()
    loss.backward()

    # Verify gradients computed across all parameters
    for name, param in model.named_parameters():
        assert param.grad is not None, f"Gradient for {name} was None"
        assert torch.isfinite(param.grad).all(), f"Gradient for {name} contained non-finite values"

    optimizer.step()

    print(f"[SmokeTest] GNN forward pass successful: loss = {loss.item():.4f}")
    print(f"[SmokeTest] GNN backward pass successful: gradients verified across all layers")
    print(f"[SmokeTest] Device verified: {device} (CPU only)")
