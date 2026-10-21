const Patient = require('../models/Patient');
const neo4jService = require('../services/neo4jService');
const localStore = require('../services/localStore');

// CREATE Patient
exports.createPatient = async (req, res, next) => {
  try {
    const patientData = { ...req.body };
    patientData.patientId = String(patientData.patientId || '').toUpperCase().trim();

    if (!patientData.patientId) {
      return res.status(400).json({ success: false, error: 'Patient ID is required.' });
    }

    // Check duplicate in localStore & Mongo
    const localExisting = localStore.findOne('patients', p => p.patientId === patientData.patientId);
    let mongoExisting = null;
    try {
      mongoExisting = await Patient.findOne({ patientId: patientData.patientId });
    } catch (e) {
      // Mongo not ready or error
    }

    if (localExisting || mongoExisting) {
      return res.status(409).json({
        success: false,
        error: `Patient with ID ${patientData.patientId} already exists.`,
      });
    }

    // Persist to disk localStore first
    const savedInStore = localStore.insert('patients', patientData);

    // Persist to MongoDB
    let patient = savedInStore;
    try {
      patient = await Patient.create(patientData);
    } catch (dbErr) {
      console.warn('[MongoDB Notice] Save fell back to persistent disk store:', dbErr.message);
    }

    // Sync to Neo4j Graph (non-blocking / error-tolerant)
    try {
      await neo4jService.createPatientNode({
        patientId: patientData.patientId,
        name: patientData.name,
        age: patientData.age,
        gender: patientData.gender,
      });
    } catch (neoErr) {
      console.warn('[Neo4j Notice] Graph sync skipped:', neoErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully and persisted to disk',
      data: patient,
    });
  } catch (error) {
    next(error);
  }
};

// READ ALL Patients
exports.getAllPatients = async (req, res, next) => {
  try {
    const { search, gender, bloodGroup } = req.query;
    let patients = [];

    // Try reading from MongoDB
    try {
      patients = await Patient.find().sort({ createdAt: -1 }).lean();
    } catch (dbErr) {
      patients = [];
    }

    // Merge with persistent disk localStore to guarantee zero data loss
    const localPatients = localStore.getCollection('patients');
    const existingIds = new Set(patients.map(p => p.patientId));
    localPatients.forEach(lp => {
      if (!existingIds.has(lp.patientId)) {
        patients.push(lp);
        existingIds.add(lp.patientId);
      }
    });

    if (patients.length === 0) {
      patients = localPatients;
    }

    // Apply filtering
    if (gender) {
      patients = patients.filter(p => (p.gender || '').toLowerCase() === gender.toLowerCase());
    }
    if (bloodGroup) {
      patients = patients.filter(p => (p.bloodGroup || '').toLowerCase() === bloodGroup.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      patients = patients.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.patientId && p.patientId.toLowerCase().includes(q)) ||
        (p.phone && p.phone.toLowerCase().includes(q))
      );
    }

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    next(error);
  }
};

// READ Patient by ID (patientId)
exports.getPatientById = async (req, res, next) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    let patient = null;

    try {
      patient = await Patient.findOne({ patientId: id }).lean();
    } catch (e) {
      patient = null;
    }

    if (!patient) {
      patient = localStore.findOne('patients', p => p.patientId === id);
    }

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: `Patient with ID '${id}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE Patient
exports.updatePatient = async (req, res, next) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    const updates = { ...req.body };
    delete updates.patientId; // Immutable identifier

    // Update in localStore
    const localUpdated = localStore.update('patients', p => p.patientId === id, updates);

    // Update in MongoDB
    let patient = localUpdated;
    try {
      const dbPat = await Patient.findOneAndUpdate(
        { patientId: id },
        { $set: updates },
        { new: true, runValidators: true }
      );
      if (dbPat) patient = dbPat;
    } catch (e) {
      console.warn('[MongoDB Notice] Update fell back to local store');
    }

    if (!patient && !localUpdated) {
      return res.status(404).json({
        success: false,
        error: `Patient with ID '${id}' not found`,
      });
    }

    // Sync to Neo4j
    try {
      await neo4jService.createPatientNode({
        patientId: id,
        name: updates.name || patient.name,
        age: updates.age || patient.age,
        gender: updates.gender || patient.gender,
      });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: 'Patient updated successfully',
      data: patient || localUpdated,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE Patient
exports.deletePatient = async (req, res, next) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    localStore.delete('patients', p => p.patientId === id);

    let patient = null;
    try {
      patient = await Patient.findOneAndDelete({ patientId: id });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `Patient ${id} deleted successfully`,
      data: patient || { patientId: id },
    });
  } catch (error) {
    next(error);
  }
};
