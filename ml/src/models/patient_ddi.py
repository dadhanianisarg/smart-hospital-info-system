"""
PatientConditionedDDI: Patient-Conditioned Drug-Interaction Risk Prediction Model.

Architecture:
1. Molecular Projection: 2048-bit Morgan fingerprint -> d_model (zero-shot cold-start capability).
2. Relational Graph Encoder: 2-layer R-GCN (or GATConv switch) over drug interaction graph.
   Residual skip connection preserves chemical priors for unseen/isolated nodes.
3. Patient Context Subgraph Attention:
   Learned condition and patient embeddings.
   Multi-head / scaled dot-product attention over patient's active diagnoses and current regimen:
   alpha_k = softmax(q_p^T W_k z_k / sqrt(d)),  c_p = sum_k alpha_k W_v z_k.
4. Patient-Conditioned Link Decoder:
   h_ab = [z_a * z_b ; |z_a - z_b| ; z_a + z_b ; c_p]
   risk = sigmoid(MLP(h_ab))
5. Context-Free Switch:
   Supports standard transductive and cold-start DDI benchmarks (Task A: S1, S2, S3) by setting c_p = 0.
"""

from typing import Dict, List, Optional, Tuple, Union
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import RGCNConv, GATConv, GCNConv


class MolecularProjection(nn.Module):
    """Projects 2048-bit RDKit Morgan fingerprints into latent embedding space."""
    def __init__(self, in_dim: int = 2048, hidden_dim: int = 128, dropout: float = 0.1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim),
            nn.LayerNorm(hidden_dim)
        )

    def forward(self, fp: torch.Tensor) -> torch.Tensor:
        return self.net(fp)


