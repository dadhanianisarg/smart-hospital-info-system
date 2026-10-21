const mongoose = require('mongoose');

const diseaseSchema = new mongoose.Schema({
  diseaseId: {
    type: String,
    required: [true, 'Disease ID is required'],
    unique: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Disease name is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
  collection: 'diseases',
});

module.exports = mongoose.model('Disease', diseaseSchema);
