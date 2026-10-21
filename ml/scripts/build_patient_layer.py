"""
Build Phase 3 Patient Layer:
1. Generates 10,000 synthetic patient records (Synthea format: patients, conditions, medications, encounters).
2. Maps Synthea medications to DrugBank active ingredients and measures mapping coverage.
3. Constructs heterogeneous patient graph (Patient, Disease, Drug) with training-only DDI edges.
4. Generates Task B (controlled simulation with synthetic rules) evaluation pairs.
5. Saves execution statistics to results/patient_layer_statistics.json.
"""

import sys
import json
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd
import numpy as np
import torch

from ml.src.utils import get_logger, setup_cpu_threads, set_seed, RESULTS_DIR, DATA_DIR, CONFIGS_DIR
from ml.src.data.patient_layer import (
    generate_synthea_cohort,
    map_synthea_to_drugbank,
    PatientContextBuilder,
    compute_task_b_severity
)
from ml.src.data.loaders import load_drugbank

logger = get_logger("BuildPatientLayer")


def main():
    setup_cpu_threads(8)
    set_seed(42)
    start_time = time.time()

    logger.info("=== Phase 3: Building Patient Layer & Synthea Cohort ===")

    # 1. Generate 10,000-patient Synthea cohort
    synthea_dir = DATA_DIR / "synthea"
    cohort_files = generate_synthea_cohort(
        output_dir=synthea_dir,
        num_patients=10000,
        seed=42
    )

    # 2. Load DrugBank dataset for drug dictionary and training DDI graph
    logger.info("Loading DrugBank dataset...")
    drugbank_bundle = load_drugbank(data_dir=DATA_DIR, seed=42)
    drug_list = sorted(list(drugbank_bundle["drug_id_to_idx"].keys()))
    drug_id_to_idx = drugbank_bundle["drug_id_to_idx"]

    # 3. Map Synthea medications to DrugBank drugs
    logger.info("Mapping Synthea medications to DrugBank ingredients...")
    df_mapped_meds, mapping_stats = map_synthea_to_drugbank(
        medications_csv=cohort_files["medications"],
        drugbank_drugs=drug_list
    )
    mapped_csv = synthea_dir / "medications_mapped.csv"
    df_mapped_meds.to_csv(mapped_csv, index=False)

    # 4. Construct PatientContextBuilder
    logger.info("Constructing PatientContextBuilder and heterogeneous graph structures...")
    builder = PatientContextBuilder(
        conditions_csv=cohort_files["conditions"],
        df_mapped_meds=df_mapped_meds,
        drug_id_to_idx=drug_id_to_idx
    )

    # Read conditions for patient-condition stats
    df_conds = pd.read_csv(cohort_files["conditions"])
    num_unique_patients = len(set(df_mapped_meds["patient_id"]).union(set(df_conds["PATIENT"])))
    num_condition_nodes = builder.num_conditions
    num_drug_nodes = len(drug_list)
    has_condition_edges = len(df_conds)
    takes_drug_edges = len(df_mapped_meds)

    # Training DDI edges from S1 (strictly train edges only to avoid leakage)
    s1_train_edges = drugbank_bundle["splits"]["S1"]["train"]["pos_edge"].shape[0]

    # 5. Build Task B evaluation dataset
    # Sample 10,000 (patient, drug_pair) queries with synthetic physiological context labels
    logger.info("Synthesizing Task B patient-conditioned evaluation dataset (rule-based simulation)...")
    rng = np.random.default_rng(42)

    # S1 test positive pairs
    test_pos_pairs = drugbank_bundle["splits"]["S1"]["test"]["pos_edge"].numpy()
    num_test_pairs = len(test_pos_pairs)

    idx_to_drug_id = drugbank_bundle["idx_to_drug_id"]
    active_patients = builder.patient_list

    # Sample queries across active patients
    task_b_records = []
    amplified_count = 0

    df_conds_lookup = df_conds.groupby("PATIENT")["DESCRIPTION"].apply(list).to_dict()

    # Create mapping from DB ID to drug name for rule evaluation
    db_id_to_name = {
        "DB00722": "lisinopril", "DB00331": "metformin", "DB01076": "atorvastatin",
        "DB01050": "ibuprofen", "DB00381": "amlodipine", "DB00682": "warfarin",
        "DB00695": "furosemide", "DB00338": "omeprazole", "DB00537": "ciprofloxacin",
        "DB01104": "sertraline", "DB01001": "albuterol", "DB00945": "aspirin",
        "DB00788": "naproxen", "DB00635": "prednisone", "DB00264": "metoprolol",
        "DB00421": "spironolactone"
    }

    # For Task B, construct queries that test whether the model detects patient-specific risk amplification:
    # 1. Target pairs with rule drugs paired with matching condition patients vs non-matching condition patients
    target_rule_pairs = []
    # Known interacting drug indices for rule drugs
    rule_drug_indices = [drug_id_to_idx[db_id] for db_id in db_id_to_name.keys() if db_id in drug_id_to_idx]
    
    # Positive pairs in test set or full dataset involving rule drugs
    all_pos_pairs = drugbank_bundle["splits"]["S1"]["test"]["pos_edge"].numpy()
    for u, v in all_pos_pairs:
        if u in rule_drug_indices or v in rule_drug_indices:
            target_rule_pairs.append((int(u), int(v)))

    # Also add known high-risk pairs directly from training/test
    high_risk_db_pairs = [
        ("DB00722", "DB01050"), # Lisinopril + Ibuprofen
        ("DB00682", "DB01050"), # Warfarin + Ibuprofen
        ("DB00682", "DB00945"), # Warfarin + Aspirin
        ("DB00682", "DB00788"), # Warfarin + Naproxen
        ("DB00331", "DB00635"), # Metformin + Prednisone
        ("DB00264", "DB00381"), # Metoprolol + Amlodipine
        ("DB00537", "DB00682"), # Ciprofloxacin + Warfarin
        ("DB00421", "DB00722"), # Spironolactone + Lisinopril
    ]
    for d1_db, d2_db in high_risk_db_pairs:
        if d1_db in drug_id_to_idx and d2_db in drug_id_to_idx:
            target_rule_pairs.append((drug_id_to_idx[d1_db], drug_id_to_idx[d2_db]))

    target_rule_pairs = list(set(target_rule_pairs))

    # Evaluate across a variety of patients (both patients with qualifying conditions and clean patients)
    for u, v in target_rule_pairs:
        d1_id = idx_to_drug_id[u]
        d2_id = idx_to_drug_id[v]
        d1_name = db_id_to_name.get(d1_id, d1_id)
        d2_name = db_id_to_name.get(d2_id, d2_id)

        # Sample 5 patients for each pair: some with condition, some without
        sampled_patients = rng.choice(active_patients, size=min(10, len(active_patients)), replace=False)
        for pid in sampled_patients:
            p_conds = df_conds_lookup.get(pid, [])
            multiplier, triggered = compute_task_b_severity(p_conds, d1_name, d2_name)
            if multiplier > 1.0:
                amplified_count += 1

            task_b_records.append({
                "patient_id": pid,
                "drug_1_idx": int(u),
                "drug_2_idx": int(v),
                "drug_1_id": d1_id,
                "drug_2_id": d2_id,
                "base_label": 1,
                "severity_multiplier": multiplier,
                "triggered_rules": ",".join(triggered)
            })

    # Add 1000 general background test pairs
    for i in range(min(1000, len(test_pos_pairs))):
        pid = active_patients[i % len(active_patients)]
        u, v = test_pos_pairs[i]
        d1_id = idx_to_drug_id[u]
        d2_id = idx_to_drug_id[v]
        d1_name = db_id_to_name.get(d1_id, d1_id)
        d2_name = db_id_to_name.get(d2_id, d2_id)

        p_conds = df_conds_lookup.get(pid, [])
        multiplier, triggered = compute_task_b_severity(p_conds, d1_name, d2_name)
        if multiplier > 1.0:
            amplified_count += 1

        task_b_records.append({
            "patient_id": pid,
            "drug_1_idx": int(u),
            "drug_2_idx": int(v),
            "drug_1_id": d1_id,
            "drug_2_id": d2_id,
            "base_label": 1,
            "severity_multiplier": multiplier,
            "triggered_rules": ",".join(triggered)
        })

    logger.info(f"Task B Dataset: {len(task_b_records)} queries, {amplified_count} amplified by physiological context rules ({round((amplified_count/len(task_b_records))*100, 2)}%).")

    task_b_df = pd.DataFrame(task_b_records)
    task_b_path = DATA_DIR / "task_b_dataset.csv"
    task_b_df.to_csv(task_b_path, index=False)

    wall_time = round(time.time() - start_time, 2)

    # 6. Summary Statistics File
    patient_layer_stats = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "wall_time_seconds": wall_time,
        "cohort": {
            "num_patients": 10000,
            "active_patients_with_data": len(active_patients),
            "num_condition_nodes": num_condition_nodes,
            "num_drug_nodes": num_drug_nodes,
            "has_condition_edges": has_condition_edges,
            "takes_drug_edges": takes_drug_edges,
            "training_ddi_edges": int(s1_train_edges)
        },
        "mapping": mapping_stats,
        "task_b": {
            "num_test_queries": len(task_b_records),
            "amplified_queries": amplified_count,
            "amplification_pct": round((amplified_count / len(task_b_records)) * 100, 2),
            "label_type": "SYNTHETIC_RULE_BASED"
        }
    }

    stats_file = RESULTS_DIR / "patient_layer_statistics.json"
    with open(stats_file, "w", encoding="utf-8") as f:
        json.dump(patient_layer_stats, f, indent=2)

    logger.info(f"Phase 3 Patient Layer complete in {wall_time}s. Saved statistics to {stats_file}.")


if __name__ == "__main__":
    main()
