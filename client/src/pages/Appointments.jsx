import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Plus, Trash2, Calendar, Clock, X } from 'lucide-react';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const initialForm = {
    appointmentId: '',
    patientId: '',
    doctorId: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    status: 'Scheduled',
    reason: '',
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aptRes, patRes, docRes] = await Promise.all([
        api.getAppointments(),
        api.getPatients(),
        api.getDoctors(),
      ]);
      if (aptRes.success) setAppointments(aptRes.data);
      if (patRes.success) {
        setPatients(patRes.data);
        if (patRes.data.length > 0 && !formData.patientId) {
          setFormData(f => ({ ...f, patientId: patRes.data[0].patientId }));
        }
      }
      if (docRes.success) {
        setDoctors(docRes.data);
        if (docRes.data.length > 0 && !formData.doctorId) {
          setFormData(f => ({ ...f, doctorId: docRes.data[0].doctorId }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createAppointment(formData);
      setShowAddModal(false);
      setFormData(initialForm);
      fetchData();
    } catch (err) {
      alert(`Error creating appointment: ${err.message}`);
    }
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      await api.updateAppointment(appointmentId, { status: newStatus });
      fetchData();
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handleDelete = async (appointmentId) => {
    if (window.confirm(`Delete appointment ${appointmentId}?`)) {
      try {
        await api.deleteAppointment(appointmentId);
        fetchData();
      } catch (err) {
        alert(`Error deleting appointment: ${err.message}`);
      }
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Appointments (Polyglot Ref: Patient & Doctor)</div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Book Appointment
          </button>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Appointment ID</th>
                <th>Patient ID</th>
                <th>Doctor ID</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center' }}>Loading appointments...</td></tr>
              ) : appointments.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8' }}>No appointments found</td></tr>
              ) : (
                appointments.map((a) => (
                  <tr key={a.appointmentId}>
                    <td><strong>{a.appointmentId}</strong></td>
                    <td><span className="badge badge-blue">{a.patientId}</span></td>
                    <td><span className="badge" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>{a.doctorId}</span></td>
                    <td>{a.date}</td>
                    <td>{a.time}</td>
                    <td>
                      <select
                        className="form-control"
                        style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
                        value={a.status}
                        onChange={(e) => handleStatusChange(a.appointmentId, e.target.value)}
                      >
                        <option value="Scheduled">Scheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="In Progress">In Progress</option>
                      </select>
                    </td>
                    <td>{a.reason || 'General'}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.appointmentId)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Schedule New Consultation</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Appointment ID *</label>
                <input type="text" className="form-control" required placeholder="e.g. APT111" value={formData.appointmentId} onChange={(e) => setFormData({ ...formData, appointmentId: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Select Patient *</label>
                  <select className="form-control" value={formData.patientId} onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}>
                    {patients.map(p => (
                      <option key={p.patientId} value={p.patientId}>{p.name} ({p.patientId})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Select Doctor *</label>
                  <select className="form-control" value={formData.doctorId} onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}>
                    {doctors.map(d => (
                      <option key={d.doctorId} value={d.doctorId}>{d.name} ({d.specialization})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date *</label>
                  <input type="date" className="form-control" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Time *</label>
                  <input type="time" className="form-control" required value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Consultation Reason</label>
                <input type="text" className="form-control" placeholder="e.g. Routine follow-up" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule Appointment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
