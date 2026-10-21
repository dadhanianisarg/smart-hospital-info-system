const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentId: {
    type: String,
    required: [true, 'Appointment ID is required'],
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
  date: {
    type: String,
    required: [true, 'Appointment date is required (YYYY-MM-DD)'],
    index: true,
  },
  time: {
    type: String,
    required: [true, 'Appointment time is required (HH:MM)'],
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Completed', 'Cancelled', 'In Progress'],
    default: 'Scheduled',
    index: true,
  },
  reason: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
  collection: 'appointments',
});

module.exports = mongoose.model('Appointment', appointmentSchema);
