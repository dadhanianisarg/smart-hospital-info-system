"""
Baseline DDI prediction models:
1. FingerprintMLP: Symmetric chemical Morgan fingerprint neural net.
2. FingerprintLogisticRegression: Linear baseline on symmetric chemical features.
3. GCNBaseline: 2-layer Graph Convolutional Network + MLP link decoder.
4. GraphSAGEBaseline: 2-layer GraphSAGE with mean aggregation + MLP link decoder.
5. TransEBaseline: Knowledge Graph Translation model (Transductive, S1 only).
6. DistMultBaseline: Bilinear Knowledge Graph Embedding (Transductive, S1 only).
7. RGCNBaseline: Relational GCN with chemical fingerprint projection (Inductive S1, S2, S3).
"""

import math
from typing import Optional, Tuple
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GCNConv, SAGEConv, RGCNConv
from sklearn.linear_model import LogisticRegression


# ====================================================================
# 1. Chemical Fingerprint Baselines
# ====================================================================

class FingerprintMLP(nn.Module):
    """
    Multilayer Perceptron operating on chemical Morgan fingerprints.
    Enforces symmetry via elementwise product, sum, and absolute difference:
    h(a, b) = [x_a * x_b ; x_a + x_b ; |x_a - x_b|]
    """
    def __init__(self, in_bits: int = 2048, hidden_dim: int = 128):
        super().__init__()
        # Input dimension is 3 * in_bits
        self.proj = nn.Linear(in_bits * 3, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, 64)
        self.out = nn.Linear(64, 1)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.2)

    def forward(self, x_a: torch.Tensor, x_b: torch.Tensor) -> torch.Tensor:
        sym_prod = x_a * x_b
        sym_sum = x_a + x_b
        sym_diff = torch.abs(x_a - x_b)
        feat = torch.cat([sym_prod, sym_sum, sym_diff], dim=-1)

        h = self.relu(self.proj(feat))
        h = self.dropout(h)
        h = self.relu(self.fc2(h))
        logits = self.out(h).squeeze(-1)
        return logits

    def predict_proba(self, x_a: torch.Tensor, x_b: torch.Tensor) -> torch.Tensor:
        return torch.sigmoid(self.forward(x_a, x_b))


class FingerprintLogisticRegressionWrapper:
    """Logistic Regression baseline using symmetric fingerprint interaction features."""
    def __init__(self):
        self.model = LogisticRegression(max_iter=300, random_state=42)

    def make_features(self, x_a: np.ndarray, x_b: np.ndarray) -> np.ndarray:
        # Symmetrized features: product and absolute difference
        prod = x_a * x_b
        diff = np.abs(x_a - x_b)
        return np.hstack([prod, diff])

    def fit(self, x_a: np.ndarray, x_b: np.ndarray, y: np.ndarray):
        X = self.make_features(x_a, x_b)
        self.model.fit(X, y)

    def predict_proba(self, x_a: np.ndarray, x_b: np.ndarray) -> np.ndarray:
        X = self.make_features(x_a, x_b)
        return self.model.predict_proba(X)[:, 1]


# ====================================================================
# 2. Graph Neural Network Baselines (GCN & GraphSAGE)
# ====================================================================

class LinkMLPDecoder(nn.Module):
    """Symmetric link decoder combining node embeddings."""
    def __init__(self, hidden_dim: int):
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, 1)
        )

    def forward(self, z_a: torch.Tensor, z_b: torch.Tensor) -> torch.Tensor:
        prod = z_a * z_b
        diff = torch.abs(z_a - z_b)
        cat = torch.cat([prod, diff], dim=-1)
        return self.mlp(cat).squeeze(-1)


class GCNBaseline(nn.Module):
    """Standard 2-layer Graph Convolutional Network."""
    def __init__(self, in_dim: int, hidden_dim: int = 128, out_dim: int = 64):
        super().__init__()
        self.conv1 = GCNConv(in_dim, hidden_dim)
        self.conv2 = GCNConv(hidden_dim, out_dim)
        self.decoder = LinkMLPDecoder(out_dim)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.2)

    def encode(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        h = self.relu(self.conv1(x, edge_index))
        h = self.dropout(h)
        z = self.conv2(h, edge_index)
        return z

    def decode(self, z: torch.Tensor, edge_pairs: torch.Tensor) -> torch.Tensor:
        u, v = edge_pairs[:, 0], edge_pairs[:, 1]
        return self.decoder(z[u], z[v])

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor, edge_pairs: torch.Tensor) -> torch.Tensor:
        z = self.encode(x, edge_index)
        return self.decode(z, edge_pairs)


