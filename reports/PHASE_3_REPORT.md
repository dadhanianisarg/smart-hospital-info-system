# Phase 3 Report: Patient Layer Construction & Context Conditioning

**Date:** October 12, 2026  
**Authors:** Yash Khose (23BCE0625) & Tanish Chawla (23BCE0502)  
**System Hardware:** CPU Only (20 Cores, 16 GB RAM, 8 PyTorch Threads)  

---

## 1. Executive Summary

In Phase 3, we constructed the heterogeneous patient graph layer that bridges clinical Electronic Health Record (EHR) phenotypes with molecular Drug-Drug Interaction (DDI) graphs. Standard DDI models (such as those evaluated in Phase 2) score drug pairs in isolation, ignoring the patient's individual physiological susceptibility. 

To overcome this fundamental limitation while respecting academic data governance, we implemented a three-tier task architecture:
1. **Task A (Real Benchmark Labels, Context-Free):** The established DrugBank ($S1, S2, S3$) and `ogbl-ddi` benchmarks. Tests zero-shot cold-start molecular generalization on unseen compounds.
2. **Task B (Controlled Simulation, Clearly Labeled SYNTHETIC):** A clinical cohort of 10,000 synthetic patients generated using standardized Synthea schemas, mapped to DrugBank active ingredients, and evaluated against 8 physiological context rules (e.g., renal impairment compounding ACE inhibitor and NSAID toxicity).
3. **Task C (Real Clinical EHR Outcomes - MIMIC-IV):** A formal loader skeleton implemented behind the configuration flag `use_mimic: false`, explicitly detailing PhysioNet Human Subjects Data Use Agreement (DUA) credentialing requirements.

---

## 2. Cohort Generation & Heterogeneous Graph Statistics

Using a deterministic multi-seed generator matching official Synthea CSV schemas (`patients.csv`, `conditions.csv`, `medications.csv`, `encounters.csv`), we instantiated a 10,000-patient clinical cohort:

| Entity / Relation | Type | Count | Description |
| :--- | :--- | :---: | :--- |
| **Patient Nodes** | Entity | 10,000 | Demographic profiles (`SYN_000000` to `SYN_009999`) |
| **Condition Nodes** | Entity | 12 | Standardized SNOMED-CT clinical chronic conditions |
| **Drug Nodes** | Entity | 1,706 | Full DrugBank active pharmaceutical ingredient vocabulary |
| **`HAS_CONDITION`** | Relation | 24,853 | Edges linking patients to documented active diagnoses |
| **`TAKES`** | Relation | 29,935 | Edges linking patients to active ongoing medication regimens |
| **`INTERACTS_WITH`** | Relation | 153,121 | Transductive training DDI edges (S1 split only; zero test leakage) |

```
Heterogeneous Local Patient Subgraph Topology:
[ Patient: p ] ──(HAS_CONDITION)──> [ Disease: c_k ]
      │
   (TAKES)
      ▼
[ Drug: d_m ] ──(INTERACTS_WITH [Train Only])──> [ Drug: d_n ]
```

---

## 3. Medication Mapping & Ingredient Normalization

Medications in clinical EHRs are documented as dosage forms (e.g., *"Lisinopril 10 MG Oral Tablet"*), whereas DDI knowledge graphs index active chemical moieties. We implemented `normalize_medication_name()` which extracts active pharmaceutical ingredients by stripping dosage units (`mg`, `mcg`, `ml`), delivery forms (`oral`, `tablet`, `delayed-release`, `inhalation aerosol`), and counter-ion salts (`hydrochloride`, `sodium`, `succinate`).

### Mapping Coverage Results:
- **Total Synthea Medication Records:** 29,935
- **Successfully Mapped Records:** 29,935 (100.0% row coverage)
- **Dropped Records:** 0 (0.0%)
- **Unique Medication Formulations Mapped:** 16 / 16 (100.0%)

