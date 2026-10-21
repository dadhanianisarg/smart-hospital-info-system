# Phase 0 Report: Audit, Architecture Analysis, and Environment Setup

**Project:** Patient-Conditioned Drug-Interaction Risk Prediction with Relational Graph Neural Networks and Cold-Start Generalization  
**Authors:** Yash Khose (23BCE0625), Tanish Chawla (23BCE0502)  
**Date:** 2026-10-12  
**Status:** COMPLETE (Awaiting user approval to proceed to Phase 1)

---

## 1. Existing HIS Codebase Audit

We performed a deep code audit across the Hospital Information System repository (`server/` and `client/`):

### A. MongoDB Document Persistence
Clinical and administrative entities are modeled as Mongoose schemas under `server/src/models/`:
- **`Patient` (`server/src/models/Patient.js`):** Stores demographic profiles with indexed unique `patientId`. Features an embedded `address` subdocument (`street`, `city`, `state`, `zipCode`) and a polymorphic `medicalHistory` array (`[{ disease, diagnosedYear, notes }]`).
- **`Doctor` (`server/src/models/Doctor.js`):** Profiles indexed on unique `doctorId` with foreign reference key `departmentId`.
- **`Department` (`server/src/models/Department.js`):** Indexed on unique `departmentId`.
- **`Disease` (`server/src/models/Disease.js`):** Pathological diagnostic catalog indexed on unique `diseaseId`.
- **`Medicine` (`server/src/models/Medicine.js`):** Pharmaceutical formulary catalog indexed on unique `medicineId` with therapeutic categorization.
- **`Appointment` (`server/src/models/Appointment.js`):** Relational links between `patientId` and `doctorId`.
- **`Prescription` (`server/src/models/Prescription.js`):** Embeds an array of medication orders:
  ```javascript
  medicines: [{
    medicineId: { type: String, required: true },
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    duration: { type: String, required: true }
  }]
  ```

### B. Neo4j Graph Persistence
Graph topology is managed through `server/src/services/neo4jService.js` and `server/src/controllers/graphController.js`:
- **Nodes:** `(:Patient)`, `(:Doctor)`, `(:Department)`, `(:Disease)`, `(:Medicine)`.
- **Edges:**
  - `(:Doctor)-[:BELONGS_TO]->(:Department)`
  - `(:Patient)-[:TREATED_BY]->(:Doctor)`
  - `(:Patient)-[:DIAGNOSED_WITH {diagnosedYear}]->(:Disease)`
  - `(:Doctor)-[:TREATS]->(:Disease)`
  - `(:Doctor)-[:PRESCRIBED {dosage}]->(:Medicine)`
  - `(:Patient)-[:TAKES]->(:Medicine)`
- **Resilience Engine:** Features an in-memory graph fallback store (`memoryGraph`) that simulates full Cypher traversals in Node.js when a standalone Neo4j daemon is not listening on port 7687.

### C. Express Route Architecture & Prescription Endpoint
- **API Base:** `http://localhost:5000/api`
- **Route Definitions:** Modular Express routers mounted in `server/src/app.js`:
  - `/api/patients` $\rightarrow$ `patientRoutes.js`
  - `/api/doctors` $\rightarrow$ `doctorRoutes.js`
  - `/api/departments` $\rightarrow$ `departmentRoutes.js`
  - `/api/appointments` $\rightarrow$ `appointmentRoutes.js`
  - `/api/prescriptions` $\rightarrow$ `prescriptionRoutes.js`
  - `/api/diseases` $\rightarrow$ `diseaseRoutes.js`
  - `/api/medicines` $\rightarrow$ `medicineRoutes.js`
  - `/api/graph` $\rightarrow$ `graphRoutes.js`
- **Prescription Creation Injection Point:**
  - **Route:** `POST /api/prescriptions` (declared in `server/src/routes/prescriptionRoutes.js#L14`).
  - **Controller Handler:** `prescriptionController.createPrescription` (`server/src/controllers/prescriptionController.js#L5-L44`).
  - **Workflow:** Takes `{ prescriptionId, patientId, doctorId, date, medicines: [...], instructions }`, performs MongoDB document insertion, and establishes dual-write edges in Neo4j (`[:PRESCRIBED]`, `[:TAKES]`, and `[:TREATED_BY]`).
  - **Phase 7 Integration Target:** In Phase 7, the non-blocking patient risk check (`POST /api/risk/check`) will hook directly into this route's frontend workflow before prescription submission.

---

## 2. Python Environment & Dependency Setup

Per Global Rule 1 and Phase 0 specifications, we established an isolated Python 3.10 virtual environment:

- **Python Runtime:** Python 3.10.11 (64-bit on Windows x64).
- **Environment Path:** `ml/venv/` (configured in `.gitignore`).
- **Core Packages Installed & Pinned in `ml/requirements.txt`:**
  - `torch==2.14.1+cpu` (Official PyTorch CPU build via PyTorch index)
  - `torch_geometric==2.8.1`
  - `ogb==1.3.6`
  - `pytdc==1.1.15`
  - `rdkit==2026.9.1`
  - `scikit-learn==1.7.2`
  - `pandas==2.3.3`
  - `numpy==2.2.6`
  - `pyyaml==6.0.3`
  - `matplotlib==3.10.9`
  - `scipy==1.15.3`
  - `fastapi==0.143.0`
  - `uvicorn==0.54.0`
  - `pytest==9.1.1`
