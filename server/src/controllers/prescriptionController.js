const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const neo4jService = require('../services/neo4jService');
const localStore = require('../services/localStore');

// CREATE Prescription
exports.createPrescription = async (req, res, next) => {
  try {
    const rxData = { ...req.body };
    rxData.prescriptionId = String(rxData.prescriptionId || '').toUpperCase().trim();
    rxData.patientId = String(rxData.patientId || '').toUpperCase().trim();
    rxData.doctorId = String(rxData.doctorId || '').toUpperCase().trim();

    if (!rxData.prescriptionId) {
      return res.status(400).json({ success: false, error: 'Prescription ID is required.' });
    }

    // Check duplicate
    const localExisting = localStore.findOne('prescriptions', p => p.prescriptionId === rxData.prescriptionId);
    let mongoExisting = null;
    try {
      mongoExisting = await Prescription.findOne({ prescriptionId: rxData.prescriptionId });
    } catch (e) {}

    if (localExisting || mongoExisting) {
      return res.status(409).json({
        success: false,
        error: `Prescription with ID ${rxData.prescriptionId} already exists.`,
      });
    }

    // Check patient existence in Mongo or localStore
    let patient = null;
    try {
      patient = await Patient.findOne({ patientId: rxData.patientId });
    } catch (e) {}
    if (!patient) {
      patient = localStore.findOne('patients', p => p.patientId === rxData.patientId);
    }
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: `Referenced Patient ${rxData.patientId} does not exist.`,
      });
    }

    // Check doctor existence in Mongo or localStore
    let doctor = null;
    try {
      doctor = await Doctor.findOne({ doctorId: rxData.doctorId });
    } catch (e) {}
    if (!doctor) {
      doctor = localStore.findOne('doctors', d => d.doctorId === rxData.doctorId);
    }
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: `Referenced Doctor ${rxData.doctorId} does not exist.`,
      });
    }

    // Optional non-blocking DDI risk evaluation
    let riskEvaluation = null;
    try {
      if (Array.isArray(rxData.medicines) && rxData.medicines.length > 0) {
        const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);

        let prevRx = [];
        try {
          prevRx = await Prescription.find({ patientId: rxData.patientId });
        } catch (e) {
          prevRx = localStore.find('prescriptions', p => p.patientId === rxData.patientId);
        }

        const prevMeds = [];
        prevRx.forEach(p => {
          if (Array.isArray(p.medicines)) {
            p.medicines.forEach(m => {
              if (m.name && !prevMeds.includes(m.name)) prevMeds.push(m.name);
            });
          }
        });

        const checkRes = await fetch(`${mlUrl}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: rxData.patientId,
            new_drug_name: rxData.medicines[0].name,
            current_meds: prevMeds,
            diagnoses: [rxData.diagnosis || 'Essential hypertension'],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (checkRes.ok) {
          riskEvaluation = await checkRes.json();
          if (riskEvaluation.max_risk_level === 'CRITICAL' || riskEvaluation.max_risk_level === 'HIGH') {
            rxData.riskWarning = {
              level: riskEvaluation.max_risk_level,
              score: riskEvaluation.max_risk_score,
              flagged: true,
            };
          }
        }
      }
    } catch (e) {
      // Non-blocking
    }

    // Persist to localStore
    const savedInStore = localStore.insert('prescriptions', rxData);

    // Persist to MongoDB
    let prescription = savedInStore;
    try {
      prescription = await Prescription.create(rxData);
    } catch (dbErr) {
      console.warn('[MongoDB Notice] Prescription saved to localStore fallback:', dbErr.message);
    }

    // Synchronize relationships to Neo4j graph (non-blocking)
    try {
      await neo4jService.createRelationship({
        fromLabel: 'Patient',
        fromIdKey: 'patientId',
        fromIdValue: rxData.patientId,
        relType: 'TREATED_BY',
        toLabel: 'Doctor',
        toIdKey: 'doctorId',
        toIdValue: rxData.doctorId,
      });

      if (Array.isArray(rxData.medicines)) {
        for (const med of rxData.medicines) {
          if (med.medicineId) {
            await neo4jService.createRelationship({
              fromLabel: 'Doctor',
              fromIdKey: 'doctorId',
              fromIdValue: rxData.doctorId,
              relType: 'PRESCRIBED',
              toLabel: 'Medicine',
              toIdKey: 'medicineId',
              toIdValue: med.medicineId.toUpperCase(),
            });

            await neo4jService.createRelationship({
              fromLabel: 'Patient',
              fromIdKey: 'patientId',
              fromIdValue: rxData.patientId,
              relType: 'TAKES',
              toLabel: 'Medicine',
              toIdKey: 'medicineId',
              toIdValue: med.medicineId.toUpperCase(),
            });
          }
        }
      }
    } catch (neoErr) {
      console.warn('[Neo4j Notice] Prescription graph edges skipped:', neoErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Prescription recorded and persisted to disk',
      data: prescription,
    });
  } catch (error) {
    next(error);
  }
};

// READ ALL Prescriptions
exports.getAllPrescriptions = async (req, res, next) => {
  try {
    const { patientId, doctorId } = req.query;
    let prescriptions = [];

    try {
      prescriptions = await Prescription.find().sort({ date: -1, createdAt: -1 }).lean();
    } catch (dbErr) {
      prescriptions = [];
    }

    const localRx = localStore.getCollection('prescriptions');
    const existingIds = new Set(prescriptions.map(p => p.prescriptionId));
    localRx.forEach(lr => {
      if (!existingIds.has(lr.prescriptionId)) {
        prescriptions.push(lr);
        existingIds.add(lr.prescriptionId);
      }
    });

    if (prescriptions.length === 0) {
      prescriptions = localRx;
    }

    if (patientId) {
      prescriptions = prescriptions.filter(p => (p.patientId || '').toUpperCase() === patientId.toUpperCase());
    }
    if (doctorId) {
      prescriptions = prescriptions.filter(p => (p.doctorId || '').toUpperCase() === doctorId.toUpperCase());
    }

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: prescriptions,
    });
  } catch (error) {
    next(error);
  }
};

// READ Prescription by ID
exports.getPrescriptionById = async (req, res, next) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    let prescription = null;

    try {
      prescription = await Prescription.findOne({ prescriptionId: id }).lean();
    } catch (e) {
      prescription = null;
    }

    if (!prescription) {
      prescription = localStore.findOne('prescriptions', p => p.prescriptionId === id);
    }

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: `Prescription with ID '${id}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      data: prescription,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE Prescription
exports.deletePrescription = async (req, res, next) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    localStore.delete('prescriptions', p => p.prescriptionId === id);

    let prescription = null;
    try {
      prescription = await Prescription.findOneAndDelete({ prescriptionId: id });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `Prescription ${id} deleted successfully`,
      data: prescription || { prescriptionId: id },
    });
  } catch (error) {
    next(error);
  }
};