All 16 unique clinical medications present in the Synthea cohort map deterministically to verified DrugBank accession IDs (e.g., `DB00722` Lisinopril, `DB01050` Ibuprofen, `DB00682` Warfarin, `DB00945` Aspirin, `DB00331` Metformin).

---

## 4. Task B: Context Rules Specification (Controlled Simulation)

To validate whether the graph attention mechanism can leverage patient state when physiological context alters risk, 8 evidence-based rules were formalized in `ml/configs/context_rules.yaml`.

> [!WARNING]
> **Task B Label Transparency:** All Task B labels are synthetic, rule-based multipliers for architectural proof-of-concept only. They test whether the model can learn and predict patient-conditioned risk amplification. They do not constitute clinical guidance.

| Rule ID | Clinical Scenario | Condition Keyword | Interacting Drug Classes | Severity Multiplier |
| :--- | :--- | :--- | :--- | :---: |
| `R1` | Nephrotoxic Synergy in Renal Impairment | `kidney` | ACEI / ARB + NSAID | **1.85×** |
| `R2` | Hemorrhagic Risk in Peptic Ulcer Disease | `ulcer` | Anticoagulants + NSAIDs | **2.10×** |
| `R3` | Cardiodepression in Congestive Heart Failure | `heart failure` | Beta-Blockers + Non-DHP CCBs | **1.75×** |
| `R4` | Glycemic Dysregulation in Diabetes Mellitus | `diabetes` | Antidiabetic Agents + Corticosteroids | **1.55×** |
| `R5` | Hepatotoxicity Amplification in Cirrhosis | `hepatic` | Acetaminophen + Hepatotoxins | **1.90×** |
| `R6` | Bronchospasm Amplification in Asthma | `asthma` | Non-Selective Beta-Blockers + Beta-Agonists | **1.80×** |
| `R7` | Ventricular Arrhythmia in Long QT Syndrome | `arrhythmia` | Fluoroquinolones + QT-Prolonging Agents | **2.05×** |
| `R8` | Potassium Retention in Hyperkalemia | `hyperkalemia` | Potassium-Sparing Diuretics + ACEI / K+ | **1.70×** |

---

## 5. Task C: MIMIC-IV Clinical Outcomes & Research Governance

In accordance with Global Rule 2 ("No fabricated results") and Rule 6 ("Ask before action needing credentials"), we implemented a strict research governance guard in `load_mimic_iv_skeleton()`:
- Real clinical adverse drug event detection requires PhysioNet CITI training credentialing (Human Subjects Data Use Agreement).
- To preserve reproducibility without violating PhysioNet DUA agreements or synthesizing fake patient outcomes, Task C remains locked behind `use_mimic: false`.

---

## 6. Unit Testing & Leakage Verification

All Phase 3 unit tests passed with 100% success (`ml/tests/test_patient_layer.py`):
1. `test_synthea_generation_integrity`: Verified CSV schema conformance across 10,000 patients.
2. `test_ingredient_mapping_coverage`: Verified 100% mapping from clinical text to DrugBank identifiers.
3. `test_patient_context_builder`: Verified local subgraph extraction (active conditions and ongoing medications).
4. `test_task_b_context_rule_severity`: Verified that patient conditions amplify risk multipliers (e.g., $1.85\times$ for CKD + Lisinopril + Ibuprofen vs $1.0\times$ for unconditioned patients).
5. `test_task_c_mimic_skeleton_flag`: Verified strict exception handling when `use_mimic` flag is disabled.

---

## 7. Deliverables & Checkpoint State

- **Cohort Files:** `ml/data/synthea/patients.csv`, `conditions.csv`, `medications.csv`, `encounters.csv`, `medications_mapped.csv`
- **Configuration:** `ml/configs/context_rules.yaml`
- **Core Modules:** `ml/src/data/patient_layer.py`, `ml/scripts/build_patient_layer.py`
- **Statistics Record:** `results/patient_layer_statistics.json`
- **Unit Tests:** `ml/tests/test_patient_layer.py` (5/5 passing)
- **Status:** Phase 3 fully completed. Ready for Phase 4 model training and ablation studies.
