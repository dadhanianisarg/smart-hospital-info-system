// Validation utility functions
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && re.test(email);
};

const isValidPhone = (phone) => {
  return typeof phone === 'string' && phone.trim().length >= 7;
};

// Middleware validators
const validatePatient = (req, res, next) => {
  const { patientId, name, age, gender, phone, email } = req.body;
  const errors = [];

  if (!patientId || typeof patientId !== 'string' || !patientId.trim()) {
    errors.push('patientId is required and must be a non-empty string');
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('name is required');
  }
  if (age === undefined || age === null || isNaN(Number(age)) || Number(age) < 0 || Number(age) > 130) {
    errors.push('age must be a number between 0 and 130');
  }
  if (!gender || !['Male', 'Female', 'Other'].includes(gender)) {
    errors.push('gender must be Male, Female, or Other');
  }
  if (!phone || !isValidPhone(phone)) {
    errors.push('valid phone number is required (min 7 digits)');
  }
  if (!email || !isValidEmail(email)) {
    errors.push('valid email address is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
};

const validateDoctor = (req, res, next) => {
  const { doctorId, name, specialization, departmentId, phone, email, experience } = req.body;
  const errors = [];

  if (!doctorId || typeof doctorId !== 'string' || !doctorId.trim()) {
    errors.push('doctorId is required');
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('name is required');
  }
  if (!specialization || typeof specialization !== 'string' || !specialization.trim()) {
    errors.push('specialization is required');
  }
  if (!departmentId || typeof departmentId !== 'string' || !departmentId.trim()) {
    errors.push('departmentId is required');
  }
  if (!phone || !isValidPhone(phone)) {
    errors.push('valid phone number is required');
  }
  if (!email || !isValidEmail(email)) {
    errors.push('valid email address is required');
  }
  if (experience === undefined || isNaN(Number(experience)) || Number(experience) < 0) {
    errors.push('experience must be a non-negative number of years');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
};

const validateDepartment = (req, res, next) => {
  const { departmentId, name } = req.body;
  const errors = [];

  if (!departmentId || typeof departmentId !== 'string' || !departmentId.trim()) {
    errors.push('departmentId is required');
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('name is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
};

const validateAppointment = (req, res, next) => {
  const { appointmentId, patientId, doctorId, date, time } = req.body;
  const errors = [];

  if (!appointmentId || !appointmentId.trim()) errors.push('appointmentId is required');
  if (!patientId || !patientId.trim()) errors.push('patientId is required');
  if (!doctorId || !doctorId.trim()) errors.push('doctorId is required');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('date is required in YYYY-MM-DD format');
  if (!time || !/^\d{2}:\d{2}/.test(time)) errors.push('time is required in HH:MM format');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
};

const validatePrescription = (req, res, next) => {
  const { prescriptionId, patientId, doctorId, medicines, diagnosis, date } = req.body;
  const errors = [];

  if (!prescriptionId || !prescriptionId.trim()) errors.push('prescriptionId is required');
  if (!patientId || !patientId.trim()) errors.push('patientId is required');
  if (!doctorId || !doctorId.trim()) errors.push('doctorId is required');
  if (!diagnosis || !diagnosis.trim()) errors.push('diagnosis is required');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('date is required in YYYY-MM-DD format');
  if (!Array.isArray(medicines) || medicines.length === 0) {
    errors.push('medicines must be a non-empty array of prescribed medications');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
};

module.exports = {
  validatePatient,
  validateDoctor,
  validateDepartment,
  validateAppointment,
  validatePrescription,
};
