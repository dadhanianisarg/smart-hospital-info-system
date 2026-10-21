const express = require('express');
const router = express.Router();
const riskController = require('../controllers/riskController');

router.post('/check', riskController.checkPrescriptionRisk);

module.exports = router;
