const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { validatePatient } = require('../middleware/validator');

router.route('/')
  .post(validatePatient, patientController.createPatient)
  .get(patientController.getAllPatients);

router.route('/:id')
  .get(patientController.getPatientById)
  .put(patientController.updatePatient)
  .delete(patientController.deletePatient);

module.exports = router;
