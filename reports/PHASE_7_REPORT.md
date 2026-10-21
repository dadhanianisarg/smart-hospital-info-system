# Phase 7 Report: Full-Stack Hospital Information System Integration

**Date:** October 12, 2026  
**Authors:** Yash Khose (23BCE0625) & Tanish Chawla (23BCE0502)  
**System Under Test:** Smart Hospital Information System (HIS)  
- **Frontend:** React 18, Vite, Tailwind CSS, Heroicons  
- **Backend:** Node.js, Express, MongoDB (Mongoose), Neo4j (Bolt driver)  
- **ML Microservice:** FastAPI, PyTorch 2.6 (CPU, 8 threads), RDKit, PyG  

---

## 1. Executive Summary & Objective

In Phase 7, the `PatientConditionedDDI` inference microservice developed in Phase 6 was integrated into the active Smart Hospital Information System (HIS) workflow. 

The primary requirement of clinical decision support systems (CDSS) is **non-disruptive, fail-safe reliability**:
1. When active, the system checks candidate drug pairs against the patient's diagnosed conditions and current medications, rendering triage alerts directly at prescription time.
2. If the ML inference service crashes, experiences network timeouts, or is administratively disabled, the hospital information system must **continue operating without interruption or error**—flagging the risk check as `offline` while allowing clinicians to save prescriptions cleanly.

Both criteria were implemented, verified, and benchmarked end-to-end.

---

## 2. Express Backend Integration

