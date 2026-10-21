const mongoose = require('mongoose');

const prescribedMedicineSchema = new mongoose.Schema({
  medicineId: { type: String, uppercase: true, trim: true },
  name: { type: String, required: true },
  dosage: { type: String, required: true },
  frequency: { type: String, required: true },
  duration: { type: String, required: true },
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  prescriptionId: {
    type: String,
    required: [true, 'Prescription ID is required'],
    unique: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  patientId: {
    type: String,
    required: [true, 'Patient ID is required'],
    trim: true,
    uppercase: true,
    index: true,
  },
  doctorId: {
    type: String,
    required: [true, 'Doctor ID is required'],
    trim: true,
    uppercase: true,
    index: true,
  },
  medicines: {
    type: [prescribedMedicineSchema],
    default: [],
    validate: {
      validator: (val) => Array.isArray(val) && val.length > 0,
      message: 'Prescription must contain at least one medicine',
    },
  },
  diagnosis: {
    type: String,
    required: [true, 'Diagnosis is required'],
    trim: true,
  },
  instructions: {
    type: String,
    trim: true,
  },
  date: {
    type: String,
    required: [true, 'Prescription date is required (YYYY-MM-DD)'],
    index: true,
  },
}, {
  timestamps: true,
  collection: 'prescriptions',
});

module.exports = mongoose.model('Prescription', prescriptionSchema);
