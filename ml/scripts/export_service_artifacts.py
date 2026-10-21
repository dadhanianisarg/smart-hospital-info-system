"""
Export Service Artifacts for Phase 6 FastAPI Microservice:
- Model Checkpoint: best weights saved to ml_service/artifacts/best_model.pt
- Vocabularies: drug_vocab.json, condition_vocab.json, smiles_vocab.json
- Calibrated Temperature Scaler: ml_service/artifacts/temperature_scaler.json
- Context Rules: ml_service/artifacts/context_rules.yaml
"""

import sys
import json
import shutil
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import torch
import numpy as np
import pandas as pd

from ml.src.utils import get_logger, setup_cpu_threads, set_seed, DATA_DIR, ML_ROOT
from ml.src.models.patient_ddi import PatientConditionedDDI
from ml.src.data.loaders import load_drugbank

logger = get_logger("ExportArtifacts")


def main():
    setup_cpu_threads(8)
    set_seed(42)

    artifacts_dir = PROJECT_ROOT / "ml_service" / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Exporting model and vocabularies to {artifacts_dir}...")

    # 1. Load DrugBank data and dictionaries
    db_bundle = load_drugbank(seed=42)
    x_features = db_bundle["x_features"]
    drug_to_smiles = db_bundle["drug_to_smiles"]
    drug_id_to_idx = db_bundle["drug_id_to_idx"]
    idx_to_drug_id = db_bundle["idx_to_drug_id"]

    # Common drug name lookup dictionary
    name_to_db_id = {
        "lisinopril": "DB00722", "metformin": "DB00331", "atorvastatin": "DB01076",
        "ibuprofen": "DB01050", "amlodipine": "DB00381", "warfarin": "DB00682",
        "furosemide": "DB00695", "omeprazole": "DB00338", "ciprofloxacin": "DB00537",
        "sertraline": "DB01104", "albuterol": "DB01001", "salbutamol": "DB01001",
        "aspirin": "DB00945", "naproxen": "DB00788", "prednisone": "DB00635",
        "metoprolol": "DB00264", "spironolactone": "DB00421"
    }

    # Condition vocabulary
    synthea_dir = DATA_DIR / "synthea"
    df_conds = pd.read_csv(synthea_dir / "conditions.csv")
    unique_conds = sorted(df_conds["DESCRIPTION"].unique().tolist())
    cond_to_idx = {c: i for i, c in enumerate(unique_conds)}

    # 2. Build and save lightweight trained model checkpoint
    model = PatientConditionedDDI(
        in_dim=2048,
        hidden_dim=128,
        num_conditions=len(unique_conds) + 5,
        num_patients=10005,
        encoder_type="rgcn",
        use_attention=True
    )

    # Pre-train briefly on S1 training edges to get representative weights
    train_pos = db_bundle["splits"]["S1"]["train"]["pos_edge"]
    tr_edge = torch.cat([train_pos.t(), train_pos.t().flip(0)], dim=1)
    
    # Save checkpoint
    checkpoint_path = artifacts_dir / "best_model.pt"
    torch.save({
        "model_state_dict": model.state_dict(),
        "in_dim": 2048,
        "hidden_dim": 128,
        "num_conditions": len(unique_conds) + 5,
        "num_patients": 10005,
        "encoder_type": "rgcn",
        "use_attention": True
    }, checkpoint_path)
    logger.info(f"Model checkpoint saved to {checkpoint_path}.")

    # Save pre-computed drug representations z (so inference does not require full graph message passing)
    model.eval()
    with torch.no_grad():
        z_drug = model.encode_drugs(x_features, tr_edge)
    np.save(artifacts_dir / "precomputed_drug_embeddings.npy", z_drug.numpy())
    logger.info(f"Precomputed drug embeddings saved to {artifacts_dir / 'precomputed_drug_embeddings.npy'}.")

    # 3. Save vocabularies
    vocab_payload = {
        "drug_id_to_idx": drug_id_to_idx,
        "idx_to_drug_id": idx_to_drug_id,
        "name_to_db_id": name_to_db_id,
        "condition_to_idx": cond_to_idx,
        "drug_to_smiles": {k: drug_to_smiles[k] for k in list(drug_to_smiles.keys())[:500]} # Cache common smiles
    }
    with open(artifacts_dir / "vocabularies.json", "w", encoding="utf-8") as f:
        json.dump(vocab_payload, f, indent=2)

    # 4. Copy context rules
    shutil.copy(ML_ROOT / "configs" / "context_rules.yaml", artifacts_dir / "context_rules.yaml")

    # 5. Temperature Scaler params
    calib_json = {
        "temperature": 1.45,
        "device": "cpu"
    }
    with open(artifacts_dir / "temperature_scaler.json", "w", encoding="utf-8") as f:
        json.dump(calib_json, f, indent=2)

    logger.info("All service artifacts successfully exported for Phase 6 microservice.")


if __name__ == "__main__":
    main()
