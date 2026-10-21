const mongoose = require('mongoose');

const medicalHistorySchema = new mongoose.Schema({
  disease: { type: String, required: true },
  diagnosedYear: { type: Number },
  notes: { type: String },
}, { _id: false });

const addressSchema = new mongoose.Schema({
  street: { type: String },
  city: { type: String },
  state: { type: String },
  zipCode: { type: String },
}, { _id: false });

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: [true, 'Patient ID is required'],
    unique: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Patient name is required'],
    trim: true,
  },
  age: {
    type: Number,
    required: [true, 'Age is required'],
    min: [0, 'Age cannot be negative'],
    max: [130, 'Age cannot exceed 130'],
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: ['Male', 'Female', 'Other'],
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
    default: 'Unknown',
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    index: true,
  },
  address: {
    type: addressSchema,
    default: {},
  },
  medicalHistory: {
    type: [medicalHistorySchema],
    default: [],
  },
}, {
  timestamps: true,
  collection: 'patients',
});

module.exports = mongoose.model('Patient', patientSchema);
