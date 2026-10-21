const express = require('express');
const router = express.Router();
const graphController = require('../controllers/graphController');

// Node creation endpoints
router.post('/nodes/patient', graphController.createPatientNode);
router.post('/nodes/doctor', graphController.createDoctorNode);
router.post('/nodes/department', graphController.createDepartmentNode);
router.post('/nodes/disease', graphController.createDiseaseNode);
router.post('/nodes/medicine', graphController.createMedicineNode);

// Relationship creation endpoint
router.post('/relationships', graphController.createRelationship);

// Graph query endpoints
router.get('/patient/:patientId', graphController.getPatientGraph);
router.get('/department/:departmentId/doctors', graphController.getDoctorsByDepartment);
router.get('/patient/:patientId/diseases', graphController.getDiseasesByPatient);
router.get('/patient/:patientId/medicines', graphController.getMedicinesByPatient);
router.get('/all', graphController.getFullGraph);
router.get('/stats', graphController.getDashboardStats);

module.exports = router;
