"""
Unit tests for PatientConditionedDDI model architecture.
Verifies molecular fingerprint projection, RGCN/GAT encoding,
neighborhood attention over patient context, context-free decoding,
and inductive cold-start representations.
"""

import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pytest
import torch
from ml.src.models.patient_ddi import PatientConditionedDDI


@pytest.fixture
def dummy_ddi_data():
    num_drugs = 20
    num_conditions = 10
    num_patients = 50
    hidden_dim = 64

    # Fake fingerprints: 20 drugs with 2048-bit fingerprints
    x_fp = torch.randint(0, 2, (num_drugs, 2048)).float()

    # Drug interaction edge index (first 15 drugs only, last 5 are cold-start unseen)
    edges = []
    for i in range(14):
        edges.append([i, i + 1])
        edges.append([i + 1, i])
    edge_index = torch.tensor(edges, dtype=torch.long).t()

    return {
        "x_fp": x_fp,
        "edge_index": edge_index,
        "num_drugs": num_drugs,
        "num_conditions": num_conditions,
        "num_patients": num_patients,
        "hidden_dim": hidden_dim
    }


def test_model_initialization(dummy_ddi_data):
    model = PatientConditionedDDI(
        in_dim=2048,
        hidden_dim=dummy_ddi_data["hidden_dim"],
        num_conditions=dummy_ddi_data["num_conditions"],
        num_patients=dummy_ddi_data["num_patients"],
        encoder_type="rgcn"
    )
    assert model is not None
    assert isinstance(model, torch.nn.Module)


def test_drug_encoding_and_cold_start(dummy_ddi_data):
    """Test that message passing encodes seen drugs and cold-start unseen drugs."""
    model = PatientConditionedDDI(
        in_dim=2048,
        hidden_dim=dummy_ddi_data["hidden_dim"],
        num_conditions=dummy_ddi_data["num_conditions"],
        num_patients=dummy_ddi_data["num_patients"],
        encoder_type="rgcn"
    )
    z = model.encode_drugs(dummy_ddi_data["x_fp"], dummy_ddi_data["edge_index"])

    assert z.shape == (dummy_ddi_data["num_drugs"], dummy_ddi_data["hidden_dim"])
    # Check that unseen drug (index 18) has non-zero representation from Morgan fingerprint
    assert not torch.allclose(z[18], torch.zeros(dummy_ddi_data["hidden_dim"]))


def test_context_free_prediction(dummy_ddi_data):
    """Test Task A prediction without patient context."""
    model = PatientConditionedDDI(
        in_dim=2048,
        hidden_dim=dummy_ddi_data["hidden_dim"],
        num_conditions=dummy_ddi_data["num_conditions"],
        num_patients=dummy_ddi_data["num_patients"]
    )
    z = model.encode_drugs(dummy_ddi_data["x_fp"], dummy_ddi_data["edge_index"])

    # Test pair (drug 0, drug 5)
    pairs = torch.tensor([[0, 2], [5, 7]], dtype=torch.long)
    logits = model(z, pairs, patient_context=None)

    assert logits.shape == (2,)
    assert not torch.isnan(logits).any()


def test_patient_attention_and_conditioned_prediction(dummy_ddi_data):
    """Test Task B prediction with patient context attention."""
    model = PatientConditionedDDI(
        in_dim=2048,
        hidden_dim=dummy_ddi_data["hidden_dim"],
        num_conditions=dummy_ddi_data["num_conditions"],
        num_patients=dummy_ddi_data["num_patients"]
    )
    z = model.encode_drugs(dummy_ddi_data["x_fp"], dummy_ddi_data["edge_index"])

    c_p, weights = model.get_patient_context(
        patient_idx=3,
        condition_indices=[1, 4],
        medication_indices=[0, 2],
        drug_embeddings=z
    )

    assert c_p.shape == (dummy_ddi_data["hidden_dim"],)
    assert weights.shape == (4,)
    assert torch.isclose(weights.sum(), torch.tensor(1.0), atol=1e-4)

    pairs = torch.tensor([[1], [3]], dtype=torch.long)
    logits = model(z, pairs, patient_context=c_p)
    assert logits.shape == (1,)
    assert not torch.isnan(logits).any()


def test_gat_and_mean_pooling_ablations(dummy_ddi_data):
    """Verify architectural ablations (GAT encoder & mean pooling)."""
    model_gat = PatientConditionedDDI(
        in_dim=2048,
        hidden_dim=dummy_ddi_data["hidden_dim"],
        num_conditions=dummy_ddi_data["num_conditions"],
        num_patients=dummy_ddi_data["num_patients"],
        encoder_type="gat",
        use_attention=False
    )
    z = model_gat.encode_drugs(dummy_ddi_data["x_fp"], dummy_ddi_data["edge_index"])
    assert z.shape == (dummy_ddi_data["num_drugs"], dummy_ddi_data["hidden_dim"])

    c_p, weights = model_gat.get_patient_context(
        patient_idx=0,
        condition_indices=[2],
        medication_indices=[1],
        drug_embeddings=z
    )
    assert c_p.shape == (dummy_ddi_data["hidden_dim"],)
    assert len(weights) == 2
