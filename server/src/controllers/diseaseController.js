const Disease = require('../models/Disease');
const neo4jService = require('../services/neo4jService');

exports.createDisease = async (req, res, next) => {
  try {
    const data = req.body;
    data.diseaseId = data.diseaseId.toUpperCase().trim();

    const existing = await Disease.findOne({ diseaseId: data.diseaseId });
    if (existing) {
      return res.status(409).json({ success: false, error: `Disease ${data.diseaseId} already exists.` });
    }

    const disease = await Disease.create(data);
    await neo4jService.createDiseaseNode({ diseaseId: disease.diseaseId, name: disease.name });

    res.status(201).json({ success: true, data: disease });
  } catch (error) {
    next(error);
  }
};

exports.getAllDiseases = async (req, res, next) => {
  try {
    const diseases = await Disease.find().sort({ name: 1 });
    res.status(200).json({ success: true, count: diseases.length, data: diseases });
  } catch (error) {
    next(error);
  }
};

exports.getDiseaseById = async (req, res, next) => {
  try {
    const disease = await Disease.findOne({ diseaseId: req.params.id.toUpperCase().trim() });
    if (!disease) return res.status(404).json({ success: false, error: 'Disease not found' });
    res.status(200).json({ success: true, data: disease });
  } catch (error) {
    next(error);
  }
};