- **Windows Platform Compatibility Fix:** In `pytdc 1.1.15`, the `multi_pred/__init__.py` file unconditionally imported `perturboutcome.py`, which pulls in `tiledbsoma` (a single-cell RNA package with no Windows binary wheels). We gracefully wrapped this optional import in a `try...except` block, enabling `from tdc.multi_pred import DDI` to import flawlessly on Windows.

---

## 3. Repository Scaffolding & Utility Infrastructure

Created the complete target directory layout:
```
ml/
├── configs/          # Experiment configuration YAMLs
├── data/             # Benchmark datasets (ogbl-ddi, DrugBank, TWOSIDES) - gitignored
├── src/
│   ├── data/         # Data loaders, split generators, feature builders
│   ├── models/       # GNN encoders, decoders, and baselines
│   ├── utils.py      # Seeding (0-4), CPU thread enforcement (8), JSON results recorder
│   ├── train.py      # Training pipeline
│   ├── evaluate.py   # Metric evaluation
│   └── metrics.py    # AUROC, AUPRC, Hits@K, ECE
├── scripts/          # Reproducible experiment runner scripts
├── tests/            # Automated test suite
└── requirements.txt  # Pinned dependency manifest
results/              # Verifiable JSON execution logs & metrics (Global Rule 2)
figures/              # Publication figures (PDF & PNG)
reports/              # Progress reports & LIMITATIONS.md
ml_service/           # FastAPI inference microservice
Makefile              # make setup / data / baselines / main / reproduce
```

### Core Utility (`ml/src/utils.py`) Highlights
- **Thread Enforcement:** `setup_cpu_threads(8)` enforces `torch.set_num_threads(8)`, `OMP_NUM_THREADS=8`, and `MKL_NUM_THREADS=8`.
- **Reproducibility:** `set_seed(seed)` deterministically synchronizes `random`, `numpy`, and `torch`.
- **Auditable Result Logging:** `save_result_json()` captures the active git commit hash, configuration parameters, metrics dictionary, wall-clock time, and thread configuration to `results/`.
- **Limitations Catalog:** Initialized `reports/LIMITATIONS.md` documenting CPU capacity boundaries, negative sampling open-world semantics, and task distinctions.

---

## 4. Phase 0 Smoke Test Execution & Verification

We authored `ml/tests/test_smoke.py` and executed the test suite via `pytest`:

```text
============================= test session starts =============================
platform win32 -- Python 3.10.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Projects\Smart-Hospital-Information-System\ml\venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: C:\Projects\Smart-Hospital-Information-System
plugins: anyio-4.15.1
collecting ... collected 3 items

ml/tests/test_smoke.py::test_library_imports PASSED
ml/tests/test_smoke.py::test_cpu_threading 
[SmokeTest] PyTorch CPU thread count: 8
PASSED
ml/tests/test_smoke.py::test_gnn_forward_backward_pass 
[SmokeTest] GNN forward pass successful: loss = 0.7058
[SmokeTest] GNN backward pass successful: gradients verified across all layers
[SmokeTest] Device verified: cpu (CPU only)
PASSED

======================= 3 passed, 2 warnings in 14.91s ========================
```

### Verification Criteria Met:
1. All 14 scientific, ML, and API packages imported cleanly.
2. PyTorch CPU thread count confirmed locked to 8 threads.
3. Constructed synthetic graph with PyTorch Geometric (`Data(x=[10, 64], edge_index=[2, 16])`).
4. Successfully ran 2-layer GNN (`GCNConv` + `SAGEConv`) forward pass with finite loss (`0.7058`), followed by backward pass computing valid gradients across all model parameters on CPU.

---

## 5. Next Steps (Phase 1 Readiness)

Phase 0 is complete. Upon your approval, we will proceed to **Phase 1: Datasets**:
1. Ingest **`ogbl-ddi`** via `ogb.linkproppred.PygLinkPropPredDataset`.
2. Ingest **DrugBank DDI** via `tdc.multi_pred.ddi.DDI('DrugBank')` (caching locally and documenting license).
3. Ingest **TWOSIDES** via PyTDC (restricting to top $N=20$ adverse effect relation types to respect 16 GB RAM limits).
4. Extract 2048-bit Morgan fingerprints via RDKit from SMILES representations.
5. Generate negative pair samples (1:1 train ratio, deterministic evaluation set).
6. Implement and rigorously test zero-leakage splits: **S1 (transductive)**, **S2 (one-unseen-drug)**, and **S3 (two-unseen-drugs)**.

***
**Acceptance Checkpoint:** Phase 0 smoke test passed. Awaiting user approval ("continue") before launching Phase 1.
