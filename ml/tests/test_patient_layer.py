"""
Unit tests for Phase 3 Patient Layer.
Verifies Synthea generation, ingredient mapping, patient context extraction,
and Task B rule-based modifier execution.
"""

import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pytest
import pandas as pd

from ml.src.data.patient_layer import (
    generate_synthea_cohort,
    map_synthea_to_drugbank,
    PatientContextBuilder,
    compute_task_b_severity,
    load_mimic_iv_skeleton
)


@pytest.fixture(scope="module")
def synthea_test_cohort(tmp_path_factory):
    """Generate a small 100-patient test cohort."""
    temp_dir = tmp_path_factory.mktemp("synthea_test")
    cohort_paths = generate_synthea_cohort(output_dir=temp_dir, num_patients=100, seed=42)
    return cohort_paths, temp_dir


def test_synthea_generation_integrity(synthea_test_cohort):
    """Verify generated cohort matches required Synthea schemas."""
    cohort_paths, _ = synthea_test_cohort
    df_p = pd.read_csv(cohort_paths["patients"])
    df_c = pd.read_csv(cohort_paths["conditions"])
    df_m = pd.read_csv(cohort_paths["medications"])
    df_e = pd.read_csv(cohort_paths["encounters"])

    assert len(df_p) == 100
    assert set(["Id", "BIRTHDATE", "GENDER", "RACE"]).issubset(df_p.columns)
    assert set(["PATIENT", "CODE", "DESCRIPTION"]).issubset(df_c.columns)
    assert set(["PATIENT", "CODE", "DESCRIPTION"]).issubset(df_m.columns)
    assert set(["Id", "PATIENT", "CODE", "REASONDESCRIPTION"]).issubset(df_e.columns)


def test_ingredient_mapping_coverage(synthea_test_cohort):
    """Test Synthea medication mapping to DrugBank ingredient vocabulary."""
    cohort_paths, _ = synthea_test_cohort
    drugbank_drugs = ["lisinopril", "metformin", "ibuprofen", "aspirin", "atorvastatin", "warfarin"]

    df_mapped, stats = map_synthea_to_drugbank(cohort_paths["medications"], drugbank_drugs)
    assert stats["row_coverage_pct"] > 0
    assert len(df_mapped) > 0
    assert "patient_id" in df_mapped.columns
    assert "normalized_drug" in df_mapped.columns


def test_patient_context_builder(synthea_test_cohort):
    """Verify local subgraph extraction for an arbitrary patient."""
    cohort_paths, _ = synthea_test_cohort
    drugbank_drugs = ["lisinopril", "metformin", "ibuprofen", "aspirin"]
    drug_id_to_idx = {d: i for i, d in enumerate(drugbank_drugs)}

    df_mapped, _ = map_synthea_to_drugbank(cohort_paths["medications"], drugbank_drugs)
    builder = PatientContextBuilder(cohort_paths["conditions"], df_mapped, drug_id_to_idx)

    assert len(builder.patient_list) > 0
    test_pid = builder.patient_list[0]
    ctx = builder.get_patient_context(test_pid)

    assert ctx["patient_id"] == test_pid
    assert isinstance(ctx["condition_indices"], list)
    assert isinstance(ctx["current_drug_indices"], list)


def test_task_b_context_rule_severity():
    """Verify that physiological condition presence raises interaction severity."""
    # Test case 1: Patient with chronic kidney disease taking Lisinopril + Ibuprofen
    conds = ["Chronic kidney disease stage 3", "Essential hypertension"]
    mult, rules = compute_task_b_severity(conds, "lisinopril", "ibuprofen")
    assert mult > 1.5, f"Expected severity amplification for renal + ACEI + NSAID, got {mult}"
    assert "R1_RENAL_NSAID_ACEI" in rules

    # Test case 2: Patient with no kidney disease taking the same pair
    conds_clean = ["Asthma", "Hyperlipidemia"]
    mult_clean, rules_clean = compute_task_b_severity(conds_clean, "lisinopril", "ibuprofen")
    assert mult_clean == 1.0, f"Expected no amplification without renal condition, got {mult_clean}"
    assert len(rules_clean) == 0


def test_task_c_mimic_skeleton_flag():
    """Verify MIMIC-IV loader returns None when use_mimic is False."""
    res = load_mimic_iv_skeleton(use_mimic=False)
    assert res is None
