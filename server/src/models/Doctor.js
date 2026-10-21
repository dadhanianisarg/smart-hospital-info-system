const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  doctorId: {
    type: String,
    required: [true, 'Doctor ID is required'],
    unique: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Doctor name is required'],
    trim: true,
  },
  specialization: {
    type: String,
    required: [true, 'Specialization is required'],
    trim: true,
  },
  departmentId: {
    type: String,
    required: [true, 'Department ID is required'],
    trim: true,
    uppercase: true,
    index: true,
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
  },
  experience: {
    type: Number,
    required: [true, 'Experience (in years) is required'],
    min: [0, 'Experience cannot be negative'],
  },
}, {
  timestamps: true,
  collection: 'doctors',
});

module.exports = mongoose.model('Doctor', doctorSchema);
