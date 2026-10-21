const Doctor = require('../models/Doctor');
const neo4jService = require('../services/neo4jService');
const localStore = require('../services/localStore');

// CREATE Doctor
exports.createDoctor = async (req, res, next) => {
  try {
    const doctorData = { ...req.body };
    doctorData.doctorId = String(doctorData.doctorId || '').toUpperCase().trim();
    if (doctorData.departmentId) {
      doctorData.departmentId = String(doctorData.departmentId).toUpperCase().trim();
    }

    if (!doctorData.doctorId) {
      return res.status(400).json({ success: false, error: 'Doctor ID is required.' });
    }

    // Check duplicate in localStore & Mongo
    const localExisting = localStore.findOne('doctors', d => d.doctorId === doctorData.doctorId);
    let mongoExisting = null;
    try {
      mongoExisting = await Doctor.findOne({ doctorId: doctorData.doctorId });
    } catch (e) {}

    if (localExisting || mongoExisting) {
      return res.status(409).json({
        success: false,
        error: `Doctor with ID ${doctorData.doctorId} already exists.`,
      });
    }

    // Persist to localStore first
    const savedInStore = localStore.insert('doctors', doctorData);

    // Persist to MongoDB
    let doctor = savedInStore;
    try {
      doctor = await Doctor.create(doctorData);
    } catch (dbErr) {
      console.warn('[MongoDB Notice] Save fell back to localStore:', dbErr.message);
    }

    // Sync to Neo4j (non-blocking / error-tolerant)
    try {
      await neo4jService.createDoctorNode({
        doctorId: doctorData.doctorId,
        name: doctorData.name,
        specialization: doctorData.specialization,
      });

      if (doctorData.departmentId) {
        await neo4jService.createRelationship({
          fromLabel: 'Doctor',
          fromIdKey: 'doctorId',
          fromIdValue: doctorData.doctorId,
          relType: 'BELONGS_TO',
          toLabel: 'Department',
          toIdKey: 'departmentId',
          toIdValue: doctorData.departmentId,
        });
      }
    } catch (neoErr) {
      console.warn('[Neo4j Notice] Doctor graph sync skipped:', neoErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Doctor created successfully and persisted to disk',
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};

// READ ALL Doctors
exports.getAllDoctors = async (req, res, next) => {
  try {
    const { departmentId, search } = req.query;
    let doctors = [];

    try {
      doctors = await Doctor.find().sort({ name: 1 }).lean();
    } catch (dbErr) {
      doctors = [];
    }

    const localDoctors = localStore.getCollection('doctors');
    const existingIds = new Set(doctors.map(d => d.doctorId));
    localDoctors.forEach(ld => {
      if (!existingIds.has(ld.doctorId)) {
        doctors.push(ld);
        existingIds.add(ld.doctorId);
      }
    });

    if (doctors.length === 0) {
      doctors = localDoctors;
    }

    // Filter
    if (departmentId) {
      doctors = doctors.filter(d => (d.departmentId || '').toUpperCase() === departmentId.toUpperCase());
    }
    if (search) {
      const q = search.toLowerCase();
      doctors = doctors.filter(d =>
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.specialization && d.specialization.toLowerCase().includes(q)) ||
        (d.doctorId && d.doctorId.toLowerCase().includes(q))
      );
    }

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    next(error);
  }
};

// READ Doctor by ID
exports.getDoctorById = async (req, res, next) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    let doctor = null;

    try {
      doctor = await Doctor.findOne({ doctorId: id }).lean();
    } catch (e) {
      doctor = null;
    }

    if (!doctor) {
      doctor = localStore.findOne('doctors', d => d.doctorId === id);
    }

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: `Doctor with ID '${id}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE Doctor
exports.updateDoctor = async (req, res, next) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    const updates = { ...req.body };
    delete updates.doctorId;

    if (updates.departmentId) {
      updates.departmentId = updates.departmentId.toUpperCase().trim();
    }

    // Update in localStore
    const localUpdated = localStore.update('doctors', d => d.doctorId === id, updates);

    // Update in MongoDB
    let doctor = localUpdated;
    try {
      const dbDoc = await Doctor.findOneAndUpdate(
        { doctorId: id },
        { $set: updates },
        { new: true, runValidators: true }
      );
      if (dbDoc) doctor = dbDoc;
    } catch (e) {}

    if (!doctor && !localUpdated) {
      return res.status(404).json({
        success: false,
        error: `Doctor with ID '${id}' not found`,
      });
    }

    // Sync to Neo4j
    try {
      await neo4jService.createDoctorNode({
        doctorId: id,
        name: updates.name || doctor.name,
        specialization: updates.specialization || doctor.specialization,
      });

      if (updates.departmentId || doctor.departmentId) {
        await neo4jService.createRelationship({
          fromLabel: 'Doctor',
          fromIdKey: 'doctorId',
          fromIdValue: id,
          relType: 'BELONGS_TO',
          toLabel: 'Department',
          toIdKey: 'departmentId',
          toIdValue: updates.departmentId || doctor.departmentId,
        });
      }
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: 'Doctor updated successfully',
      data: doctor || localUpdated,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE Doctor
exports.deleteDoctor = async (req, res, next) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    localStore.delete('doctors', d => d.doctorId === id);

    let doctor = null;
    try {
      doctor = await Doctor.findOneAndDelete({ doctorId: id });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `Doctor ${id} deleted successfully`,
      data: doctor || { doctorId: id },
    });
  } catch (error) {
    next(error);
  }
};
