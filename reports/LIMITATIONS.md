# Project Scientific Limitations & Boundary Conditions

This document explicitly catalogs all design assumptions, scope boundaries, and clinical validity limits for the paper titled:
*"Patient-Conditioned Drug-Interaction Risk Prediction with Relational Graph Neural Networks and Cold-Start Generalization, deployed as a prescription-time check in a hospital information system."*

---

## 1. Computational Hardware Boundaries
- **CPU-Only Execution:** All models are trained and evaluated on multi-core CPU architecture (20 physical/logical cores, 16 GB system memory) using `torch.set_num_threads(8)`. 
- **Capacity Implications:** GNN embedding dimensionality is bounded between 64 and 128, with 2 relational message-passing layers. Large-scale graphs require neighbor sampling (`NeighborLoader`) rather than full-batch graph convolution.

## 2. DDI Negative Sampling Semantics
- **Absence of Evidence $\neq$ Evidence of Safety:** Binary link prediction on public DDI graphs (ogbl-ddi, DrugBank, TWOSIDES) samples negative pairs uniformly from non-interacting drug pairs. In biomedical reality, an unobserved edge often indicates an untested drug pair rather than a proven benign combination. The paper explicitly clarifies this open-world assumption.

## 3. Patient Context Labels (Task A vs. Task B vs. Task C)
- **Task A (Real DDI, No Context):** DrugBank and TWOSIDES benchmarks provide real biomedical labels, but labels are purely pair-wise and patient-agnostic. Task A exclusively evaluates pairwise and inductive cold-start generalization.
- **Task B (Controlled Synthetic Context):** Because public DDI datasets do not contain patient-specific adverse outcome ground truth linked to EHR records, patient condition-conditioned severity labels are generated via defined physiological rules (e.g., renal impairment amplifying clearance toxicity). Every table and claim using Task B explicitly states: *"Synthetic, rule-based context labels for architectural validation only"*.
- **Task C (MIMIC-IV EHR Data):** MIMIC-IV real-world validation is framed as an open integration target requiring PhysioNet Human Subjects credentialing and Data Use Agreements (DUA).

## 4. Synthea Medication Mapping Coverage
- **Ingredient Normalization:** Synthea EHR records use clinical trade names and RxNorm forms, which are mapped to DrugBank active ingredients via normalized string matching. Multi-ingredient formulations or unmatched entries are dropped and strictly reported in coverage statistics.

## 5. Dataset Licenses & Data Governance
- **DrugBank:** Distributed under academic research license through Therapeutics Data Commons (PyTDC). Any commercial or clinical deployment requires commercial licensing.
- **HIS Prototype Safety Disclaimer:** The integrated HIS service is an exploratory research prototype and is explicitly flagged: *"Research prototype. Not for clinical diagnostic or prescribing use."*
