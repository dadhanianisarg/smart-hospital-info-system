import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);

  const initialForm = { departmentId: '', name: '', description: '' };
  const [formData, setFormData] = useState(initialForm);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await api.getDepartments();
      if (res.success) setDepartments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createDepartment(formData);
      setShowAddModal(false);
      setFormData(initialForm);
      fetchDepartments();
    } catch (err) {
      alert(`Error creating department: ${err.message}`);
    }
  };

  const handleEditClick = (dept) => {
    setSelectedDept(dept);
    setFormData({
      departmentId: dept.departmentId,
      name: dept.name,
      description: dept.description || '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.updateDepartment(selectedDept.departmentId, {
        name: formData.name,
        description: formData.description,
      });
      setShowEditModal(false);
      fetchDepartments();
    } catch (err) {
      alert(`Error updating department: ${err.message}`);
    }
  };

  const handleDelete = async (departmentId) => {
    if (window.confirm(`Delete department ${departmentId}?`)) {
      try {
        await api.deleteDepartment(departmentId);
        fetchDepartments();
      } catch (err) {
        alert(`Error deleting department: ${err.message}`);
      }
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Hospital Departments</div>
          <button className="btn btn-primary" onClick={() => { setFormData(initialForm); setShowAddModal(true); }}>
            <Plus size={16} /> Add Department
          </button>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Department ID</th>
                <th>Department Name</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>Loading departments...</td></tr>
              ) : departments.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8' }}>No departments found</td></tr>
              ) : (
                departments.map((d) => (
                  <tr key={d.departmentId}>
                    <td><strong>{d.departmentId}</strong></td>
                    <td>{d.name}</td>
                    <td>{d.description || 'N/A'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEditClick(d)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d.departmentId)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Department</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Department ID *</label>
                <input type="text" className="form-control" required placeholder="e.g. DEP05" value={formData.departmentId} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Department Name *</label>
                <input type="text" className="form-control" required placeholder="e.g. Oncology" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" rows="3" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Department</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Department ({formData.departmentId})</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>Department Name *</label>
                <input type="text" className="form-control" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" rows="3" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Department</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
