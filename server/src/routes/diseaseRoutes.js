const express = require('express');
const router = express.Router();
const diseaseController = require('../controllers/diseaseController');

router.route('/')
  .post(diseaseController.createDisease)
  .get(diseaseController.getAllDiseases);

router.route('/:id')
  .get(diseaseController.getDiseaseById);

module.exports = router;
