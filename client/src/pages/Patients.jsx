import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Plus, Search, Edit2, Trash2, Eye, X } from 'lucide-react';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Form State
  const initialForm = {
    patientId: '',
    name: '',
    age: '',
    gender: 'Male',
    bloodGroup: 'O+',
    phone: '',
    email: '',
    address: { street: '', city: '', state: '', zipCode: '' },
    medicalHistoryDisease: '',
    medicalHistoryYear: '',
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchPatients = async (searchTerm = '') => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getPatients(searchTerm);
      if (res.success) setPatients(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPatients(search);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const rawDiseases = formData.medicalHistoryDisease
        ? formData.medicalHistoryDisease.split(',').map(d => d.trim()).filter(Boolean)
        : [];
      const historyList = rawDiseases.map(d => ({
        disease: d,
        diagnosedYear: Number(formData.medicalHistoryYear) || new Date().getFullYear(),
        notes: 'Added via web portal',
      }));
      const payload = {
        ...formData,
        age: Number(formData.age),
        medicalHistory: historyList,
      };
      await api.createPatient(payload);
      setShowAddModal(false);
      setFormData(initialForm);
      fetchPatients();
    } catch (err) {
      alert(`Error creating patient: ${err.message}`);
    }
  };

  const handleEditClick = (patient) => {
    setSelectedPatient(patient);
    const existingDiseases = Array.isArray(patient.medicalHistory)
      ? patient.medicalHistory.map(h => h.disease).filter(Boolean).join(', ')
      : (patient.medicalHistory?.[0]?.disease || '');
    setFormData({
      patientId: patient.patientId,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      bloodGroup: patient.bloodGroup || 'O+',
      phone: patient.phone,
      email: patient.email,
      address: {
        street: patient.address?.street || '',
        city: patient.address?.city || '',
        state: patient.address?.state || '',
        zipCode: patient.address?.zipCode || '',
      },
      medicalHistoryDisease: existingDiseases,
      medicalHistoryYear: patient.medicalHistory?.[0]?.diagnosedYear || '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const rawDiseases = formData.medicalHistoryDisease
        ? formData.medicalHistoryDisease.split(',').map(d => d.trim()).filter(Boolean)
        : [];
      const historyList = rawDiseases.map(d => ({
        disease: d,
        diagnosedYear: Number(formData.medicalHistoryYear) || new Date().getFullYear(),
        notes: 'Updated via web portal',
      }));
      const payload = {
        name: formData.name,
        age: Number(formData.age),
        gender: formData.gender,
        bloodGroup: formData.bloodGroup,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        medicalHistory: historyList,
      };
      await api.updatePatient(selectedPatient.patientId, payload);
      setShowEditModal(false);
      fetchPatients();
    } catch (err) {
      alert(`Error updating patient: ${err.message}`);
    }
  };

  const handleDelete = async (patientId) => {
    if (window.confirm(`Are you sure you want to delete patient ${patientId}?`)) {
      try {
        await api.deletePatient(patientId);
        fetchPatients();
      } catch (err) {
        alert(`Error deleting patient: ${err.message}`);
      }
    }
  };

  const handleOpenAddModal = () => {
    let nextNum = 101;
    if (patients && patients.length > 0) {
      const numbers = patients
        .map(p => {
          const match = String(p.patientId).match(/\d+/);
          return match ? parseInt(match[0], 10) : null;
        })
        .filter(n => n !== null);
      if (numbers.length > 0) {
        nextNum = Math.max(...numbers) + 1;
      }
    }
    const autoPatientId = `P${nextNum}`;
    setFormData({
      ...initialForm,
      patientId: autoPatientId,
    });
    setShowAddModal(true);
  };

  const handleView = (patient) => {
    setSelectedPatient(patient);
    setShowViewModal(true);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Patient Management (MongoDB Document Store)</div>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus size={16} /> Add Patient
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by Patient ID, Name, or Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            <Search size={16} /> Search
          </button>
        </form>

        {error && <div style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</div>}

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Age / Gender</th>
                <th>Blood Group</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center' }}>Loading patients...</td></tr>
              ) : patients.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8' }}>No patients found</td></tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.patientId}>
                    <td><strong>{p.patientId}</strong></td>
                    <td>{p.name}</td>
                    <td>{p.age} yrs / {p.gender}</td>
                    <td><span className="badge badge-blue">{p.bloodGroup}</span></td>
                    <td>{p.phone}</td>
                    <td>{p.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleView(p)} title="View Document">
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEditClick(p)} title="Edit Patient">
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.patientId)} title="Delete Patient">
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

      {/* ADD PATIENT MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Register New Patient (MongoDB Document)</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-row">
                <div className="form-group">
                  <label>Patient ID (Auto-incremented, Changeable) *</label>
                  <input type="text" className="form-control" required placeholder="e.g. P111" value={formData.patientId} onChange={(e) => setFormData({ ...formData, patientId: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" className="form-control" required placeholder="e.g. Suresh Das" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Age *</label>
                  <input type="number" className="form-control" required min="0" max="130" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Gender *</label>
                  <select className="form-control" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Blood Group</label>
                  <select className="form-control" value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone *</label>
                  <input type="text" className="form-control" required placeholder="10-digit number" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" className="form-control" required placeholder="patient@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input type="text" className="form-control" placeholder="e.g. Mumbai" value={formData.address.city} onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })} />
                </div>
                <div className="form-group">
                  <label>Medical History (Enter multiple diseases comma-separated)</label>
                  <input type="text" className="form-control" placeholder="e.g. CKD, Hypertension, Type 2 Diabetes" value={formData.medicalHistoryDisease} onChange={(e) => setFormData({ ...formData, medicalHistoryDisease: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Patient</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PATIENT MODAL */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Patient ({formData.patientId})</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" className="form-control" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Age</label>
                  <input type="number" className="form-control" required value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select className="form-control" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Blood Group</label>
                  <input type="text" className="form-control" value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })} />
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
              </div>
              <div className="form-group">
                <label>Medical History (Enter multiple diseases comma-separated)</label>
                <input type="text" className="form-control" placeholder="e.g. CKD, Hypertension, Type 2 Diabetes" value={formData.medicalHistoryDisease} onChange={(e) => setFormData({ ...formData, medicalHistoryDisease: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Patient</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PATIENT MODAL */}
      {showViewModal && selectedPatient && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Patient Document: {selectedPatient.name} ({selectedPatient.patientId})</h3>
              <button onClick={() => setShowViewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '16px' }}>
              <p><strong>Demographics:</strong> {selectedPatient.age} yrs | {selectedPatient.gender} | {selectedPatient.bloodGroup}</p>
              <p><strong>Contact:</strong> {selectedPatient.phone} | {selectedPatient.email}</p>
              <p><strong>Address:</strong> {selectedPatient.address ? `${selectedPatient.address.street || ''}, ${selectedPatient.address.city || ''}, ${selectedPatient.address.state || ''}` : 'N/A'}</p>
            </div>
            <h4>Embedded Medical History:</h4>
            {selectedPatient.medicalHistory && selectedPatient.medicalHistory.length > 0 ? (
              <ul style={{ paddingLeft: '20px', marginTop: '8px', fontSize: '0.88rem' }}>
                {selectedPatient.medicalHistory.map((item, idx) => (
                  <li key={idx}><strong>{item.disease}</strong> ({item.diagnosedYear || 'N/A'}) - {item.notes || 'No notes'}</li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No past records.</p>
            )}

            <div style={{ marginTop: '20px' }}>
              <h4>Raw MongoDB Document:</h4>
              <pre style={{ background: '#0f172a', color: '#38bdf8', padding: '12px', borderRadius: '6px', fontSize: '0.78rem', overflowX: 'auto', marginTop: '8px' }}>
                {JSON.stringify(selectedPatient, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
