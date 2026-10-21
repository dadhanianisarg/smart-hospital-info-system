const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');

router.route('/')
  .post(medicineController.createMedicine)
  .get(medicineController.getAllMedicines);

router.route('/:id')
  .get(medicineController.getMedicineById);

module.exports = router;
