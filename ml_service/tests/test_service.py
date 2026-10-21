"""
Unit tests for Phase 6 FastAPI DDI Risk Check Microservice.
Verifies /health, /score, cold-start with and without SMILES,
empty medication lists, and latency threshold.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pytest
from fastapi.testclient import TestClient
from ml_service.app import app

client = TestClient(app)


def test_health_endpoint():
    """Verify health probe returns status ok and CPU device."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["device"] == "cpu"
    assert data["threads"] >= 1


def test_score_valid_prescription():
    """Verify patient-conditioned risk score for Lisinopril + Ibuprofen in CKD patient."""
    payload = {
        "patient_id": "P_TEST_001",
        "new_drug_name": "Ibuprofen",
        "current_meds": ["Lisinopril", "Metformin"],
        "diagnoses": ["Chronic kidney disease stage 3", "Essential hypertension"]
    }
    response = client.post("/score", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["patient_id"] == "P_TEST_001"
    assert len(data["interactions"]) == 2
    assert data["max_risk_score"] > 0.50
    assert data["max_risk_level"] in ["HIGH", "CRITICAL", "MODERATE"]
    assert "Chronic kidney disease stage 3" in data["attention_weights"]
    assert data["inference_time_ms"] < 200.0 # Sub-200ms latency


def test_score_unseen_drug_with_smiles():
    """Verify zero-shot inductive cold start for novel compound with SMILES."""
    payload = {
        "patient_id": "P_TEST_002",
        "new_drug_name": "Novel_Experimental_Inhibitor",
        "new_drug_smiles": "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O", # Ibuprofen SMILES as proxy
        "current_meds": ["Warfarin"],
        "diagnoses": ["History of gastrointestinal hemorrhage"]
    }
    response = client.post("/score", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["cold_start"] is True
    assert len(data["interactions"]) == 1


def test_score_unseen_drug_without_smiles():
    """Verify safe fallback for unknown compound without SMILES."""
    payload = {
        "patient_id": "P_TEST_003",
        "new_drug_name": "UnknownMoleculeXYZ",
        "current_meds": ["Metformin"],
        "diagnoses": ["Type 2 diabetes mellitus"]
    }
    response = client.post("/score", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["cold_start"] is True


def test_score_empty_medication_list():
    """Verify clean response when patient has no current medications."""
    payload = {
        "patient_id": "P_TEST_004",
        "new_drug_name": "Amoxicillin",
        "current_meds": [],
        "diagnoses": ["Asthma"]
    }
    response = client.post("/score", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["interactions"]) == 0
    assert data["max_risk_score"] == 0.0
    assert data["max_risk_level"] == "LOW"
