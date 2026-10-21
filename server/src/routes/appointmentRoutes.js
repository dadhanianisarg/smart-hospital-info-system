const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { validateAppointment } = require('../middleware/validator');

router.route('/')
  .post(validateAppointment, appointmentController.createAppointment)
  .get(appointmentController.getAllAppointments);

router.route('/:id')
  .get(appointmentController.getAppointmentById)
  .put(appointmentController.updateAppointment)
  .delete(appointmentController.deleteAppointment);

module.exports = router;
