const mongoose = require('mongoose');

let memoryMongoServer = null;

const localStore = require('../services/localStore');

const seedInitialDataIfNeeded = async () => {
  try {
    const Patient = require('../models/Patient');
    const Department = require('../models/Department');
    const Doctor = require('../models/Doctor');
    const Disease = require('../models/Disease');
    const Medicine = require('../models/Medicine');
    const Appointment = require('../models/Appointment');
    const Prescription = require('../models/Prescription');

    const store = localStore.load();
    const count = await Patient.countDocuments();

    const cleanForMongo = (items) => {
      if (!Array.isArray(items)) return [];
      return items.map(item => {
        const doc = { ...item };
        if (doc._id && !/^[0-9a-fA-F]{24}$/.test(String(doc._id))) {
          delete doc._id;
        }
        return doc;
      });
    };

    if (count === 0) {
      console.log('[MongoDB] Seeding clinical datasets from persistent disk store...');
      if (store.departments && store.departments.length) await Department.insertMany(cleanForMongo(store.departments));
      if (store.doctors && store.doctors.length) await Doctor.insertMany(cleanForMongo(store.doctors));
      if (store.diseases && store.diseases.length) await Disease.insertMany(cleanForMongo(store.diseases));
      if (store.medicines && store.medicines.length) await Medicine.insertMany(cleanForMongo(store.medicines));
      if (store.patients && store.patients.length) await Patient.insertMany(cleanForMongo(store.patients));
      if (store.appointments && store.appointments.length) await Appointment.insertMany(cleanForMongo(store.appointments));
      if (store.prescriptions && store.prescriptions.length) await Prescription.insertMany(cleanForMongo(store.prescriptions));
      console.log('[MongoDB] Persistent disk dataset successfully synced to database.');
    } else {
      // Sync any missing patients or doctors from store.json
      if (Array.isArray(store.patients)) {
        for (const p of cleanForMongo(store.patients)) {
          const exists = await Patient.findOne({ patientId: p.patientId });
          if (!exists) await Patient.create(p);
        }
      }
      if (Array.isArray(store.doctors)) {
        for (const d of cleanForMongo(store.doctors)) {
          const exists = await Doctor.findOne({ doctorId: d.doctorId });
          if (!exists) await Doctor.create(d);
        }
      }
      if (Array.isArray(store.prescriptions)) {
        for (const rx of cleanForMongo(store.prescriptions)) {
          const exists = await Prescription.findOne({ prescriptionId: rx.prescriptionId });
          if (!exists) await Prescription.create(rx);
        }
      }
      if (Array.isArray(store.appointments)) {
        for (const a of cleanForMongo(store.appointments)) {
          const exists = await Appointment.findOne({ appointmentId: a.appointmentId });
          if (!exists) await Appointment.create(a);
        }
      }
    }
  } catch (err) {
    console.warn('[MongoDB] Seed sync notice:', err.message);
  }
};

const connectMongoDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_hospital';

  try {
    // Attempt connecting to the configured MongoDB URI with a fast 2-second timeout
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`);
    await seedInitialDataIfNeeded();
    return conn;
  } catch (error) {
    console.warn(`[MongoDB] Local/remote daemon at ${uri} was unreachable (${error.message}).`);
    console.log('[MongoDB] Launching embedded in-memory database engine for evaluation...');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryMongoServer = await MongoMemoryServer.create();
      const memUri = memoryMongoServer.getUri();
      const conn = await mongoose.connect(memUri);
      console.log(`[MongoDB] Embedded in-memory MongoDB engine online at: ${memUri}`);
      await seedInitialDataIfNeeded();
      return conn;
    } catch (memErr) {
      console.error(`[MongoDB] Failed to start embedded engine: ${memErr.message}`);
      throw error;
    }
  }
};

const closeMongoDB = async () => {
  try {
    await mongoose.disconnect();
    if (memoryMongoServer) {
      await memoryMongoServer.stop();
      memoryMongoServer = null;
    }
  } catch (err) {
    console.error('[MongoDB] Error during disconnect:', err.message);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected from database');
});

module.exports = { connectMongoDB, closeMongoDB };
