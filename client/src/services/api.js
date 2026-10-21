const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || (data.errors ? data.errors.join(', ') : 'API Request Failed'));
    }
    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

export const api = {
  // Stats
  getStats: () => request('/graph/stats'),

  // Patients
  getPatients: (search = '') => request(`/patients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getPatientById: (id) => request(`/patients/${id}`),
  createPatient: (data) => request('/patients', { method: 'POST', body: JSON.stringify(data) }),
  updatePatient: (id, data) => request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePatient: (id) => request(`/patients/${id}`, { method: 'DELETE' }),

  // Doctors
  getDoctors: () => request('/doctors'),
  getDoctorById: (id) => request(`/doctors/${id}`),
  createDoctor: (data) => request('/doctors', { method: 'POST', body: JSON.stringify(data) }),
  updateDoctor: (id, data) => request(`/doctors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDoctor: (id) => request(`/doctors/${id}`, { method: 'DELETE' }),

  // Departments
  getDepartments: () => request('/departments'),
  createDepartment: (data) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
  updateDepartment: (id, data) => request(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDepartment: (id) => request(`/departments/${id}`, { method: 'DELETE' }),

  // Appointments
  getAppointments: () => request('/appointments'),
  createAppointment: (data) => request('/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id, data) => request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAppointment: (id) => request(`/appointments/${id}`, { method: 'DELETE' }),

  // Prescriptions
  getPrescriptions: () => request('/prescriptions'),
  createPrescription: (data) => request('/prescriptions', { method: 'POST', body: JSON.stringify(data) }),
  deletePrescription: (id) => request(`/prescriptions/${id}`, { method: 'DELETE' }),

  // Diseases & Medicines
  getDiseases: () => request('/diseases'),
  getMedicines: () => request('/medicines'),

  // Neo4j Graph Queries
  getPatientGraph: (patientId) => request(`/graph/patient/${patientId}`),
  getDepartmentDoctors: (departmentId) => request(`/graph/department/${departmentId}/doctors`),
  getFullGraph: () => request('/graph/all'),

  // DDI Risk Check
  checkRisk: (data) => request('/risk/check', { method: 'POST', body: JSON.stringify(data) }),
};
