const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const diseaseRoutes = require('./routes/diseaseRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const graphRoutes = require('./routes/graphRoutes');
const riskRoutes = require('./routes/riskRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allows local React frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Smart Hospital Information System API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/diseases', diseaseRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/risk', riskRoutes);

// Serve client dist if built
const clientDistPath = require('path').join(__dirname, '../../client/dist');
const fs = require('fs');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// Catch-all 404 route for API, or SPA fallback for frontend
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: `API route ${req.originalUrl} not found`,
    });
  }
  if (fs.existsSync(require('path').join(clientDistPath, 'index.html'))) {
    return res.sendFile(require('path').join(clientDistPath, 'index.html'));
  }
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;
