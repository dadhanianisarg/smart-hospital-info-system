const fs = require('fs');
const path = require('path');
const mongoose = require('../server/node_modules/mongoose');

const Patient = require('../server/src/models/Patient');
const Doctor = require('../server/src/models/Doctor');
const Department = require('../server/src/models/Department');
const Appointment = require('../server/src/models/Appointment');
const Prescription = require('../server/src/models/Prescription');
const Disease = require('../server/src/models/Disease');
const Medicine = require('../server/src/models/Medicine');
const sampleData = require('../server/src/seed/sampleData');

async function exportDatabases() {
  console.log('--- Starting Database Export ---');
  await mongoose.connect('mongodb://localhost:27017/smart_hospital');

  const collections = {
    patients: await Patient.find().lean(),
    doctors: await Doctor.find().lean(),
    departments: await Department.find().lean(),
    appointments: await Appointment.find().lean(),
    prescriptions: await Prescription.find().lean(),
    diseases: await Disease.find().lean(),
    medicines: await Medicine.find().lean(),
  };

  const mongoDirs = [
    path.join(__dirname, 'mongodb'),
    path.join(__dirname, '../review2_submission/database/mongodb'),
  ];

  mongoDirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    for (const [colName, data] of Object.entries(collections)) {
      const filePath = path.join(dir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`Exported MongoDB collection [${colName}] -> ${filePath} (${data.length} docs)`);
    }

    // Full combined dump
    const fullDumpPath = path.join(dir, 'smart_hospital_full_dump.json');
    fs.writeFileSync(fullDumpPath, JSON.stringify(collections, null, 2), 'utf-8');
    console.log(`Exported Combined Dump -> ${fullDumpPath}`);
  });

  // Generate Neo4j Cypher Exports
  const initCypher = `// ====================================================================
// SMART HOSPITAL INFORMATION SYSTEM - NEO4J SCHEMA DEFINITIONS & CONSTRAINTS
// ====================================================================

// Uniqueness Constraints for Graph Entity Nodes
CREATE CONSTRAINT patient_id_unique IF NOT EXISTS FOR (p:Patient) REQUIRE p.patientId IS UNIQUE;
CREATE CONSTRAINT doctor_id_unique IF NOT EXISTS FOR (d:Doctor) REQUIRE d.doctorId IS UNIQUE;
CREATE CONSTRAINT department_id_unique IF NOT EXISTS FOR (dept:Department) REQUIRE dept.departmentId IS UNIQUE;
CREATE CONSTRAINT disease_id_unique IF NOT EXISTS FOR (dis:Disease) REQUIRE dis.diseaseId IS UNIQUE;
CREATE CONSTRAINT medicine_id_unique IF NOT EXISTS FOR (m:Medicine) REQUIRE m.medicineId IS UNIQUE;

// Performance Indexes for Traversal
CREATE INDEX patient_name_idx IF NOT EXISTS FOR (p:Patient) ON (p.name);
CREATE INDEX doctor_specialization_idx IF NOT EXISTS FOR (d:Doctor) ON (d.specialization);
`;

  let dataCypher = `// ====================================================================
// SMART HOSPITAL INFORMATION SYSTEM - REPRODUCIBLE CYPHER SEED DATA
// Project: Smart Hospital Information System using MongoDB and Neo4j
// ====================================================================

// 1. CREATE DEPARTMENTS
`;

  sampleData.departments.forEach(dept => {
    dataCypher += `MERGE (dept:Department { departmentId: "${dept.departmentId}" }) SET dept.name = "${dept.name}", dept.description = "${dept.description}";\n`;
  });

  dataCypher += `\n// 2. CREATE DOCTORS & ASSIGN TO DEPARTMENTS\n`;
  sampleData.doctors.forEach(doc => {
    dataCypher += `MERGE (d:Doctor { doctorId: "${doc.doctorId}" }) SET d.name = "${doc.name}", d.specialization = "${doc.specialization}", d.experience = ${doc.experience};\n`;
    dataCypher += `MATCH (d:Doctor { doctorId: "${doc.doctorId}" }), (dept:Department { departmentId: "${doc.departmentId}" }) MERGE (d)-[:BELONGS_TO]->(dept);\n`;
  });

  dataCypher += `\n// 3. CREATE DISEASES\n`;
  sampleData.diseases.forEach(dis => {
    dataCypher += `MERGE (dis:Disease { diseaseId: "${dis.diseaseId}" }) SET dis.name = "${dis.name}", dis.description = "${dis.description}";\n`;
  });

  dataCypher += `\n// 4. CREATE MEDICINES\n`;
  sampleData.medicines.forEach(med => {
    dataCypher += `MERGE (m:Medicine { medicineId: "${med.medicineId}" }) SET m.name = "${med.name}", m.category = "${med.category}";\n`;
  });

  dataCypher += `\n// 5. CREATE PATIENTS & DIAGNOSED_WITH RELATIONSHIPS\n`;
  sampleData.patients.forEach(pat => {
    dataCypher += `MERGE (p:Patient { patientId: "${pat.patientId}" }) SET p.name = "${pat.name}", p.age = ${pat.age}, p.gender = "${pat.gender}";\n`;
    if (Array.isArray(pat.medicalHistory)) {
      pat.medicalHistory.forEach(h => {
        const matched = sampleData.diseases.find(d => d.name.toLowerCase().includes(h.disease.toLowerCase()) || h.disease.toLowerCase().includes(d.name.toLowerCase()));
        if (matched) {
          dataCypher += `MATCH (p:Patient { patientId: "${pat.patientId}" }), (dis:Disease { diseaseId: "${matched.diseaseId}" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: ${h.diagnosedYear || 2024} }]->(dis);\n`;
        }
      });
    }
  });

  dataCypher += `\n// 6. DOCTOR TREATS DISEASE RELATIONSHIPS\n`;
  sampleData.doctorTreatsDiseases.forEach(item => {
    dataCypher += `MATCH (d:Doctor { doctorId: "${item.doctorId}" }), (dis:Disease { diseaseId: "${item.diseaseId}" }) MERGE (d)-[:TREATS]->(dis);\n`;
  });

  dataCypher += `\n// 7. APPOINTMENT & PRESCRIPTION RELATIONSHIPS (TREATED_BY, PRESCRIBED, TAKES)\n`;
  sampleData.appointments.forEach(apt => {
    dataCypher += `MATCH (p:Patient { patientId: "${apt.patientId}" }), (d:Doctor { doctorId: "${apt.doctorId}" }) MERGE (p)-[:TREATED_BY]->(d);\n`;
  });

  sampleData.prescriptions.forEach(rx => {
    dataCypher += `MATCH (p:Patient { patientId: "${rx.patientId}" }), (d:Doctor { doctorId: "${rx.doctorId}" }) MERGE (p)-[:TREATED_BY]->(d);\n`;
    rx.medicines.forEach(m => {
      if (m.medicineId) {
        dataCypher += `MATCH (d:Doctor { doctorId: "${rx.doctorId}" }), (m:Medicine { medicineId: "${m.medicineId}" }) MERGE (d)-[:PRESCRIBED { dosage: "${m.dosage}", date: "${rx.date}" }]->(m);\n`;
        dataCypher += `MATCH (p:Patient { patientId: "${rx.patientId}" }), (m:Medicine { medicineId: "${m.medicineId}" }) MERGE (p)-[:TAKES]->(m);\n`;
      }
    });
  });

  const neoDirs = [
    path.join(__dirname, 'neo4j'),
    path.join(__dirname, '../review2_submission/database/neo4j'),
  ];

  neoDirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'init_graph.cypher'), initCypher, 'utf-8');
    fs.writeFileSync(path.join(dir, 'sample_data.cypher'), dataCypher, 'utf-8');
    console.log(`Exported Neo4j Cypher scripts -> ${dir}`);
  });

  await mongoose.disconnect();
  console.log('--- Database Export Finished Successfully ---');
}

if (require.main === module) {
  exportDatabases().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { exportDatabases };
