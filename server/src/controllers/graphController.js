const neo4jService = require('../services/neo4jService');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');

// 1. Create Patient Node
exports.createPatientNode = async (req, res, next) => {
  try {
    const { patientId, name, age, gender } = req.body;
    if (!patientId || !name) {
      return res.status(400).json({ success: false, error: 'patientId and name are required' });
    }
    const result = await neo4jService.createPatientNode({
      patientId: patientId.toUpperCase().trim(),
      name,
      age: Number(age) || 0,
      gender: gender || 'Other',
    });
    res.status(201).json({ success: true, message: 'Patient node created in Neo4j', data: result });
  } catch (error) {
    next(error);
  }
};

// 2. Create Doctor Node
exports.createDoctorNode = async (req, res, next) => {
  try {
    const { doctorId, name, specialization } = req.body;
    if (!doctorId || !name) {
      return res.status(400).json({ success: false, error: 'doctorId and name are required' });
    }
    const result = await neo4jService.createDoctorNode({
      doctorId: doctorId.toUpperCase().trim(),
      name,
      specialization: specialization || 'General Medicine',
    });
    res.status(201).json({ success: true, message: 'Doctor node created in Neo4j', data: result });
  } catch (error) {
    next(error);
  }
};

// 3. Create Department Node
exports.createDepartmentNode = async (req, res, next) => {
  try {
    const { departmentId, name } = req.body;
    if (!departmentId || !name) {
      return res.status(400).json({ success: false, error: 'departmentId and name are required' });
    }
    const result = await neo4jService.createDepartmentNode({
      departmentId: departmentId.toUpperCase().trim(),
      name,
    });
    res.status(201).json({ success: true, message: 'Department node created in Neo4j', data: result });
  } catch (error) {
    next(error);
  }
};

// 4. Create Disease Node
exports.createDiseaseNode = async (req, res, next) => {
  try {
    const { diseaseId, name } = req.body;
    if (!diseaseId || !name) {
      return res.status(400).json({ success: false, error: 'diseaseId and name are required' });
    }
    const result = await neo4jService.createDiseaseNode({
      diseaseId: diseaseId.toUpperCase().trim(),
      name,
    });
    res.status(201).json({ success: true, message: 'Disease node created in Neo4j', data: result });
  } catch (error) {
    next(error);
  }
};

// 5. Create Medicine Node
exports.createMedicineNode = async (req, res, next) => {
  try {
    const { medicineId, name, category } = req.body;
    if (!medicineId || !name) {
      return res.status(400).json({ success: false, error: 'medicineId and name are required' });
    }
    const result = await neo4jService.createMedicineNode({
      medicineId: medicineId.toUpperCase().trim(),
      name,
      category: category || '',
    });
    res.status(201).json({ success: true, message: 'Medicine node created in Neo4j', data: result });
  } catch (error) {
    next(error);
  }
};

// 6. Create Relationships
exports.createRelationship = async (req, res, next) => {
  try {
    const { fromLabel, fromIdKey, fromIdValue, relType, toLabel, toIdKey, toIdValue, properties } = req.body;
    if (!fromLabel || !fromIdValue || !relType || !toLabel || !toIdValue) {
      return res.status(400).json({
        success: false,
        error: 'fromLabel, fromIdValue, relType, toLabel, toIdValue are required',
      });
    }

    const result = await neo4jService.createRelationship({
      fromLabel,
      fromIdKey: fromIdKey || (fromLabel.toLowerCase() + 'Id'),
      fromIdValue: fromIdValue.toUpperCase().trim(),
      relType: relType.toUpperCase().trim(),
      toLabel,
      toIdKey: toIdKey || (toLabel.toLowerCase() + 'Id'),
      toIdValue: toIdValue.toUpperCase().trim(),
      properties: properties || {},
    });

    res.status(201).json({ success: true, message: `Relationship ${relType} created in Neo4j`, data: result });
  } catch (error) {
    next(error);
  }
};

// 7. Get Patient's Complete Relationship Graph
exports.getPatientGraph = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const graph = await neo4jService.getPatientGraph(patientId.toUpperCase().trim());

    if (!graph) {
      return res.status(404).json({
        success: false,
        error: `No graph found for patientId '${patientId}'`,
      });
    }

    res.status(200).json({
      success: true,
      data: graph,
    });
  } catch (error) {
    next(error);
  }
};

// 8. Get Doctors in a Department
exports.getDoctorsByDepartment = async (req, res, next) => {
  try {
    const { departmentId } = req.params;
    const doctors = await neo4jService.getDoctorsByDepartment(departmentId.toUpperCase().trim());
    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    next(error);
  }
};

// 9. Get Diseases associated with a Patient
exports.getDiseasesByPatient = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const diseases = await neo4jService.getDiseasesByPatient(patientId.toUpperCase().trim());
    res.status(200).json({
      success: true,
      count: diseases.length,
      data: diseases,
    });
  } catch (error) {
    next(error);
  }
};

// 10. Get Medicines prescribed / taken by a Patient
exports.getMedicinesByPatient = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const medicines = await neo4jService.getMedicinesByPatient(patientId.toUpperCase().trim());
    res.status(200).json({
      success: true,
      count: medicines.length,
      data: medicines,
    });
  } catch (error) {
    next(error);
  }
};

// 11. Full Graph for Explorer
exports.getFullGraph = async (req, res, next) => {
  try {
    const fullGraph = await neo4jService.getFullGraph();
    res.status(200).json({
      success: true,
      data: fullGraph,
    });
  } catch (error) {
    next(error);
  }
};

// Dashboard Stats across both databases
exports.getDashboardStats = async (req, res, next) => {
  try {
    const [patientCount, doctorCount, departmentCount, appointmentCount, prescriptionCount] = await Promise.all([
      Patient.countDocuments(),
      Doctor.countDocuments(),
      Department.countDocuments(),
      Appointment.countDocuments(),
      Prescription.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPatients: patientCount,
        totalDoctors: doctorCount,
        totalDepartments: departmentCount,
        totalAppointments: appointmentCount,
        totalPrescriptions: prescriptionCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
