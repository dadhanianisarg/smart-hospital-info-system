/**
 * Clinical Prescription-Time DDI Risk Controller.
 * Bridges Express Hospital Information System backend with FastAPI ML Microservice.
 * Non-blocking graceful fallback ensures the hospital system remains fully operational
 * even when the ML service is offline.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

exports.checkPrescriptionRisk = async (req, res, next) => {
  const { patientId, newDrugName, newDrugSmiles, currentMeds, diagnoses } = req.body;

  if (!patientId || !newDrugName) {
    return res.status(400).json({
      success: false,
      error: 'patientId and newDrugName are required fields.',
    });
  }

  const payload = {
    patient_id: String(patientId).trim(),
    new_drug_name: String(newDrugName).trim(),
    new_drug_smiles: newDrugSmiles || null,
    current_meds: Array.isArray(currentMeds) ? currentMeds : [],
    diagnoses: Array.isArray(diagnoses) ? diagnoses : [],
  };

  try {
    // 3-second timeout ensures clinical UI never hangs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${ML_SERVICE_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({
        success: true,
        available: true,
        ...data,
      });
    } else {
      console.warn(`[ML Service Warning] Score returned HTTP ${response.status}`);
      return res.status(200).json({
        success: true,
        available: false,
        status: 'error_response',
        patient_id: payload.patient_id,
        new_drug_name: payload.new_drug_name,
        max_risk_score: 0.0,
        max_risk_level: 'UNKNOWN',
        interactions: [],
        attention_weights: {},
        message: 'Prescription-time ML risk service returned non-200. Proceeding safely without check.',
        disclaimer: 'Research prototype. Not for clinical diagnostic or prescribing use.',
      });
    }
  } catch (err) {
    // Graceful offline fallback
    console.log(`[ML Service Info] ML Risk service offline (${err.name || err.message}). Proceeding without ML check.`);
    return res.status(200).json({
      success: true,
      available: false,
      status: 'offline',
      patient_id: payload.patient_id,
      new_drug_name: payload.new_drug_name,
      max_risk_score: 0.0,
      max_risk_level: 'UNKNOWN',
      interactions: [],
      attention_weights: {},
      message: 'Prescription-time ML risk service is offline. Proceeding without ML check.',
      disclaimer: 'Research prototype. Not for clinical diagnostic or prescribing use.',
    });
  }
};
