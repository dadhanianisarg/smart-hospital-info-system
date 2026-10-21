const Department = require('../models/Department');
const neo4jService = require('../services/neo4jService');

// CREATE Department
exports.createDepartment = async (req, res, next) => {
  try {
    const deptData = req.body;
    deptData.departmentId = deptData.departmentId.toUpperCase().trim();

    const existing = await Department.findOne({ departmentId: deptData.departmentId });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Department with ID ${deptData.departmentId} already exists.`,
      });
    }

    const department = await Department.create(deptData);

    // Sync to Neo4j
    await neo4jService.createDepartmentNode({
      departmentId: department.departmentId,
      name: department.name,
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully in MongoDB and Neo4j',
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

// READ ALL Departments
exports.getAllDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments,
    });
  } catch (error) {
    next(error);
  }
};

// READ Department by ID
exports.getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const department = await Department.findOne({ departmentId: id.toUpperCase().trim() });

    if (!department) {
      return res.status(404).json({
        success: false,
        error: `Department with ID '${id}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE Department
exports.updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.departmentId;

    const department = await Department.findOneAndUpdate(
      { departmentId: id.toUpperCase().trim() },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        error: `Department with ID '${id}' not found`,
      });
    }

    // Sync to Neo4j
    await neo4jService.createDepartmentNode({
      departmentId: department.departmentId,
      name: department.name,
    });

    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: department,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE Department
exports.deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const department = await Department.findOneAndDelete({ departmentId: id.toUpperCase().trim() });

    if (!department) {
      return res.status(404).json({
        success: false,
        error: `Department with ID '${id}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Department ${id} deleted successfully from MongoDB`,
      data: department,
    });
  } catch (error) {
    next(error);
  }
};
