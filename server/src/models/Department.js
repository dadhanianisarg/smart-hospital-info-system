const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  departmentId: {
    type: String,
    required: [true, 'Department ID is required'],
    unique: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Department name is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
  collection: 'departments',
});

module.exports = mongoose.model('Department', departmentSchema);
