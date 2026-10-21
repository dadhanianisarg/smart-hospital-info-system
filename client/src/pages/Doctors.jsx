import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const initialForm = {
    doctorId: '',
    name: '',
    specialization: '',
    departmentId: 'DEP01',
    phone: '',
    email: '',
    experience: '',
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const [docRes, deptRes] = await Promise.all([api.getDoctors(), api.getDepartments()]);
      if (docRes.success) setDoctors(docRes.data);
      if (deptRes.success) setDepartments(deptRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createDoctor({ ...formData, experience: Number(formData.experience) });
      setShowAddModal(false);
      setFormData(initialForm);
      fetchDoctors();
    } catch (err) {
      alert(`Error creating doctor: ${err.message}`);
    }
  };

  const handleEditClick = (doc) => {
    setSelectedDoctor(doc);
    setFormData({
      doctorId: doc.doctorId,
      name: doc.name,
      specialization: doc.specialization,
      departmentId: doc.departmentId,
      phone: doc.phone,
      email: doc.email,
      experience: doc.experience,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.updateDoctor(selectedDoctor.doctorId, {
        name: formData.name,
        specialization: formData.specialization,
        departmentId: formData.departmentId,
        phone: formData.phone,
        email: formData.email,
        experience: Number(formData.experience),
      });
      setShowEditModal(false);
      fetchDoctors();
    } catch (err) {
      alert(`Error updating doctor: ${err.message}`);
    }
  };

  const handleDelete = async (doctorId) => {
    if (window.confirm(`Delete doctor ${doctorId}?`)) {
      try {
        await api.deleteDoctor(doctorId);
        fetchDoctors();
      } catch (err) {
        alert(`Error deleting doctor: ${err.message}`);
      }
    }
  };

  const handleOpenAddModal = () => {
    let nextNum = 101;
    if (doctors && doctors.length > 0) {
      const numbers = doctors
        .map(d => {
          const match = String(d.doctorId).match(/\d+/);
          return match ? parseInt(match[0], 10) : null;
        })
        .filter(n => n !== null);
      if (numbers.length > 0) {
        nextNum = Math.max(...numbers) + 1;
      }
    }
    const autoDocId = `D${nextNum}`;
    setFormData({
      ...initialForm,
      doctorId: autoDocId,
    });
    setShowAddModal(true);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Doctor Management</div>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus size={16} /> Add Doctor
          </button>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Doctor ID</th>
                <th>Doctor Name</th>
                <th>Specialization</th>
                <th>Department ID</th>
                <th>Experience</th>
                <th>Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center' }}>Loading doctors...</td></tr>
              ) : doctors.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8' }}>No doctors found</td></tr>
              ) : (
                doctors.map((d) => (
                  <tr key={d.doctorId}>
                    <td><strong>{d.doctorId}</strong></td>
                    <td>{d.name}</td>
                    <td>{d.specialization}</td>
                    <td><span className="badge badge-blue">{d.departmentId}</span></td>
                    <td>{d.experience} years</td>
                    <td>{d.phone} | {d.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEditClick(d)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d.doctorId)}>
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

      {/* ADD DOCTOR MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Register Doctor</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-row">
                <div className="form-group">
                  <label>Doctor ID (Auto-incremented, Changeable) *</label>
                  <input type="text" className="form-control" required placeholder="e.g. D106" value={formData.doctorId} onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" className="form-control" required placeholder="e.g. Dr. Priya Shah" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Specialization *</label>
                  <input type="text" className="form-control" required placeholder="e.g. Pediatric Cardiology" value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Department *</label>
                  <select className="form-control" value={formData.departmentId} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}>
                    {departments.map(dept => (
                      <option key={dept.departmentId} value={dept.departmentId}>
                        {dept.name} ({dept.departmentId})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone *</label>
                  <input type="text" className="form-control" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" className="form-control" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Experience (Yrs) *</label>
                  <input type="number" min="0" className="form-control" required value={formData.experience} onChange={(e) => setFormData({ ...formData, experience: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Doctor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DOCTOR MODAL */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Doctor ({formData.doctorId})</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>Name</label>
                <input type="text" className="form-control" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Specialization</label>
                  <input type="text" className="form-control" required value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <select className="form-control" value={formData.departmentId} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}>
                    {departments.map(dept => (
                      <option key={dept.departmentId} value={dept.departmentId}>{dept.name} ({dept.departmentId})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input type="text" className="form-control" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" className="form-control" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Experience (Yrs)</label>
                  <input type="number" min="0" className="form-control" required value={formData.experience} onChange={(e) => setFormData({ ...formData, experience: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Doctor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
