const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { validateDoctor } = require('../middleware/validator');

router.route('/')
  .post(validateDoctor, doctorController.createDoctor)
  .get(doctorController.getAllDoctors);

router.route('/:id')
  .get(doctorController.getDoctorById)
  .put(doctorController.updateDoctor)
  .delete(doctorController.deleteDoctor);

module.exports = router;