class GraphSAGEBaseline(nn.Module):
    """Standard 2-layer GraphSAGE with mean aggregation."""
    def __init__(self, in_dim: int, hidden_dim: int = 128, out_dim: int = 64):
        super().__init__()
        self.conv1 = SAGEConv(in_dim, hidden_dim, aggr="mean")
        self.conv2 = SAGEConv(hidden_dim, out_dim, aggr="mean")
        self.decoder = LinkMLPDecoder(out_dim)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.2)

    def encode(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        h = self.relu(self.conv1(x, edge_index))
        h = self.dropout(h)
        z = self.conv2(h, edge_index)
        return z

    def decode(self, z: torch.Tensor, edge_pairs: torch.Tensor) -> torch.Tensor:
        u, v = edge_pairs[:, 0], edge_pairs[:, 1]
        return self.decoder(z[u], z[v])

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor, edge_pairs: torch.Tensor) -> torch.Tensor:
        z = self.encode(x, edge_index)
        return self.decode(z, edge_pairs)


# ====================================================================
# 3. Knowledge Graph Embedding Baselines (TransE & DistMult)
# ====================================================================

class TransEBaseline(nn.Module):
    """
    Transductive TransE scoring model:
    f(u, v) = gamma - ||e_u + r - e_v||_2
    Note: Strictly transductive; unsuited for unseen drugs (evaluated on S1 only).
    """
    def __init__(self, num_nodes: int, dim: int = 64, gamma: float = 12.0):
        super().__init__()
        self.num_nodes = num_nodes
        self.dim = dim
        self.gamma = gamma
        self.node_emb = nn.Embedding(num_nodes, dim)
        self.rel_emb = nn.Parameter(torch.zeros(1, dim))
        nn.init.uniform_(self.node_emb.weight, -6.0 / math.sqrt(dim), 6.0 / math.sqrt(dim))
        nn.init.uniform_(self.rel_emb, -6.0 / math.sqrt(dim), 6.0 / math.sqrt(dim))

    def forward(self, edge_pairs: torch.Tensor) -> torch.Tensor:
        u, v = edge_pairs[:, 0], edge_pairs[:, 1]
        head = F.normalize(self.node_emb(u), p=2, dim=-1)
        tail = F.normalize(self.node_emb(v), p=2, dim=-1)
        dist = torch.norm(head + self.rel_emb - tail, p=2, dim=-1)
        return self.gamma - dist


class DistMultBaseline(nn.Module):
    """
    Transductive DistMult bilinear scoring model:
    f(u, v) = e_u^T diag(r) e_v
    Note: Strictly transductive (evaluated on S1 only).
    """
    def __init__(self, num_nodes: int, dim: int = 64):
        super().__init__()
        self.node_emb = nn.Embedding(num_nodes, dim)
        self.rel_emb = nn.Parameter(torch.ones(1, dim))
        nn.init.xavier_uniform_(self.node_emb.weight)

    def forward(self, edge_pairs: torch.Tensor) -> torch.Tensor:
        u, v = edge_pairs[:, 0], edge_pairs[:, 1]
        head = self.node_emb(u)
        tail = self.node_emb(v)
        score = torch.sum(head * self.rel_emb * tail, dim=-1)
        return score


# ====================================================================
# 4. Relational GCN (R-GCN) Baseline with Fingerprint Initialization
# ====================================================================

class RGCNBaseline(nn.Module):
    """
    Relational Graph Convolutional Network initialized with projected
    chemical Morgan fingerprints. Enables inductive generalization (S1, S2, S3).
    """
    def __init__(
        self,
        in_dim: int = 2048,
        hidden_dim: int = 128,
        out_dim: int = 64,
        num_relations: int = 1
    ):
        super().__init__()
        self.feature_proj = nn.Linear(in_dim, hidden_dim)
        self.rgcn1 = RGCNConv(hidden_dim, hidden_dim, num_relations=num_relations)
        self.rgcn2 = RGCNConv(hidden_dim, out_dim, num_relations=num_relations)
        self.decoder = LinkMLPDecoder(out_dim)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.2)

    def encode(self, x: torch.Tensor, edge_index: torch.Tensor, edge_type: torch.Tensor) -> torch.Tensor:
        h0 = self.relu(self.feature_proj(x))
        h1 = self.relu(self.rgcn1(h0, edge_index, edge_type))
        h1 = self.dropout(h1)
        z = self.rgcn2(h1, edge_index, edge_type)
        return z

    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_type: torch.Tensor,
        edge_pairs: torch.Tensor
    ) -> torch.Tensor:
        z = self.encode(x, edge_index, edge_type)
        u, v = edge_pairs[:, 0], edge_pairs[:, 1]
        return self.decoder(z[u], z[v])
