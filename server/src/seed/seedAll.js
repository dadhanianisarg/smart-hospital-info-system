const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const { connectMongoDB } = require('../config/db');
const { initNeo4j, closeNeo4j } = require('../config/neo4j');
const neo4jService = require('../services/neo4jService');

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Disease = require('../models/Disease');
const Medicine = require('../models/Medicine');

const sampleData = require('./sampleData');

async function seed() {
  console.log('====================================================');
  console.log('   SMART HOSPITAL - DATABASE SEEDING ENGINE');
  console.log('====================================================');

  try {
    // 1. Connect databases
    await connectMongoDB();
    await initNeo4j();

    // 2. Clear MongoDB
    console.log('\n[1/4] Clearing existing MongoDB collections...');
    await Patient.deleteMany({});
    await Doctor.deleteMany({});
    await Department.deleteMany({});
    await Appointment.deleteMany({});
    await Prescription.deleteMany({});
    await Disease.deleteMany({});
    await Medicine.deleteMany({});
    console.log('✓ MongoDB collections cleared.');

    // 3. Insert MongoDB Sample Data
    console.log('\n[2/4] Populating MongoDB collections with sample dataset...');
    await Department.insertMany(sampleData.departments);
    await Doctor.insertMany(sampleData.doctors);
    await Disease.insertMany(sampleData.diseases);
    await Medicine.insertMany(sampleData.medicines);
    await Patient.insertMany(sampleData.patients);
    await Appointment.insertMany(sampleData.appointments);
    await Prescription.insertMany(sampleData.prescriptions);
    console.log('✓ MongoDB sample data successfully populated.');

    // 4. Seed Neo4j Graph
    console.log('\n[3/4] Resetting and seeding Neo4j Graph...');
    await neo4jService.clearAll();

    // Create Nodes
    for (const d of sampleData.departments) {
      await neo4jService.createDepartmentNode(d);
    }
    for (const doc of sampleData.doctors) {
      await neo4jService.createDoctorNode(doc);
    }
    for (const dis of sampleData.diseases) {
      await neo4jService.createDiseaseNode(dis);
    }
    for (const m of sampleData.medicines) {
      await neo4jService.createMedicineNode(m);
    }
    for (const p of sampleData.patients) {
      await neo4jService.createPatientNode(p);
    }
    console.log('✓ Neo4j nodes created (Patient, Doctor, Department, Disease, Medicine).');

    // Create Relationships
    console.log('\n[4/4] Creating Graph Relationships...');
    let relCount = 0;

    // Doctor -> BELONGS_TO -> Department
    for (const doc of sampleData.doctors) {
      await neo4jService.createRelationship({
        fromLabel: 'Doctor',
        fromIdKey: 'doctorId',
        fromIdValue: doc.doctorId,
        relType: 'BELONGS_TO',
        toLabel: 'Department',
        toIdKey: 'departmentId',
        toIdValue: doc.departmentId,
      });
      relCount++;
    }

    // Patient -> TREATED_BY -> Doctor (from Appointments & Prescriptions)
    const treatedPairs = new Set();
    sampleData.appointments.forEach(a => treatedPairs.add(`${a.patientId}|${a.doctorId}`));
    sampleData.prescriptions.forEach(p => treatedPairs.add(`${p.patientId}|${p.doctorId}`));

    for (const pair of treatedPairs) {
      const [patientId, doctorId] = pair.split('|');
      await neo4jService.createRelationship({
        fromLabel: 'Patient',
        fromIdKey: 'patientId',
        fromIdValue: patientId,
        relType: 'TREATED_BY',
        toLabel: 'Doctor',
        toIdKey: 'doctorId',
        toIdValue: doctorId,
      });
      relCount++;
    }

    // Patient -> DIAGNOSED_WITH -> Disease
    for (const p of sampleData.patients) {
      if (Array.isArray(p.medicalHistory)) {
        for (const h of p.medicalHistory) {
          const matchedDisease = sampleData.diseases.find(
            d => d.name.toLowerCase().includes(h.disease.toLowerCase()) || h.disease.toLowerCase().includes(d.name.toLowerCase())
          );
          if (matchedDisease) {
            await neo4jService.createRelationship({
              fromLabel: 'Patient',
              fromIdKey: 'patientId',
              fromIdValue: p.patientId,
              relType: 'DIAGNOSED_WITH',
              toLabel: 'Disease',
              toIdKey: 'diseaseId',
              toIdValue: matchedDisease.diseaseId,
              properties: { diagnosedYear: h.diagnosedYear || 2024 },
            });
            relCount++;
          }
        }
      }
    }

    // Doctor -> TREATS -> Disease
    for (const item of sampleData.doctorTreatsDiseases) {
      await neo4jService.createRelationship({
        fromLabel: 'Doctor',
        fromIdKey: 'doctorId',
        fromIdValue: item.doctorId,
        relType: 'TREATS',
        toLabel: 'Disease',
        toIdKey: 'diseaseId',
        toIdValue: item.diseaseId,
      });
      relCount++;
    }

    // Doctor -> PRESCRIBED -> Medicine AND Patient -> TAKES -> Medicine
    for (const rx of sampleData.prescriptions) {
      for (const med of rx.medicines) {
        if (med.medicineId) {
          await neo4jService.createRelationship({
            fromLabel: 'Doctor',
            fromIdKey: 'doctorId',
            fromIdValue: rx.doctorId,
            relType: 'PRESCRIBED',
            toLabel: 'Medicine',
            toIdKey: 'medicineId',
            toIdValue: med.medicineId,
            properties: { dosage: med.dosage, date: rx.date },
          });
          relCount++;

          await neo4jService.createRelationship({
            fromLabel: 'Patient',
            fromIdKey: 'patientId',
            fromIdValue: rx.patientId,
            relType: 'TAKES',
            toLabel: 'Medicine',
            toIdKey: 'medicineId',
            toIdValue: med.medicineId,
          });
          relCount++;
        }
      }
    }

    console.log(`✓ Created ${relCount} relationships in graph.`);

    // Summary Verification
    const counts = {
      patients: await Patient.countDocuments(),
      doctors: await Doctor.countDocuments(),
      departments: await Department.countDocuments(),
      diseases: await Disease.countDocuments(),
      medicines: await Medicine.countDocuments(),
      appointments: await Appointment.countDocuments(),
      prescriptions: await Prescription.countDocuments(),
    };

    console.log('\n====================================================');
    console.log('   DATABASE SEED SUMMARY (MONGODB & NEO4J)');
    console.log('====================================================');
    console.table(counts);
    console.log('Seeding completed successfully!\n');

  } catch (err) {
    console.error('Fatal Error during seeding:', err);
  } finally {
    await mongoose.disconnect();
    await closeNeo4j();
    process.exit(0);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
