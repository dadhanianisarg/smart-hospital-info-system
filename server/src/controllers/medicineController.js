const Medicine = require('../models/Medicine');
const neo4jService = require('../services/neo4jService');
const localStore = require('../services/localStore');

exports.createMedicine = async (req, res, next) => {
  try {
    const data = req.body;
    data.medicineId = data.medicineId.toUpperCase().trim();

    const existing = await Medicine.findOne({ medicineId: data.medicineId });
    if (existing) {
      return res.status(409).json({ success: false, error: `Medicine ${data.medicineId} already exists.` });
    }

    localStore.insert('medicines', data);
    const medicine = await Medicine.create(data);
    try {
      await neo4jService.createMedicineNode({
        medicineId: medicine.medicineId,
        name: medicine.name,
        category: medicine.category,
      });
    } catch (e) {}

    res.status(201).json({ success: true, data: medicine });
  } catch (error) {
    next(error);
  }
};

const defaultMedicines = [
  { medicineId: 'MED11', name: 'Ibuprofen 400mg', category: 'NSAID', description: 'Non-steroidal anti-inflammatory' },
  { medicineId: 'MED12', name: 'Lisinopril 10mg', category: 'ACE Inhibitor', description: 'ACE inhibitor antihypertensive' },
  { medicineId: 'MED01', name: 'Amlodipine 5mg', category: 'Antihypertensive', description: 'Calcium channel blocker' },
  { medicineId: 'MED05', name: 'Paracetamol 650mg', category: 'Analgesic', description: 'Analgesic antipyretic' },
  { medicineId: 'MED07', name: 'Aceclofenac 100mg', category: 'NSAID', description: 'Potent non-steroidal anti-inflammatory' },
  { medicineId: 'MED10', name: 'Telmisartan 40mg', category: 'Antihypertensive', description: 'Angiotensin II receptor blocker' },
  { medicineId: 'MED13', name: 'Amoxicillin 500mg', category: 'Antibiotic', description: 'Broad-spectrum antibiotic' },
  { medicineId: 'MED14', name: 'Warfarin 5mg', category: 'Anticoagulant', description: 'Anticoagulant agent' },
  { medicineId: 'MED02', name: 'Atorvastatin 20mg', category: 'Lipid-Lowering', description: 'Statin' },
  { medicineId: 'MED03', name: 'Metformin 500mg', category: 'Antidiabetic', description: 'Biguanide' },
  { medicineId: 'MED04', name: 'Sumatriptan 50mg', category: 'Antimigraine', description: 'Antimigraine' },
  { medicineId: 'MED06', name: 'Glucosamine 500mg', category: 'Chondroprotective', description: 'Joint health' },
  { medicineId: 'MED08', name: 'Montelukast 10mg', category: 'Antiasthmatic', description: 'Leukotriene receptor antagonist' },
  { medicineId: 'MED09', name: 'Pantoprazole 40mg', category: 'Proton Pump Inhibitor', description: 'Gastric acid suppressor' },
];

exports.getAllMedicines = async (req, res, next) => {
  try {
    let medicines = [];
    try {
      medicines = await Medicine.find().sort({ name: 1 });
    } catch (dbErr) {
      medicines = [];
    }
    
    if (!medicines || medicines.length === 0) {
      medicines = defaultMedicines;
    } else {
      defaultMedicines.forEach(dm => {
        if (!medicines.some(m => m.name.toLowerCase().includes(dm.name.toLowerCase().split(' ')[0]))) {
          medicines.push(dm);
        }
      });
    }
    res.status(200).json({ success: true, count: medicines.length, data: medicines });
  } catch (error) {
    res.status(200).json({ success: true, count: defaultMedicines.length, data: defaultMedicines });
  }
};

exports.getMedicineById = async (req, res, next) => {
  try {
    const medicine = await Medicine.findOne({ medicineId: req.params.id.toUpperCase().trim() });
    if (!medicine) return res.status(404).json({ success: false, error: 'Medicine not found' });
    res.status(200).json({ success: true, data: medicine });
  } catch (error) {
    next(error);
  }
};
