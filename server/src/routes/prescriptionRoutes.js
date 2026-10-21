const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');
const { validatePrescription } = require('../middleware/validator');

router.route('/')
  .post(validatePrescription, prescriptionController.createPrescription)
  .get(prescriptionController.getAllPrescriptions);

router.route('/:id')
  .get(prescriptionController.getPrescriptionById)
  .delete(prescriptionController.deletePrescription);

module.exports = router;
