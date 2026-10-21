import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Share2, Users, UserCheck, Building2, AlertCircle, Pill, ArrowRight, Code } from 'lucide-react';

export default function GraphExplorer() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('P101');
  const [patientGraph, setPatientGraph] = useState(null);
  const [fullGraph, setFullGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('patient'); // 'patient' or 'full'

  useEffect(() => {
    async function loadInitial() {
      try {
        const [patRes, fullRes] = await Promise.all([
          api.getPatients(),
          api.getFullGraph(),
        ]);
        if (patRes.success && patRes.data.length > 0) {
          setPatients(patRes.data);
          setSelectedPatientId(patRes.data[0].patientId);
          fetchPatientGraph(patRes.data[0].patientId);
        }
        if (fullRes.success) {
          setFullGraph(fullRes.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  const fetchPatientGraph = async (patientId) => {
    try {
      const res = await api.getPatientGraph(patientId);
      if (res.success) {
        setPatientGraph(res.data);
      }
    } catch (err) {
      console.error('Error fetching patient graph:', err);
    }
  };

  const handlePatientSelect = (e) => {
    const id = e.target.value;
    setSelectedPatientId(id);
    fetchPatientGraph(id);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Neo4j Graph Explorer</div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
              Traverse multi-hop relationships across Patient, Doctor, Department, Disease, and Medicine entities.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn btn-sm ${viewMode === 'patient' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('patient')}
            >
              Patient Centric Traversal
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'full' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('full')}
            >
              Full Graph Overview
            </button>
          </div>
        </div>

        {viewMode === 'patient' ? (
          <div>
            {/* Patient Selector */}
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Select Target Patient:</label>
              <select
                className="form-control"
                style={{ maxWidth: '320px' }}
                value={selectedPatientId}
                onChange={handlePatientSelect}
              >
                {patients.map((p) => (
                  <option key={p.patientId} value={p.patientId}>
                    {p.patientId} - {p.name} ({p.age}y, {p.gender})
                  </option>
                ))}
              </select>
            </div>

            {patientGraph ? (
              <div>
                {/* Visual Traversal Canvas */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '0.95rem', color: '#334155', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Share2 size={18} color="#0284c7" />
                    Multi-Hop Subgraph for {patientGraph.patient.name} ({patientGraph.patient.patientId})
                  </h4>

                  {/* Central Node */}
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div className="node-chip node-patient" style={{ padding: '12px 20px', fontSize: '1rem', fontWeight: 600 }}>
                      <Users size={18} />
                      (Patient: {patientGraph.patient.name} [{patientGraph.patient.patientId}])
                    </div>
                  </div>

                  {/* 3-Column Entity Relationship Display */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                    
                    {/* Doctors & Department */}
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: '#166534', fontWeight: 600, fontSize: '0.9rem' }}>
                        <UserCheck size={16} />
                        <span>[:TREATED_BY] ➔ Doctors</span>
                      </div>
                      {patientGraph.doctors.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No doctors assigned</p>
                      ) : (
                        patientGraph.doctors.map((d) => (
                          <div key={d.doctorId} style={{ marginBottom: '10px' }}>
                            <div className="node-chip node-doctor">
                              {d.name} ({d.specialization})
                            </div>
                            <div style={{ marginLeft: '16px', fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>[:BELONGS_TO] ➔</span>
                              {patientGraph.departments.map(dept => (
                                <span key={dept.departmentId} className="node-chip node-dept" style={{ fontSize: '0.75rem' }}>
                                  {dept.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Diagnosed Diseases */}
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: '#991b1b', fontWeight: 600, fontSize: '0.9rem' }}>
                        <AlertCircle size={16} />
                        <span>[:DIAGNOSED_WITH] ➔ Diseases</span>
                      </div>
                      {patientGraph.diseases.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No diagnosed conditions</p>
                      ) : (
                        patientGraph.diseases.map((dis) => (
                          <div key={dis.diseaseId} className="node-chip node-disease" style={{ display: 'block', marginBottom: '8px' }}>
                            <strong>{dis.name}</strong> [{dis.diseaseId}]
                          </div>
                        ))
                      )}
                    </div>

                    {/* Prescribed Medicines */}
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: '#6b21a8', fontWeight: 600, fontSize: '0.9rem' }}>
                        <Pill size={16} />
                        <span>[:TAKES] ➔ Medicines</span>
                      </div>
                      {patientGraph.medicines.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No medicines recorded</p>
                      ) : (
                        patientGraph.medicines.map((m) => (
                          <div key={m.medicineId} className="node-chip node-med" style={{ display: 'block', marginBottom: '8px' }}>
                            <strong>{m.name}</strong> ({m.category || 'Therapeutic'})
                          </div>
                        ))
                      )}
                    </div>

                  </div>
                </div>

                {/* Live Cypher Query Display */}
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', color: '#f8fafc', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', marginBottom: '8px', fontWeight: 600 }}>
                    <Code size={16} /> Executed Cypher Traversal Query:
                  </div>
                  <pre style={{ overflowX: 'auto', color: '#e2e8f0', fontFamily: 'monospace' }}>
{`MATCH (p:Patient { patientId: "${selectedPatientId}" })
OPTIONAL MATCH (p)-[r1:TREATED_BY]->(d:Doctor)
OPTIONAL MATCH (d)-[r2:BELONGS_TO]->(dept:Department)
OPTIONAL MATCH (p)-[r3:DIAGNOSED_WITH]->(dis:Disease)
OPTIONAL MATCH (p)-[r4:TAKES]->(m:Medicine)
RETURN p, collect(DISTINCT d), collect(DISTINCT dept), collect(DISTINCT dis), collect(DISTINCT m);`}
                  </pre>
                </div>
              </div>
            ) : (
              <div>Loading patient graph...</div>
            )}
          </div>
        ) : (
          /* Full Graph View */
          <div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="stat-card" style={{ padding: '12px 20px' }}>
                <div><strong>Total Graph Nodes:</strong> {fullGraph ? fullGraph.nodes.length : 0}</div>
              </div>
              <div className="stat-card" style={{ padding: '12px 20px' }}>
                <div><strong>Total Graph Relationships:</strong> {fullGraph ? fullGraph.edges.length : 0}</div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', maxHeight: '450px', overflowY: 'auto' }}>
              <h4 style={{ marginBottom: '12px' }}>Graph Relationship Traversal Table:</h4>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Source Node</th>
                      <th>Relationship Type</th>
                      <th>Target Node</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullGraph && fullGraph.edges.map((edge) => (
                      <tr key={edge.id}>
                        <td><span className="badge badge-blue">{edge.from}</span></td>
                        <td><strong style={{ color: '#0284c7' }}>[:{edge.label}]</strong></td>
                        <td><span className="badge" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>{edge.to}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
