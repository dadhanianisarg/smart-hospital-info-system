import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Users, UserCheck, Building2, CalendarCheck, FileText, CheckCircle2, Clock } from 'lucide-react';

export default function Dashboard({ setActivePage }) {
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalDoctors: 0,
    totalDepartments: 0,
    totalAppointments: 0,
    totalPrescriptions: 0,
  });
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const statsRes = await api.getStats();
        if (statsRes.success) setStats(statsRes.data);

        const aptRes = await api.getAppointments();
        if (aptRes.success) setRecentAppointments(aptRes.data.slice(0, 5));
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div style={{ padding: '24px' }}>Loading dashboard...</div>;

  return (
    <div>
      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => setActivePage('patients')} style={{ cursor: 'pointer' }}>
          <div className="stat-info">
            <h3>Total Patients</h3>
            <div className="stat-value">{stats.totalPatients}</div>
          </div>
          <div className="stat-icon" style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}>
            <Users size={24} />
          </div>
        </div>

        <div className="stat-card" onClick={() => setActivePage('doctors')} style={{ cursor: 'pointer' }}>
          <div className="stat-info">
            <h3>Total Doctors</h3>
            <div className="stat-value">{stats.totalDoctors}</div>
          </div>
          <div className="stat-icon" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
            <UserCheck size={24} />
          </div>
        </div>

        <div className="stat-card" onClick={() => setActivePage('departments')} style={{ cursor: 'pointer' }}>
          <div className="stat-info">
            <h3>Departments</h3>
            <div className="stat-value">{stats.totalDepartments}</div>
          </div>
          <div className="stat-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            <Building2 size={24} />
          </div>
        </div>

        <div className="stat-card" onClick={() => setActivePage('appointments')} style={{ cursor: 'pointer' }}>
          <div className="stat-info">
            <h3>Appointments</h3>
            <div className="stat-value">{stats.totalAppointments}</div>
          </div>
          <div className="stat-icon" style={{ backgroundColor: '#f3e8ff', color: '#9333ea' }}>
            <CalendarCheck size={24} />
          </div>
        </div>

        <div className="stat-card" onClick={() => setActivePage('prescriptions')} style={{ cursor: 'pointer' }}>
          <div className="stat-info">
            <h3>Prescriptions</h3>
            <div className="stat-value">{stats.totalPrescriptions}</div>
          </div>
          <div className="stat-icon" style={{ backgroundColor: '#ffe4e6', color: '#e11d48' }}>
            <FileText size={24} />
          </div>
        </div>
      </div>

      {/* Polyglot Persistence Architecture Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Polyglot Persistence Architecture Overview</div>
          <button className="btn btn-secondary btn-sm" onClick={() => setActivePage('graph-explorer')}>
            Open Graph Explorer →
          </button>
        </div>
        <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '16px' }}>
          This prototype implements <strong>polyglot persistence</strong> by delegating data to two specialized NoSQL engines:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <strong style={{ color: '#0284c7' }}>MongoDB (Document Model):</strong>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px' }}>
              Stores flexible patient medical histories, full demographic documents, nested prescriptions, and appointment records.
            </p>
          </div>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <strong style={{ color: '#16a34a' }}>Neo4j (Graph Model):</strong>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px' }}>
              Maintains relationships: (Patient)&rarr;[:TREATED_BY]&rarr;(Doctor)&rarr;[:BELONGS_TO]&rarr;(Department), (Patient)&rarr;[:DIAGNOSED_WITH]&rarr;(Disease), and (Doctor)&rarr;[:PRESCRIBED]&rarr;(Medicine).
            </p>
          </div>
        </div>
      </div>

      {/* Recent Appointments Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Appointments</div>
          <button className="btn btn-primary btn-sm" onClick={() => setActivePage('appointments')}>
            View All Appointments
          </button>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Appointment ID</th>
                <th>Patient ID</th>
                <th>Doctor ID</th>
                <th>Date & Time</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {recentAppointments.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8' }}>No appointments found</td></tr>
              ) : (
                recentAppointments.map((apt) => (
                  <tr key={apt.appointmentId}>
                    <td><strong>{apt.appointmentId}</strong></td>
                    <td>{apt.patientId}</td>
                    <td>{apt.doctorId}</td>
                    <td>{apt.date} at {apt.time}</td>
                    <td>
                      <span className={`badge badge-${apt.status.toLowerCase()}`}>
                        {apt.status}
                      </span>
                    </td>
                    <td>{apt.reason || 'General Checkup'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