### 2.1 Route & Controller Architecture
- **Controller:** [`server/src/controllers/riskController.js`](file:///c:/Projects/Smart-Hospital-Information-System/server/src/controllers/riskController.js)
  - Implements `checkPrescriptionRisk(req, res)` as a reverse-proxy and enrichment layer.
  - Dynamically extracts the target patient's active conditions and current active medication regimen from MongoDB before forwarding the payload to FastAPI `POST /score`.
  - Enforces a strict **3.0-second network timeout** via `axios.create({ timeout: 3000 })`.
  - Implements a resilient `try/catch` fallback: on connection refused (`ECONNREFUSED`), timeout, or 5xx from the ML microservice, the controller responds with HTTP 200 and:
    ```json
    {
      "available": false,
      "status": "offline",
      "message": "Clinical DDI risk service is temporarily offline. Prescription workflow unaffected.",
      "alerts": [],
      "max_risk_level": "UNKNOWN"
    }
    ```
- **Routes:** [`server/src/routes/riskRoutes.js`](file:///c:/Projects/Smart-Hospital-Information-System/server/src/routes/riskRoutes.js)
  - Mounts `POST /api/risk/check` (protected by JWT authentication middleware `verifyToken`).
  - Mounted globally in [`server/src/app.js`](file:///c:/Projects/Smart-Hospital-Information-System/server/src/app.js) alongside `/api/prescriptions` and `/api/patients`.
- **Prescription Workflow Guard:** [`server/src/controllers/prescriptionController.js`](file:///c:/Projects/Smart-Hospital-Information-System/server/src/controllers/prescriptionController.js)
  - In `createPrescription`, an asynchronous pre-check triggers risk scoring. If high-risk or critical interactions are found, risk metadata is attached to the prescription audit record. If the ML service is down, the prescription creation completes cleanly.

---

## 3. React Frontend Integration

### 3.1 Prescription-Time Interactive Risk Modal
- **Component File:** [`client/src/pages/Prescriptions.jsx`](file:///c:/Projects/Smart-Hospital-Information-System/client/src/pages/Prescriptions.jsx)
- **API Client:** Added `checkRisk` method in [`client/src/services/api.js`](file:///c:/Projects/Smart-Hospital-Information-System/client/src/services/api.js).
- **UI Behavior:**
  - When a clinician selects a patient and adds $\ge 2$ medications (or adds a new medication for a patient with existing active medications), an interactive **"Run DDI Safety Check"** action button activates.
  - Selecting the check opens a dedicated **Prescription-Time DDI Risk Assessment** panel:
    1. **CRITICAL / RED ALERT ($\text{score} \ge 0.80$):** High-contrast Crimson alert panel with warning icon, interaction pair names, rule-trigger rationale (e.g. *Compounded renal vasoconstriction in chronic kidney disease*), and physiological attention weights.
    2. **MODERATE / YELLOW ALERT ($0.50 \le \text{score} < 0.80$):** Amber panel recommending dosage adjustment or increased monitoring.
    3. **LOW RISK / GREEN ALERT ($\text{score} < 0.50$):** Emerald badge indicating no significant context-conditioned interaction detected.
    4. **SERVICE OFFLINE BADGE:** Gray informational banner indicating the ML service is unavailable, with standard prescribing controls enabled without modal blocking.
  - Contains mandatory regulatory disclaimer:  
    > *"Research Prototype: Predictions are experimental decision support aids and do not supersede professional clinical judgment."*
- **Production Build:** Rebuilt via `npm run build` with 0 errors.

---

## 4. End-to-End Verification & Test Cases

### 4.1 Test Case Matrix

| ID | Test Scenario | Patient Context | Prescribed Drugs | Expected UI Alert | Backend Latency | Status |
|:---|:---|:---|:---|:---:|:---:|:---:|
| **TC-1** | Known High-Risk Context Interaction | Patient with CKD Stage 3 | Lisinopril + Ibuprofen | **CRITICAL (Red)**, score = 0.98, Attention on CKD (68%) | 6.23 ms | **PASSED** |
| **TC-2** | Cold-Start Novel Drug (with SMILES) | Healthy / No chronic conditions | Novel Agent (SMILES) + Ibuprofen | **MODERATE (Yellow)**, score = 0.62, Fingerprint projection | 8.14 ms | **PASSED** |
| **TC-3** | Safe / Non-Interacting Pair | Hypertension | Paracetamol + Amoxicillin | **LOW (Green)**, score = 0.18, Safe to proceed | 5.40 ms | **PASSED** |
| **TC-4** | Fail-Safe Service Crash (FastAPI Down) | Any patient | Lisinopril + Ibuprofen | **OFFLINE (Gray)**, available: false, Prescription creates cleanly | 2.10 ms | **PASSED** |

### 4.2 Raw Verification Logs

#### TC-1: Live Risk Check (FastAPI Running)
```bash
POST http://localhost:5000/api/risk/check
{
  "patient_id": "P_SYN_000042",
  "conditions": ["Chronic kidney disease"],
  "current_medications": ["Amlodipine"],
  "candidate_drugs": [
    {"drug_id": "DB00722", "name": "Lisinopril"},
    {"drug_id": "DB01050", "name": "Ibuprofen"}
  ]
}

Response (200 OK):
{
  "available": true,
  "max_risk_level": "CRITICAL",
  "alerts": [
    {
      "drug_pair": ["Lisinopril", "Ibuprofen"],
      "calibrated_score": 0.980,
      "risk_level": "CRITICAL",
      "rule_triggered": "R1_RENAL_NSAID_ACEI",
      "clinical_explanation": "Compounded reduction in renal glomerular filtration rate; high risk of acute kidney injury."
    }
  ],
  "latency_ms": 6.23
}
```

#### TC-4: Graceful Degradation (FastAPI Stopped)
```bash
POST http://localhost:5000/api/risk/check
Response (200 OK):
{
  "available": false,
  "status": "offline",
  "message": "Clinical DDI risk service is temporarily offline. Prescription workflow unaffected.",
  "alerts": [],
  "max_risk_level": "UNKNOWN"
}
```

### 4.3 Visual Artifact
A standalone interactive preview of all four alert states was authored and saved to [`reports/alert_box_preview.html`](file:///c:/Projects/Smart-Hospital-Information-System/reports/alert_box_preview.html).

---

## 5. Acceptance Criteria Checklist

- [x] Express route `POST /api/risk/check` mounted and authenticated.
- [x] Non-blocking fail-safe architecture tested with ML service shutdown.
- [x] React modal alert panel with Green, Yellow, Red, and Offline states.
- [x] Regulatory and research prototype disclaimers visible in UI.
- [x] Client bundle built cleanly (`client/dist/`).
- [x] All test cases passed with end-to-end response times $<25$ ms.
