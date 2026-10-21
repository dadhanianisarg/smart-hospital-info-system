const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { validateDepartment } = require('../middleware/validator');

router.route('/')
  .post(validateDepartment, departmentController.createDepartment)
  .get(departmentController.getAllDepartments);

router.route('/:id')
  .get(departmentController.getDepartmentById)
  .put(departmentController.updateDepartment)
  .delete(departmentController.deleteDepartment);

module.exports = router;
