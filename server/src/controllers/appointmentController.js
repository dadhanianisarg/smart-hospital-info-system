const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const neo4jService = require('../services/neo4jService');
const localStore = require('../services/localStore');

// CREATE Appointment
exports.createAppointment = async (req, res, next) => {
  try {
    const aptData = { ...req.body };
    aptData.appointmentId = String(aptData.appointmentId || '').toUpperCase().trim();
    aptData.patientId = String(aptData.patientId || '').toUpperCase().trim();
    aptData.doctorId = String(aptData.doctorId || '').toUpperCase().trim();

    if (!aptData.appointmentId) {
      return res.status(400).json({ success: false, error: 'Appointment ID is required.' });
    }

    // Check duplicate
    const localExisting = localStore.findOne('appointments', a => a.appointmentId === aptData.appointmentId);
    let mongoExisting = null;
    try {
      mongoExisting = await Appointment.findOne({ appointmentId: aptData.appointmentId });
    } catch (e) {}

    if (localExisting || mongoExisting) {
      return res.status(409).json({
        success: false,
        error: `Appointment with ID ${aptData.appointmentId} already exists.`,
      });
    }

    // Verify patient
    let patient = null;
    try {
      patient = await Patient.findOne({ patientId: aptData.patientId });
    } catch (e) {}
    if (!patient) {
      patient = localStore.findOne('patients', p => p.patientId === aptData.patientId);
    }
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: `Referenced Patient ${aptData.patientId} does not exist in database.`,
      });
    }

    // Verify doctor
    let doctor = null;
    try {
      doctor = await Doctor.findOne({ doctorId: aptData.doctorId });
    } catch (e) {}
    if (!doctor) {
      doctor = localStore.findOne('doctors', d => d.doctorId === aptData.doctorId);
    }
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: `Referenced Doctor ${aptData.doctorId} does not exist in database.`,
      });
    }

    // Save to localStore
    const savedInStore = localStore.insert('appointments', aptData);

    // Save to MongoDB
    let appointment = savedInStore;
    try {
      appointment = await Appointment.create(aptData);
    } catch (dbErr) {
      console.warn('[MongoDB Notice] Appointment saved to localStore fallback:', dbErr.message);
    }

    // Create TREATED_BY relationship in Neo4j
    try {
      await neo4jService.createRelationship({
        fromLabel: 'Patient',
        fromIdKey: 'patientId',
        fromIdValue: aptData.patientId,
        relType: 'TREATED_BY',
        toLabel: 'Doctor',
        toIdKey: 'doctorId',
        toIdValue: aptData.doctorId,
      });
    } catch (neoErr) {
      console.warn('[Neo4j Notice] Appointment graph relationship skipped:', neoErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully and persisted to disk',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// READ ALL Appointments
exports.getAllAppointments = async (req, res, next) => {
  try {
    const { patientId, doctorId, status, date } = req.query;
    let appointments = [];

    try {
      appointments = await Appointment.find().sort({ date: -1, time: -1 }).lean();
    } catch (dbErr) {
      appointments = [];
    }

    const localApts = localStore.getCollection('appointments');
    const existingIds = new Set(appointments.map(a => a.appointmentId));
    localApts.forEach(la => {
      if (!existingIds.has(la.appointmentId)) {
        appointments.push(la);
        existingIds.add(la.appointmentId);
      }
    });

    if (appointments.length === 0) {
      appointments = localApts;
    }

    if (patientId) appointments = appointments.filter(a => (a.patientId || '').toUpperCase() === patientId.toUpperCase());
    if (doctorId) appointments = appointments.filter(a => (a.doctorId || '').toUpperCase() === doctorId.toUpperCase());
    if (status) appointments = appointments.filter(a => (a.status || '').toLowerCase() === status.toLowerCase());
    if (date) appointments = appointments.filter(a => a.date === date);

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

// READ Appointment by ID
exports.getAppointmentById = async (req, res, next) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    let appointment = null;

    try {
      appointment = await Appointment.findOne({ appointmentId: id }).lean();
    } catch (e) {
      appointment = null;
    }

    if (!appointment) {
      appointment = localStore.findOne('appointments', a => a.appointmentId === id);
    }

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: `Appointment with ID '${id}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE Appointment
exports.updateAppointment = async (req, res, next) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    const updates = { ...req.body };
    delete updates.appointmentId;

    if (updates.patientId) updates.patientId = updates.patientId.toUpperCase().trim();
    if (updates.doctorId) updates.doctorId = updates.doctorId.toUpperCase().trim();

    const localUpdated = localStore.update('appointments', a => a.appointmentId === id, updates);

    let appointment = localUpdated;
    try {
      const dbApt = await Appointment.findOneAndUpdate(
        { appointmentId: id },
        { $set: updates },
        { new: true, runValidators: true }
      );
      if (dbApt) appointment = dbApt;
    } catch (e) {}

    if (!appointment && !localUpdated) {
      return res.status(404).json({
        success: false,
        error: `Appointment with ID '${id}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      data: appointment || localUpdated,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE Appointment
exports.deleteAppointment = async (req, res, next) => {
  try {
    const id = req.params.id.toUpperCase().trim();
    localStore.delete('appointments', a => a.appointmentId === id);

    let appointment = null;
    try {
      appointment = await Appointment.findOneAndDelete({ appointmentId: id });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `Appointment ${id} deleted successfully`,
      data: appointment || { appointmentId: id },
    });
  } catch (error) {
    next(error);
  }
};
