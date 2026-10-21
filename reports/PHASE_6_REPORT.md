# Phase 6 Report: Standalone FastAPI DDI Inference Microservice

**Date:** October 12, 2026  
**Authors:** Yash Khose (23BCE0625) & Tanish Chawla (23BCE0502)  
**System Hardware:** CPU Only (20 Cores, 16 GB RAM, 8 PyTorch Threads)  
**Service Root:** `ml_service/`  
**Test Suite:** `ml_service/tests/` (6/6 passing)  

---

## 1. Executive Summary

Phase 6 implements and validates the standalone clinical inference service (`ml_service/app.py`). Designed for deployment within hospital networks, the service provides sub-second, patient-conditioned DDI risk evaluation over REST APIs without requiring the full training pipeline or raw dataset files.

### Key Operational Capabilities:
- **Zero-Shot Inductive Cold Start:** When presented with an unseen, novel, or formulary-updated drug, the service extracts 2048-bit Morgan chemical fingerprints on the fly using RDKit, projects through the molecular projection layer, and evaluates interactions without topological retraining.
- **Fail-Safe Fallback:** If an unmapped compound is submitted without SMILES, the service gracefully degrades to clinical heuristic rule evaluation rather than crashing.
- **Clinical Attention Weight Delivery:** Returns the normalized attention distribution over patient diagnoses and existing regimen for immediate visual display in the physician's electronic health record.

---

## 2. API Contract & Endpoint Specification

### `GET /health`
Probe verifying service liveness, PyTorch CPU thread count, and model readiness:
```json
{
  "status": "ok",
  "service": "Smart HIS DDI Risk Service",
  "model_version": "1.0.0",
  "device": "cpu",
  "threads": 8,
  "model_loaded": true
}
```

### `POST /score`
Primary prescription-time inference endpoint:
- **Input Payload:**
  - `patient_id`: Unique identifier (e.g., `"P_TEST_001"`)
  - `new_drug_name`: Candidate prescribed drug (e.g., `"Ibuprofen"`)
  - `new_drug_smiles`: Canonical SMILES string (optional, for novel compounds)
  - `current_meds`: Array of active medications (e.g., `["Lisinopril", "Metformin"]`)
  - `diagnoses`: Array of active conditions (e.g., `["Chronic kidney disease stage 3"]`)
- **Output Response:**
  - `max_risk_score`: Calibrated interaction probability ($[0.0, 1.0]$)
  - `max_risk_level`: Categorical alert level (`"LOW"`, `"MODERATE"`, `"HIGH"`, `"CRITICAL"`)
  - `interactions`: Array of pair-specific risk evaluations with clinical explanations and rule triggers.
  - `attention_weights`: Map of patient conditions and medications to their attention fractions.
  - `inference_time_ms`: Wall-clock latency in milliseconds.
  - `cold_start`: Boolean indicating whether inductive fingerprint projection was invoked.
  - `disclaimer`: `"Research prototype. Not for clinical diagnostic or prescribing use."`

---

## 3. Automated Test Suite & Latency SLA Verification

All 6 automated tests in `ml_service/tests/` passed:

| Test Name | File | Purpose | Result |
| :--- | :--- | :--- | :---: |
| `test_health_endpoint` | `test_service.py` | Verify probe status, device, and threads | **PASSED** |
| `test_score_valid_prescription` | `test_service.py` | Test CKD + Lisinopril + Ibuprofen elevation | **PASSED** |
| `test_score_unseen_drug_with_smiles` | `test_service.py` | Test zero-shot inductive cold start | **PASSED** |
| `test_score_unseen_drug_without_smiles`| `test_service.py` | Test graceful fallback for unmapped drugs | **PASSED** |
| `test_score_empty_medication_list` | `test_service.py` | Test edge case with zero ongoing medications | **PASSED** |
| `test_service_latency_sla_100_runs` | `test_latency.py` | Profile 100 consecutive requests on CPU | **PASSED** |

### Benchmark Latency Results (100 Consecutive Requests):
- **Median ($p50$):** **18.39 ms**
- **95th Percentile ($p95$):** **22.25 ms**
- **99th Percentile ($p99$):** **23.81 ms**
- **Target SLA ($< 100$ ms):** **Met with 77.75 ms safety margin (4.5x faster than threshold).**

---

## 4. Standalone Service Artifacts

Exported standalone to `ml_service/artifacts/` (no external dataset dependency):
1. `best_model.pt`: Pytorch checkpoint with architecture metadata and trained weights.
2. `precomputed_drug_embeddings.npy`: Precomputed 128-dimensional drug embeddings for instant $O(1)$ lookup.
3. `vocabularies.json`: Canonical active ingredient mappings and condition dictionaries.
4. `context_rules.yaml`: 8 evidence-based physiological severity modulation rules.
5. `temperature_scaler.json`: Fitted post-hoc calibration parameter ($T=1.45$).

Phase 6 complete. Proceeding to Phase 7: Full HIS Application Integration.
