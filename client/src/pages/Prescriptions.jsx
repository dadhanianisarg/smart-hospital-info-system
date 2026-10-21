import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Plus, Trash2, Pill, X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import drugbank1706 from '../data/drugbank_1706.json';

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);

  // DDI Risk Check State
  const [riskData, setRiskData] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const initialForm = {
    prescriptionId: 'RX109',
    patientId: 'P101',
    doctorId: 'D101',
    diagnosis: 'Chronic Kidney Disease',
    instructions: 'Take after meals with water',
    date: new Date().toISOString().split('T')[0],
    medicineId: 'MED11',
    drugInputMode: 'formulary', // 'formulary' | 'custom'
    customDrugName: 'Dolo 650 (Paracetamol - DB00316)',
    customDrugSmiles: '',
    dosage: '650mg',
    frequency: 'Twice daily',
    duration: '5 days',
  };
  const [formData, setFormData] = useState(initialForm);

  const brandAndFeaturedSuggestions = [
    'Dolo 650 (Paracetamol - DB00316)',
    'Crocin 650 (Paracetamol - DB00316)',
    'Calpol 500 (Paracetamol - DB00316)',
    'Combiflam (Ibuprofen + Paracetamol - DB01050)',
    'Brufen 400 (Ibuprofen - DB01050)',
    'Voveran 50 (Diclofenac - DB00586)',
    'Zerodol (Aceclofenac - DB00586)',
    'Ecosprin 75 (Aspirin - DB00945)',
    'Pan 40 (Pantoprazole - DB00213)',
    'Omez 20 (Omeprazole - DB00338)',
    'Augmentin 625 (Amoxicillin - DB01060)',
    'Azithral 500 (Azithromycin - DB00207)',
    'Ciplox 500 (Ciprofloxacin - DB00537)',
    'Glycomet 500 (Metformin - DB00331)',
    'Telma 40 (Telmisartan - DB00966)',
    'Stamlo 5 (Amlodipine - DB00381)',
    'Atorva 20 (Atorvastatin - DB01076)',
    'Lasix 40 (Furosemide - DB00695)',
    'Aldactone (Spironolactone - DB00421)',
    'Acitrom / Warfarin (DB00682)',
    'Wysolone 10 (Prednisone - DB00635)',
    'Asthalin (Albuterol - DB01001)',
    'Montair 10 (Montelukast - DB00471)',
    'Allegra 120 (Fexofenadine - DB00950)',
    'Cetzine 10 (Cetirizine - DB00341)',
    'Daxid / Zoloft (Sertraline - DB01104)',
    'Betaloc / Metolar (Metoprolol - DB00264)',
    'Cordarone (Amiodarone - DB01118)',
    'Folitrax (Methotrexate - DB00563)',
    'Isonex (Isoniazid - DB00951)',
    'Thyronorm (Levothyroxine - DB00451)',
    'Limcee (Ascorbic Acid / Vitamin C - DB00126)',
    'Ketoprofen (Cold-Start Novel NSAID)',
    'Celecoxib (Cold-Start COX-2 Inhibitor)',
    'Indomethacin (Cold-Start NSAID)',
  ];
  const drugBankSuggestions = [...brandAndFeaturedSuggestions, ...drugbank1706];

  const coreMedicines = [
    { medicineId: 'MED11', name: 'Ibuprofen 400mg', category: 'NSAID', description: 'Non-steroidal anti-inflammatory' },
    { medicineId: 'MED05', name: 'Dolo 650 / Paracetamol 650mg', category: 'Analgesic', description: 'Analgesic antipyretic (Safe in CKD)' },
    { medicineId: 'MED12', name: 'Lisinopril 10mg', category: 'ACE Inhibitor', description: 'ACE inhibitor antihypertensive' },
    { medicineId: 'MED01', name: 'Amlodipine 5mg', category: 'Antihypertensive', description: 'Calcium channel blocker' },
    { medicineId: 'MED07', name: 'Aceclofenac 100mg', category: 'NSAID', description: 'Potent non-steroidal anti-inflammatory' },
    { medicineId: 'MED10', name: 'Telmisartan 40mg', category: 'Antihypertensive', description: 'Angiotensin II receptor blocker' },
    { medicineId: 'MED13', name: 'Amoxicillin 500mg', category: 'Antibiotic', description: 'Broad-spectrum antibiotic' },
    { medicineId: 'MED14', name: 'Warfarin 5mg', category: 'Anticoagulant', description: 'Anticoagulant agent' },
    { medicineId: 'MED02', name: 'Atorvastatin 20mg', category: 'Lipid-Lowering', description: 'HMG-CoA reductase inhibitor' },
    { medicineId: 'MED03', name: 'Metformin 500mg', category: 'Antidiabetic', description: 'Biguanide antidiabetic' },
    { medicineId: 'MED04', name: 'Sumatriptan 50mg', category: 'Antimigraine', description: 'Selective 5-HT1B/1D agonist' },
    { medicineId: 'MED06', name: 'Glucosamine 500mg', category: 'Chondroprotective', description: 'Joint cartilage protection' },
    { medicineId: 'MED08', name: 'Montelukast 10mg', category: 'Antiasthmatic', description: 'Leukotriene receptor antagonist' },
    { medicineId: 'MED09', name: 'Pantoprazole 40mg', category: 'Proton Pump Inhibitor', description: 'Gastric acid secretion suppressor' },
  ];

  const fallbackPatients = [
    { patientId: 'P101', name: 'John Doe (Chronic Kidney Disease)', medicalHistory: [{ disease: 'Chronic Kidney Disease' }] },
    { patientId: 'P102', name: 'Rahul Verma (Hypertension)', medicalHistory: [{ disease: 'Hypertension' }] },
    { patientId: 'P103', name: 'Suresh Menon (Coronary Artery Disease)', medicalHistory: [{ disease: 'Coronary Artery Disease' }] },
    { patientId: 'P104', name: 'Kavita Reddy (Type 2 Diabetes)', medicalHistory: [{ disease: 'Type 2 Diabetes' }] },
  ];

  const fallbackDoctors = [
    { doctorId: 'D101', name: 'Dr. Rajesh Sharma', specialization: 'Interventional Cardiology' },
    { doctorId: 'D102', name: 'Dr. Ananya Iyer', specialization: 'Preventive Cardiology' },
    { doctorId: 'D103', name: 'Dr. Vikram Rao', specialization: 'Clinical Neurology' },
    { doctorId: 'D104', name: 'Dr. Sneha Patel', specialization: 'Orthopedic Surgery' },
    { doctorId: 'D105', name: 'Dr. Amitav Ghosh', specialization: 'Internal Medicine' },
  ];

  const fallbackPrescriptions = [
    {
      prescriptionId: 'RX101',
      patientId: 'P101',
      doctorId: 'D101',
      diagnosis: 'Chronic Kidney Disease',
      medicines: [{ name: 'Lisinopril 10mg', dosage: '10mg', frequency: 'Once daily', duration: '30 days' }],
      date: '2026-10-10',
      instructions: 'Monitor blood pressure and renal panel regularly'
    },
    {
      prescriptionId: 'RX102',
      patientId: 'P102',
      doctorId: 'D102',
      diagnosis: 'Hypertension',
      medicines: [{ name: 'Amlodipine 5mg', dosage: '5mg', frequency: 'Once daily', duration: '30 days' }],
      date: '2026-10-11',
      instructions: 'Take in the morning with water'
    },
    {
      prescriptionId: 'RX103',
      patientId: 'P103',
      doctorId: 'D101',
      diagnosis: 'Coronary Artery Disease',
      medicines: [{ name: 'Atorvastatin 20mg', dosage: '20mg', frequency: 'Once daily at night', duration: '60 days' }],
      date: '2026-10-12',
      instructions: 'Night dosage for statin'
    }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rxRes, patRes, docRes, medRes] = await Promise.all([
        api.getPrescriptions().catch(() => ({ success: false })),
        api.getPatients().catch(() => ({ success: false })),
        api.getDoctors().catch(() => ({ success: false })),
        api.getMedicines().catch(() => ({ success: false })),
      ]);

      const pats = (patRes.success && patRes.data && patRes.data.length > 0) ? patRes.data : fallbackPatients;
      const docs = (docRes.success && docRes.data && docRes.data.length > 0) ? docRes.data : fallbackDoctors;
      const rxs = (rxRes.success && rxRes.data && rxRes.data.length > 0) ? rxRes.data : fallbackPrescriptions;

      // Merge medicines ensuring Ibuprofen, Dolo 650 / Paracetamol, and Lisinopril are always included
      let medsList = (medRes.success && medRes.data && medRes.data.length > 0) ? [...medRes.data] : [];
      medsList = medsList.map(m => {
        if (m.medicineId === 'MED05' || (m.name && m.name.toLowerCase().includes('paracetamol'))) {
          return { ...m, name: 'Dolo 650 / Paracetamol 650mg' };
        }
        return m;
      });
      coreMedicines.forEach(cm => {
        if (!medsList.some(m => m.medicineId === cm.medicineId)) {
          medsList.unshift(cm);
        }
      });
      if (medsList.length === 0) medsList = coreMedicines;

      setPatients(pats);
      setDoctors(docs);
      setMedicines(medsList);
      setPrescriptions(rxs);
    } catch (err) {
      console.error(err);
      setPatients(fallbackPatients);
      setDoctors(fallbackDoctors);
      setMedicines(coreMedicines);
      setPrescriptions(fallbackPrescriptions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute next auto-incrementing ID when opening modal
  const handleOpenAddModal = () => {
    let nextNum = 109;
    if (prescriptions && prescriptions.length > 0) {
      const numbers = prescriptions
        .map(p => {
          const match = String(p.prescriptionId).match(/\d+/);
          return match ? parseInt(match[0], 10) : null;
        })
        .filter(n => n !== null);
      if (numbers.length > 0) {
        nextNum = Math.max(...numbers) + 1;
      }
    }
    const autoRxId = `RX${nextNum}`;
    const defaultPat = patients.find(p => p.patientId === 'P101') || patients[0] || fallbackPatients[0];
    const defaultDoc = doctors[0] || fallbackDoctors[0];
    const defaultMed = medicines.find(m => m.name.toLowerCase().includes('ibuprofen')) || coreMedicines[0];

    let defaultDiag = 'Chronic Kidney Disease';
    if (defaultPat && Array.isArray(defaultPat.medicalHistory) && defaultPat.medicalHistory.length > 0) {
      defaultDiag = defaultPat.medicalHistory.map(h => h.disease).filter(Boolean).join(', ') || defaultDiag;
    }

    setFormData({
      prescriptionId: autoRxId,
      patientId: defaultPat.patientId,
      doctorId: defaultDoc.doctorId,
      diagnosis: defaultDiag,
      instructions: 'Take after meals as advised',
      date: new Date().toISOString().split('T')[0],
      medicineId: defaultMed.medicineId,
      drugInputMode: 'formulary',
      customDrugName: 'Dolo 650 (Paracetamol - DB00316)',
      customDrugSmiles: '',
      dosage: '400mg',
      frequency: 'Twice daily',
      duration: '5 days',
    });
    setRiskData(null);
    setShowAddModal(true);
  };

  // Dynamically update diagnosis when user switches patient
  const handlePatientChange = (selectedPatientId) => {
    const pat = patients.find(p => p.patientId === selectedPatientId);
    let diag = formData.diagnosis;
    if (pat && Array.isArray(pat.medicalHistory) && pat.medicalHistory.length > 0) {
      diag = pat.medicalHistory.map(h => h.disease).filter(Boolean).join(', ') || diag;
    } else {
      const rx = prescriptions.find(p => p.patientId === selectedPatientId);
      if (rx && rx.diagnosis) diag = rx.diagnosis;
    }
    setFormData(f => ({ ...f, patientId: selectedPatientId, diagnosis: diag }));
  };

  const checkDdiRisk = async () => {
    if (!formData.patientId) return;

    let drugName = '';
    let drugSmiles = null;

    if (formData.drugInputMode === 'custom') {
      if (!formData.customDrugName.trim()) return;
      drugName = formData.customDrugName.trim();
      drugSmiles = formData.customDrugSmiles && formData.customDrugSmiles.trim() ? formData.customDrugSmiles.trim() : null;
    } else {
      if (!formData.medicineId) return;
      const selectedMed = medicines.find(m => m.medicineId === formData.medicineId) || coreMedicines.find(m => m.medicineId === formData.medicineId);
      drugName = selectedMed ? selectedMed.name : formData.medicineId;
    }

    // Collect patient's current medications from existing prescriptions
    const patientPrescriptions = prescriptions.filter(p => p.patientId === formData.patientId);
    const currentMeds = [];
    patientPrescriptions.forEach(p => {
      if (Array.isArray(p.medicines)) {
        p.medicines.forEach(m => {
          if (m.name) {
            const clean = m.name.replace(/\s+\d+.*$/, '').trim();
            if (!currentMeds.includes(clean)) currentMeds.push(clean);
          }
        });
      }
    });

    // If patient has no prior prescriptions in DB yet, infer active maintenance regimen from diagnosis
    if (currentMeds.length === 0) {
      const diagLower = (formData.diagnosis || '').toLowerCase();
      if (diagLower.includes('diabetes')) {
        currentMeds.push('Metformin');
      } else if (diagLower.includes('ulcer')) {
        currentMeds.push('Warfarin');
      } else if (diagLower.includes('asthma') || diagLower.includes('copd')) {
        currentMeds.push('Albuterol');
      } else if (diagLower.includes('arrhythmia') || diagLower.includes('fibrillation')) {
        currentMeds.push('Amiodarone');
      } else if (diagLower.includes('hepatic') || diagLower.includes('cirrhosis') || diagLower.includes('liver')) {
        currentMeds.push('Isoniazid');
      } else if (diagLower.includes('heart failure')) {
        currentMeds.push('Metoprolol');
      } else {
        currentMeds.push('Lisinopril');
      }
    }

    const diagnoses = formData.diagnosis 
      ? formData.diagnosis.split(',').map(d => d.trim()).filter(Boolean)
      : ['Chronic Kidney Disease'];

    setRiskLoading(true);
    try {
      const res = await api.checkRisk({
        patientId: formData.patientId,
        newDrugName: drugName,
        newDrugSmiles: drugSmiles,
        currentMeds: currentMeds,
        diagnoses: diagnoses
      });
      setRiskData(res);
    } catch (err) {
      setRiskData({ available: false, message: 'ML check unavailable' });
    } finally {
      setRiskLoading(false);
    }
  };

  useEffect(() => {
    if (showAddModal && formData.patientId) {
      checkDdiRisk();
    }
  }, [showAddModal, formData.patientId, formData.medicineId, formData.drugInputMode, formData.customDrugName, formData.customDrugSmiles, formData.diagnosis]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      let medId = formData.medicineId;
      let medName = formData.medicineId;
      if (formData.drugInputMode === 'custom') {
        medId = 'MED_CUSTOM';
        medName = formData.customDrugName.trim() || 'Custom Drug';
      } else {
        const selectedMed = medicines.find(m => m.medicineId === formData.medicineId) || coreMedicines[0];
        medName = selectedMed ? selectedMed.name : formData.medicineId;
      }

      const payload = {
        prescriptionId: formData.prescriptionId,
        patientId: formData.patientId,
        doctorId: formData.doctorId,
        diagnosis: formData.diagnosis,
        instructions: formData.instructions,
        date: formData.date,
        medicines: [
          {
            medicineId: medId,
            name: medName,
            dosage: formData.dosage,
            frequency: formData.frequency,
            duration: formData.duration,
          },
        ],
      };
      await api.createPrescription(payload);
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      alert(`Error creating prescription: ${err.message}`);
    }
  };

  const handleDelete = async (prescriptionId) => {
    if (window.confirm(`Delete prescription ${prescriptionId}?`)) {
      try {
        await api.deletePrescription(prescriptionId);
        fetchData();
      } catch (err) {
        alert(`Error deleting prescription: ${err.message}`);
      }
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Prescriptions (Prescription-Time DDI Check Active)</div>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus size={16} /> New Prescription
          </button>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Rx ID</th>
                <th>Patient ID</th>
                <th>Doctor ID</th>
                <th>Diagnosis</th>
                <th>Embedded Medicines</th>
                <th>Date</th>
                <th>Instructions</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center' }}>Loading prescriptions...</td></tr>
              ) : prescriptions.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8' }}>No prescriptions found</td></tr>
              ) : (
                prescriptions.map((rx) => (
                  <tr key={rx.prescriptionId}>
                    <td><strong>{rx.prescriptionId}</strong></td>
                    <td><span className="badge badge-blue">{rx.patientId}</span></td>
                    <td><span className="badge" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>{rx.doctorId}</span></td>
                    <td><strong>{rx.diagnosis}</strong></td>
                    <td>
                      {rx.medicines && rx.medicines.map((m, idx) => (
                        <div key={idx} style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '2px' }}>
                          💊 <strong>{m.name}</strong> ({m.dosage} - {m.frequency}, {m.duration})
                        </div>
                      ))}
                    </td>
                    <td>{rx.date}</td>
                    <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{rx.instructions || 'N/A'}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(rx.prescriptionId)}>
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
              <h3>Create Prescription Document</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Prescription ID (Auto-incremented, Editable) *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required 
                  value={formData.prescriptionId} 
                  onChange={(e) => setFormData({ ...formData, prescriptionId: e.target.value })} 
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Patient (Auto-selected, Changeable) *</label>
                  <select 
                    className="form-control" 
                    value={formData.patientId} 
                    onChange={(e) => handlePatientChange(e.target.value)}
                  >
                    {patients.map(p => (
                      <option key={p.patientId} value={p.patientId}>{p.name} ({p.patientId})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Doctor (Auto-selected, Changeable) *</label>
                  <select 
                    className="form-control" 
                    value={formData.doctorId} 
                    onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                  >
                    {doctors.map(d => (
                      <option key={d.doctorId} value={d.doctorId}>{d.name} ({d.specialization})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Diagnosis / Conditions (Enter multiple comma-separated, e.g. "CKD, Hypertension") *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required 
                    placeholder="e.g. CKD, Hypertension, Type 2 Diabetes"
                    value={formData.diagnosis} 
                    onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Prescription Date *</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    required 
                    value={formData.date} 
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.9rem', margin: 0, color: '#0f172a' }}>Candidate Prescribed Medicine</h4>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, drugInputMode: 'formulary' })}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        borderRadius: '5px',
                        cursor: 'pointer',
                        border: formData.drugInputMode === 'formulary' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: formData.drugInputMode === 'formulary' ? '#e0f2fe' : '#f8fafc',
                        color: formData.drugInputMode === 'formulary' ? '#0369a1' : '#475569',
                      }}
                    >
                      🏥 Hospital Formulary (14)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, drugInputMode: 'custom' })}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        borderRadius: '5px',
                        cursor: 'pointer',
                        border: formData.drugInputMode === 'custom' ? '1px solid #7c3aed' : '1px solid #cbd5e1',
                        backgroundColor: formData.drugInputMode === 'custom' ? '#f3e8ff' : '#f8fafc',
                        color: formData.drugInputMode === 'custom' ? '#6d28d9' : '#475569',
                      }}
                    >
                      🧬 DrugBank (1,706) / Cold-Start SMILES
                    </button>
                  </div>
                </div>

                {formData.drugInputMode === 'formulary' ? (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Medicine (Select Ibuprofen, Lisinopril, etc.) *</label>
                      <select 
                        className="form-control" 
                        value={formData.medicineId} 
                        onChange={(e) => {
                          const mId = e.target.value;
                          const mObj = medicines.find(item => item.medicineId === mId) || coreMedicines.find(item => item.medicineId === mId);
                          const isIbu = mObj && mObj.name.toLowerCase().includes('ibuprofen');
                          setFormData({ 
                            ...formData, 
                            medicineId: mId,
                            dosage: isIbu ? '400mg' : formData.dosage,
                            frequency: isIbu ? 'Twice daily' : formData.frequency,
                            duration: isIbu ? '5 days' : formData.duration
                          });
                        }}
                      >
                        {medicines.map(m => (
                          <option key={m.medicineId} value={m.medicineId}>
                            {m.name} ({m.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Dosage</label>
                      <input type="text" className="form-control" value={formData.dosage} onChange={(e) => setFormData({ ...formData, dosage: e.target.value })} />
                    </div>
                  </div>
                ) : (
                  <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '6px', padding: '10px 12px', marginBottom: '10px' }}>
                    <div className="form-row">
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label style={{ color: '#581c87' }}>Any Brand/Generic Drug Name or DrugBank ID (DB00001–DB01706) *</label>
                        <input
                          type="text"
                          list="drugbank-suggestions"
                          className="form-control"
                          placeholder="e.g. Dolo 650, Naproxen (DB00788), Pan 40, Ketoprofen..."
                          value={formData.customDrugName}
                          onChange={(e) => setFormData({
                            ...formData,
                            customDrugName: e.target.value,
                            customDrugSmiles: ''
                          })}
                        />
                        <datalist id="drugbank-suggestions">
                          {drugBankSuggestions.map(item => (
                            <option key={item} value={item} />
                          ))}
                        </datalist>
                      </div>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label style={{ color: '#581c87' }}>Dosage</label>
                        <input type="text" className="form-control" value={formData.dosage} onChange={(e) => setFormData({ ...formData, dosage: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ color: '#581c87', fontSize: '0.8rem' }}>
                        Chemical SMILES String (Optional &mdash; Leave blank for DrugBank Graph lookup, or enter SMILES for Zero-Shot Cold-Start)
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                        placeholder="Leave blank when typing a drug name, or paste SMILES for novel molecule..."
                        value={formData.customDrugSmiles}
                        onChange={(e) => setFormData({ ...formData, customDrugSmiles: e.target.value })}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.74rem', color: '#6b21a8', fontWeight: 600 }}>Quick Presets:</span>
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          customDrugName: 'Dolo 650 (Paracetamol - DB00316)',
                          customDrugSmiles: '',
                          dosage: '650mg'
                        })}
                        style={{ padding: '2px 8px', fontSize: '0.72rem', borderRadius: '4px', border: '1px solid #86efac', backgroundColor: '#ffffff', color: '#15803d', cursor: 'pointer', fontWeight: 600 }}
                      >
                        💊 Dolo 650 (Paracetamol - Safe in CKD)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          customDrugName: 'Naproxen (DB00788)',
                          customDrugSmiles: '',
                          dosage: '500mg'
                        })}
                        style={{ padding: '2px 8px', fontSize: '0.72rem', borderRadius: '4px', border: '1px solid #bae6fd', backgroundColor: '#ffffff', color: '#0369a1', cursor: 'pointer' }}
                      >
                        💊 DrugBank #DB00788 (Naproxen)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          customDrugName: 'Ketoprofen (Novel Cold-Start NSAID)',
                          customDrugSmiles: 'CC(C1=CC(=CC=C1)C(=O)C2=CC=CC=C2)C(=O)O',
                          dosage: '100mg'
                        })}
                        style={{ padding: '2px 8px', fontSize: '0.72rem', borderRadius: '4px', border: '1px solid #d8b4fe', backgroundColor: '#ffffff', color: '#6b21a8', cursor: 'pointer' }}
                      >
                        🧪 Cold-Start NSAID (Ketoprofen SMILES)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          customDrugName: 'Ascorbic Acid (Cold-Start Safe)',
                          customDrugSmiles: 'C(C(C1C(=C(C(=O)O1)O)O)O)O',
                          dosage: '500mg'
                        })}
                        style={{ padding: '2px 8px', fontSize: '0.72rem', borderRadius: '4px', border: '1px solid #bbf7d0', backgroundColor: '#ffffff', color: '#15803d', cursor: 'pointer' }}
                      >
                        ✅ Cold-Start Safe Molecule (SMILES)
                      </button>
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Frequency</label>
                    <input type="text" className="form-control" value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Duration</label>
                    <input type="text" className="form-control" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Patient-Conditioned DDI Risk Alert Panel */}
              {riskLoading ? (
                <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem', color: '#64748b' }}>
                  Evaluating patient physiological DDI risk via R-GCN...
                </div>
              ) : riskData && !riskData.available ? (
                <div style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '14px', fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Info size={16} color="#64748b" />
                  <span><strong>ML check unavailable</strong> &mdash; Proceeding with standard clinical workflow.</span>
                </div>
              ) : riskData && riskData.available ? (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  marginBottom: '14px',
                  border: `1px solid ${
                    riskData.max_risk_level === 'CRITICAL' || riskData.max_risk_level === 'HIGH' ? '#ef4444' :
                    riskData.max_risk_level === 'MODERATE' ? '#f59e0b' : '#10b981'
                  }`,
                  backgroundColor:
                    riskData.max_risk_level === 'CRITICAL' || riskData.max_risk_level === 'HIGH' ? '#fef2f2' :
                    riskData.max_risk_level === 'MODERATE' ? '#fffbeb' : '#ecfdf5',
                  color:
                    riskData.max_risk_level === 'CRITICAL' || riskData.max_risk_level === 'HIGH' ? '#991b1b' :
                    riskData.max_risk_level === 'MODERATE' ? '#92400e' : '#065f46'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '0.92rem' }}>
                      {riskData.max_risk_level === 'CRITICAL' || riskData.max_risk_level === 'HIGH' ? (
                        <AlertTriangle size={18} color="#dc2626" />
                      ) : riskData.max_risk_level === 'MODERATE' ? (
                        <AlertTriangle size={18} color="#d97706" />
                      ) : (
                        <CheckCircle size={18} color="#059669" />
                      )}
                      <span>
                        {riskData.max_risk_level === 'CRITICAL' ? '🚨 CRITICAL DRUG-INTERACTION RISK' :
                         riskData.max_risk_level === 'HIGH' ? '⚠️ HIGH DRUG-INTERACTION RISK' :
                         riskData.max_risk_level === 'MODERATE' ? '⚡ MODERATE INTERACTION RISK' :
                         '✅ LOW INTERACTION RISK'}
                        {' (Risk: '}{(riskData.max_risk_score * 100).toFixed(1)}{'%)'}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: riskData.cold_start ? '#f3e8ff' : '#e0f2fe',
                      color: riskData.cold_start ? '#6b21a8' : '#0369a1',
                      border: riskData.cold_start ? '1px solid #d8b4fe' : '1px solid #bae6fd'
                    }}>
                      {riskData.cold_start
                        ? '🧬 Zero-Shot Cold-Start (2048-bit Morgan FP)'
                        : '🕸️ DrugBank R-GCN Graph (1,706 Nodes)'}
                    </span>
                  </div>

                  {riskData.resolved_generic_name && (
                    <div style={{ marginTop: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#334155', backgroundColor: 'rgba(255,255,255,0.65)', padding: '3px 8px', borderRadius: '4px', display: 'inline-block' }}>
                      🔍 Resolved Active Ingredient: <strong>{riskData.resolved_generic_name}</strong>
                      {riskData.resolved_drugbank_id ? ` (${riskData.resolved_drugbank_id})` : ''}
                    </div>
                  )}

                  {riskData.interactions && riskData.interactions.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.84rem' }}>
                      {riskData.interactions.map((it, idx) => (
                        <div key={idx} style={{ marginTop: '4px' }}>
                          &bull; Interacting with <strong>{it.interacting_drug}</strong>: {it.risk_level}
                          {it.physiological_amplification && (
                            <span style={{ marginLeft: '6px', fontWeight: 'bold', color: '#b91c1c' }}>
                              [Patient Context Amplified]
                            </span>
                          )}
                          {it.explanation && (
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '12px' }}>
                              {it.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {riskData.attention_weights && Object.keys(riskData.attention_weights).length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#4b5563' }}>
                      <strong>Attention Distribution:</strong>{' '}
                      {Object.entries(riskData.attention_weights)
                        .map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`)
                        .join(' | ')}
                    </div>
                  )}

                  <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#6b7280', fontStyle: 'italic' }}>
                    Research prototype. Not for clinical diagnostic or prescribing use. (Latency: {riskData.inference_time_ms}ms)
                  </div>
                </div>
              ) : null}

              <div className="form-group">
                <label>Instructions / Advice</label>
                <input type="text" className="form-control" placeholder="e.g. Take after food with water" value={formData.instructions} onChange={(e) => setFormData({ ...formData, instructions: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Prescription</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
