const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const app = require('../src/app');
const { connectMongoDB, closeMongoDB } = require('../src/config/db');
const { initNeo4j, closeNeo4j } = require('../src/config/neo4j');

const TEST_PORT = 5005;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

const testResults = [];

function recordTest(id, name, expected, actual, passed) {
  testResults.push({ id, name, expected, actual, status: passed ? 'PASS' : 'FAIL' });
  const symbol = passed ? '✓' : '✗';
  console.log(`[${symbol}] ${id}: ${name} -> ${passed ? 'PASSED' : 'FAILED'}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('    SMART HOSPITAL - API & DATABASE TEST SUITE     ');
  console.log('====================================================');

  await connectMongoDB();
  await initNeo4j();

  const server = app.listen(TEST_PORT);
  console.log(`Test server running at ${BASE_URL}\n`);

  try {
    // 1. Health check
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthJson = await healthRes.json();
    recordTest('TC-SYS-01', 'API Health Check', 200, healthRes.status, healthRes.status === 200 && healthJson.status === 'OK');

    // 2. PATIENT CRUD TESTS
    // 2.1 Get All Patients
    const getAllPatients = await fetch(`${BASE_URL}/patients`);
    const patientsJson = await getAllPatients.json();
    recordTest('TC-PAT-01', 'Get All Patients', 200, getAllPatients.status, getAllPatients.status === 200 && patientsJson.data.length >= 10);

    // 2.2 Get Patient by ID
    const getPatById = await fetch(`${BASE_URL}/patients/P101`);
    const patByIdJson = await getPatById.json();
    recordTest('TC-PAT-02', 'Get Patient by ID (P101)', 200, getPatById.status, getPatById.status === 200 && patByIdJson.data.name === 'Rahul Verma');

    // 2.3 Create Patient (Valid)
    const newPatient = {
      patientId: 'P999',
      name: 'QA Test Patient',
      age: 40,
      gender: 'Male',
      bloodGroup: 'O+',
      phone: '9988776655',
      email: 'qa.patient@example.com',
      address: { street: '100 Test St', city: 'Test City', state: 'TS', zipCode: '123456' },
      medicalHistory: [{ disease: 'Hypertension', diagnosedYear: 2025, notes: 'Test note' }],
    };
    const createPat = await fetch(`${BASE_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPatient),
    });
    const createPatJson = await createPat.json();
    recordTest('TC-PAT-03', 'Create New Patient', 201, createPat.status, createPat.status === 201 && createPatJson.success === true);

    // 2.4 Patient Validation Failure (Invalid email & age)
    const invalidPat = { patientId: 'P998', name: 'Bad Data', age: -5, gender: 'Invalid', phone: '123', email: 'notanemail' };
    const badPatRes = await fetch(`${BASE_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPat),
    });
    recordTest('TC-PAT-04', 'Patient Validation Rejection (Bad Data)', 400, badPatRes.status, badPatRes.status === 400);

    // 2.5 Duplicate Patient ID Rejection
    const dupPatRes = await fetch(`${BASE_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPatient),
    });
    recordTest('TC-PAT-05', 'Duplicate Patient ID Rejection', 409, dupPatRes.status, dupPatRes.status === 409);

    // 2.6 Update Patient
    const updatePat = await fetch(`${BASE_URL}/patients/P999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'QA Test Patient Updated', age: 41 }),
    });
    const updatePatJson = await updatePat.json();
    recordTest('TC-PAT-06', 'Update Patient Details', 200, updatePat.status, updatePat.status === 200 && updatePatJson.data.name === 'QA Test Patient Updated');

    // 2.7 Delete Patient
    const delPat = await fetch(`${BASE_URL}/patients/P999`, { method: 'DELETE' });
    recordTest('TC-PAT-07', 'Delete Patient by ID', 200, delPat.status, delPat.status === 200);

    // 3. DOCTOR CRUD TESTS
    // 3.1 Get All Doctors
    const getDocs = await fetch(`${BASE_URL}/doctors`);
    const docsJson = await getDocs.json();
    recordTest('TC-DOC-01', 'Get All Doctors', 200, getDocs.status, getDocs.status === 200 && docsJson.data.length >= 5);

    // 3.2 Get Doctor by ID
    const getDocById = await fetch(`${BASE_URL}/doctors/D101`);
    const docByIdJson = await getDocById.json();
    recordTest('TC-DOC-02', 'Get Doctor by ID (D101)', 200, getDocById.status, getDocById.status === 200 && docByIdJson.data.doctorId === 'D101');

    // 3.3 Create Doctor (Valid)
    const newDoc = {
      doctorId: 'D999',
      name: 'Dr. QA Tester',
      specialization: 'Testing Specialist',
      departmentId: 'DEP01',
      phone: '9876500000',
      email: 'qa.doc@hospital.org',
      experience: 5,
    };
    const createDoc = await fetch(`${BASE_URL}/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDoc),
    });
    recordTest('TC-DOC-03', 'Create New Doctor', 201, createDoc.status, createDoc.status === 201);

    // 3.4 Update Doctor
    const updateDoc = await fetch(`${BASE_URL}/doctors/D999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experience: 6 }),
    });
    recordTest('TC-DOC-04', 'Update Doctor Details', 200, updateDoc.status, updateDoc.status === 200);

    // 3.5 Delete Doctor
    const delDoc = await fetch(`${BASE_URL}/doctors/D999`, { method: 'DELETE' });
    recordTest('TC-DOC-05', 'Delete Doctor by ID', 200, delDoc.status, delDoc.status === 200);

    // 4. DEPARTMENT CRUD TESTS
    // 4.1 Get All Departments
    const getDepts = await fetch(`${BASE_URL}/departments`);
    const deptsJson = await getDepts.json();
    recordTest('TC-DEP-01', 'Get All Departments', 200, getDepts.status, getDepts.status === 200 && deptsJson.data.length >= 4);

    // 4.2 Create Department
    const newDept = { departmentId: 'DEP99', name: 'QA Diagnostics', description: 'Testing department' };
    const createDept = await fetch(`${BASE_URL}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDept),
    });
    recordTest('TC-DEP-02', 'Create New Department', 201, createDept.status, createDept.status === 201);

    // 4.3 Delete Department
    const delDept = await fetch(`${BASE_URL}/departments/DEP99`, { method: 'DELETE' });
    recordTest('TC-DEP-03', 'Delete Department', 200, delDept.status, delDept.status === 200);

    // 5. APPOINTMENT CRUD TESTS
    // 5.1 Get All Appointments
    const getApts = await fetch(`${BASE_URL}/appointments`);
    const aptsJson = await getApts.json();
    recordTest('TC-APT-01', 'Get All Appointments', 200, getApts.status, getApts.status === 200 && aptsJson.data.length >= 10);

    // 5.2 Create Appointment
    const newApt = {
      appointmentId: 'APT999',
      patientId: 'P101',
      doctorId: 'D101',
      date: '2026-10-01',
      time: '11:00',
      status: 'Scheduled',
      reason: 'Automated test appointment',
    };
    const createApt = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newApt),
    });
    recordTest('TC-APT-02', 'Create New Appointment', 201, createApt.status, createApt.status === 201);

    // 5.3 Update Appointment Status
    const updateApt = await fetch(`${BASE_URL}/appointments/APT999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Completed' }),
    });
    const updateAptJson = await updateApt.json();
    recordTest('TC-APT-03', 'Update Appointment Status', 200, updateApt.status, updateApt.status === 200 && updateAptJson.data.status === 'Completed');

    // 5.4 Delete Appointment
    const delApt = await fetch(`${BASE_URL}/appointments/APT999`, { method: 'DELETE' });
    recordTest('TC-APT-04', 'Delete Appointment', 200, delApt.status, delApt.status === 200);

    // 6. PRESCRIPTION CRUD TESTS
    // 6.1 Get All Prescriptions
    const getRxs = await fetch(`${BASE_URL}/prescriptions`);
    const rxsJson = await getRxs.json();
    recordTest('TC-RX-01', 'Get All Prescriptions', 200, getRxs.status, getRxs.status === 200 && rxsJson.data.length >= 8);

    // 6.2 Create Prescription
    const newRx = {
      prescriptionId: 'RX999',
      patientId: 'P101',
      doctorId: 'D101',
      diagnosis: 'Hypertension Stage 1',
      instructions: 'Take daily with water',
      date: '2026-10-01',
      medicines: [{ medicineId: 'MED01', name: 'Amlodipine 5mg', dosage: '5mg', frequency: 'Once daily', duration: '15 days' }],
    };
    const createRx = await fetch(`${BASE_URL}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRx),
    });
    recordTest('TC-RX-02', 'Create Prescription with Embedded Medicines', 201, createRx.status, createRx.status === 201);

    // 6.3 Delete Prescription
    const delRx = await fetch(`${BASE_URL}/prescriptions/RX999`, { method: 'DELETE' });
    recordTest('TC-RX-03', 'Delete Prescription', 200, delRx.status, delRx.status === 200);

    // 7. NEO4J & GRAPH QUERY TESTS
    // 7.1 Get Patient Complete Graph (P101)
    const getPatGraph = await fetch(`${BASE_URL}/graph/patient/P101`);
    const patGraphJson = await getPatGraph.json();
    const hasDoctors = patGraphJson.data && patGraphJson.data.doctors.length > 0;
    const hasDiseases = patGraphJson.data && patGraphJson.data.diseases.length > 0;
    const hasMedicines = patGraphJson.data && patGraphJson.data.medicines.length > 0;
    recordTest('TC-GRP-01', 'Get Patient Complete Relationship Graph (P101)', 200, getPatGraph.status, getPatGraph.status === 200 && hasDoctors && hasDiseases && hasMedicines);

    // 7.2 Get Doctors by Department (DEP01)
    const getDeptDocs = await fetch(`${BASE_URL}/graph/department/DEP01/doctors`);
    const deptDocsJson = await getDeptDocs.json();
    recordTest('TC-GRP-02', 'Get Doctors in Department (DEP01)', 200, getDeptDocs.status, getDeptDocs.status === 200 && deptDocsJson.data.length >= 2);

    // 7.3 Get Diseases Associated with Patient (P101)
    const getPatDis = await fetch(`${BASE_URL}/graph/patient/P101/diseases`);
    const patDisJson = await getPatDis.json();
    recordTest('TC-GRP-03', 'Get Diseases Associated with Patient (P101)', 200, getPatDis.status, getPatDis.status === 200 && patDisJson.data.length > 0);

    // 7.4 Get Medicines Prescribed/Taken by Patient (P101)
    const getPatMeds = await fetch(`${BASE_URL}/graph/patient/P101/medicines`);
    const patMedsJson = await getPatMeds.json();
    recordTest('TC-GRP-04', 'Get Medicines Prescribed/Taken by Patient (P101)', 200, getPatMeds.status, getPatMeds.status === 200 && patMedsJson.data.length > 0);

    // 7.5 Get Full Overview Graph
    const getFullGraph = await fetch(`${BASE_URL}/graph/all`);
    const fullGraphJson = await getFullGraph.json();
    recordTest('TC-GRP-05', 'Get Full Graph for Visualizer', 200, getFullGraph.status, getFullGraph.status === 200 && fullGraphJson.data.nodes.length >= 37 && fullGraphJson.data.edges.length >= 40);

    // 7.6 Dashboard Statistics
    const getStats = await fetch(`${BASE_URL}/graph/stats`);
    const statsJson = await getStats.json();
    recordTest('TC-DASH-01', 'Get Dashboard Multi-Database Statistics', 200, getStats.status, getStats.status === 200 && statsJson.data.totalPatients >= 10);

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    server.close();
    if (closeMongoDB) await closeMongoDB();
    await closeNeo4j();

    const passed = testResults.filter(t => t.status === 'PASS').length;
    const failed = testResults.filter(t => t.status === 'FAIL').length;
    console.log('\n====================================================');
    console.log(`TOTAL TESTS: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('====================================================\n');
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests, testResults };