class PatientSubgraphAttention(nn.Module):
    """
    Scaled dot-product attention over patient's local physiological subgraph
    (active condition nodes + current medication regimen).
    Produces patient context vector c_p and attention weights alpha for clinical interpretability.
    """
    def __init__(self, dim: int = 128):
        super().__init__()
        self.dim = dim
        self.q_proj = nn.Linear(dim, dim)
        self.k_proj = nn.Linear(dim, dim)
        self.v_proj = nn.Linear(dim, dim)
        self.scale = dim ** -0.5

    def forward(
        self,
        patient_emb: torch.Tensor,                # [dim] or [batch, dim]
        context_embs: torch.Tensor,               # [num_items, dim]
        mask: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Returns:
            c_p: Aggregated patient context vector [dim]
            attn_weights: Attention scores [num_items]
        """
        if context_embs.shape[0] == 0:
            return torch.zeros(self.dim, device=patient_emb.device), torch.empty(0, device=patient_emb.device)

        if patient_emb.dim() == 1:
            patient_emb = patient_emb.unsqueeze(0)  # [1, dim]

        q = self.q_proj(patient_emb)                # [1, dim]
        k = self.k_proj(context_embs)               # [num_items, dim]
        v = self.v_proj(context_embs)               # [num_items, dim]

        # Compute dot product attention
        scores = torch.matmul(q, k.transpose(0, 1)) * self.scale  # [1, num_items]
        if mask is not None:
            scores = scores.masked_fill(~mask, float("-inf"))

        weights = F.softmax(scores, dim=-1)         # [1, num_items]
        c_p = torch.matmul(weights, v).squeeze(0)   # [dim]

        return c_p, weights.squeeze(0)


class PatientConditionedDDI(nn.Module):
    """
    Unified Relational Graph Neural Network for Drug-Interaction Prediction
    with Patient-Conditioning and Cold-Start Generalization.
    """
    def __init__(
        self,
        in_dim: int = 2048,
        hidden_dim: int = 128,
        num_conditions: int = 100,
        num_patients: int = 10000,
        num_relations: int = 1,
        encoder_type: str = "rgcn",     # 'rgcn', 'gat', or 'gcn'
        use_attention: bool = True,      # False = mean pooling ablation
        dropout: float = 0.1
    ):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.encoder_type = encoder_type.lower()
        self.use_attention = use_attention

        # 1. Chemical Fingerprint Projection (for zero-shot molecular cold-start)
        self.mol_proj = MolecularProjection(in_dim, hidden_dim, dropout)

        # 2. Graph Encoder
        if self.encoder_type == "rgcn":
            self.conv1 = RGCNConv(hidden_dim, hidden_dim, num_relations=max(1, num_relations))
            self.conv2 = RGCNConv(hidden_dim, hidden_dim, num_relations=max(1, num_relations))
        elif self.encoder_type == "gat":
            self.conv1 = GATConv(hidden_dim, hidden_dim, heads=2, concat=False)
            self.conv2 = GATConv(hidden_dim, hidden_dim, heads=2, concat=False)
        else:
            self.conv1 = GCNConv(hidden_dim, hidden_dim)
            self.conv2 = GCNConv(hidden_dim, hidden_dim)

        self.dropout = nn.Dropout(dropout)
        self.norm1 = nn.LayerNorm(hidden_dim)
        self.norm2 = nn.LayerNorm(hidden_dim)

        # 3. Patient Layer Embeddings
        self.condition_emb = nn.Embedding(num_conditions, hidden_dim)
        self.patient_emb = nn.Embedding(num_patients, hidden_dim)

        # 4. Attention Mechanism
        if self.use_attention:
            self.attn = PatientSubgraphAttention(hidden_dim)
        else:
            self.attn = None

        # 5. Patient-Conditioned Link Decoder
        # Inputs: [z_a * z_b ; |z_a - z_b| ; z_a + z_b ; c_p] -> 4 * hidden_dim
        self.decoder = nn.Sequential(
            nn.Linear(4 * hidden_dim, 2 * hidden_dim),
            nn.LayerNorm(2 * hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(2 * hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, 1)
        )

        # Context-Free Decoder for Task A (standard pairwise DDI)
        # Inputs: [z_a * z_b ; |z_a - z_b| ; z_a + z_b] -> 3 * hidden_dim
        self.decoder_context_free = nn.Sequential(
            nn.Linear(3 * hidden_dim, 2 * hidden_dim),
            nn.LayerNorm(2 * hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(2 * hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, 1)
        )

    def encode_drugs(
        self,
        x_fp: torch.Tensor,
        edge_index: torch.Tensor,
        edge_type: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """
        Encode drugs using molecular fingerprint projection + 2-layer message passing.
        Residual connection ensures unseen drugs retain valid molecular representations.
        """
        # Initial node representations from molecular fingerprints
        h0 = self.mol_proj(x_fp)

        if self.encoder_type == "rgcn" and edge_type is None:
            edge_type = torch.zeros(edge_index.size(1), dtype=torch.long, device=edge_index.device)

        # Message passing layer 1
        if self.encoder_type == "rgcn":
            h1 = self.conv1(h0, edge_index, edge_type=edge_type)
        else:
            h1 = self.conv1(h0, edge_index)
        h1 = self.norm1(F.relu(h1))
        h1 = self.dropout(h1)

        # Message passing layer 2 with residual connection from h0
        if self.encoder_type == "rgcn":
            h2 = self.conv2(h1, edge_index, edge_type=edge_type)
        else:
            h2 = self.conv2(h1, edge_index)
        h2 = self.norm2(F.relu(h2))
        h2 = self.dropout(h2)

        # Residual skip connection preserving chemical prior
        z = h0 + h2
        return z

    def get_patient_context(
        self,
        patient_idx: int,
        condition_indices: List[int],
        medication_indices: List[int],
        drug_embeddings: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Build physiological context vector c_p via attention over active conditions and regimen.
        """
        device = drug_embeddings.device
        p_emb = self.patient_emb(torch.tensor(patient_idx, device=device))

        items = []
        if condition_indices:
            c_idx_t = torch.tensor(condition_indices, device=device, dtype=torch.long)
            items.append(self.condition_emb(c_idx_t))

        if medication_indices:
            m_idx_t = torch.tensor(medication_indices, device=device, dtype=torch.long)
            items.append(drug_embeddings[m_idx_t])

        if not items:
            return torch.zeros(self.hidden_dim, device=device), torch.empty(0, device=device)

        context_items = torch.cat(items, dim=0)  # [num_items, hidden_dim]

        if not self.use_attention:
            # Mean pooling ablation
            c_p = context_items.mean(dim=0)
            weights = torch.full((context_items.shape[0],), 1.0 / context_items.shape[0], device=device)
            return c_p, weights

        return self.attn(p_emb, context_items)

    def forward(
        self,
        z_drug: torch.Tensor,
        drug_pair: torch.Tensor,                     # [2, num_pairs]
        patient_context: Optional[torch.Tensor] = None # [hidden_dim] or [num_pairs, hidden_dim]
    ) -> torch.Tensor:
        """
        Decode pairwise interaction logits.
        If patient_context is None, uses context-free decoder (Task A).
        If patient_context is provided, conditions prediction on physiological context (Task B).
        """
        u, v = drug_pair[0], drug_pair[1]
        z_u, z_v = z_drug[u], z_drug[v]

        hadamard = z_u * z_v
        diff = torch.abs(z_u - z_v)
        sym_sum = z_u + z_v

        if patient_context is None:
            # Task A: Context-free DDI prediction
            pair_feat = torch.cat([hadamard, diff, sym_sum], dim=-1)
            logits = self.decoder_context_free(pair_feat).squeeze(-1)
        else:
            # Task B: Patient-conditioned prediction
            if patient_context.dim() == 1:
                c_p_expanded = patient_context.unsqueeze(0).expand(z_u.shape[0], -1)
            else:
                c_p_expanded = patient_context
            pair_feat = torch.cat([hadamard, diff, sym_sum, c_p_expanded], dim=-1)
            logits = self.decoder(pair_feat).squeeze(-1)

        return logits
