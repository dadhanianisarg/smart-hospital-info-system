const { getSession, getStatus } = require('../config/neo4j');
const sampleData = require('../seed/sampleData');
const localStore = require('./localStore');

// In-memory fallback graph store (ensures continuous functionality if live Neo4j daemon is unavailable)
const memoryGraph = {
  nodes: {
    Patient: new Map(),
    Doctor: new Map(),
    Department: new Map(),
    Disease: new Map(),
    Medicine: new Map(),
  },
  relationships: [], // array of { sourceId, sourceLabel, relType, targetId, targetLabel, properties }
};

// Populate memoryGraph with persistent store data
function initMemoryGraph() {
  const store = localStore.load();
  const depts = store.departments || sampleData.departments;
  const docs = store.doctors || sampleData.doctors;
  const disList = store.diseases || sampleData.diseases;
  const medList = store.medicines || sampleData.medicines;
  const patList = store.patients || sampleData.patients;
  const aptList = store.appointments || sampleData.appointments;
  const rxList = store.prescriptions || sampleData.prescriptions;

  depts.forEach(d => memoryGraph.nodes.Department.set(d.departmentId, d));
  docs.forEach(d => memoryGraph.nodes.Doctor.set(d.doctorId, d));
  disList.forEach(d => memoryGraph.nodes.Disease.set(d.diseaseId, d));
  medList.forEach(m => memoryGraph.nodes.Medicine.set(m.medicineId, m));
  patList.forEach(p => memoryGraph.nodes.Patient.set(p.patientId, p));

  docs.forEach(d => {
    memoryGraph.relationships.push({
      fromLabel: 'Doctor', fromId: d.doctorId, relType: 'BELONGS_TO', toLabel: 'Department', toId: d.departmentId, properties: {}
    });
  });

  const treatedPairs = new Set();
  aptList.forEach(a => treatedPairs.add(`${a.patientId}|${a.doctorId}`));
  rxList.forEach(p => treatedPairs.add(`${p.patientId}|${p.doctorId}`));
  treatedPairs.forEach(pair => {
    const [pId, dId] = pair.split('|');
    memoryGraph.relationships.push({
      fromLabel: 'Patient', fromId: pId, relType: 'TREATED_BY', toLabel: 'Doctor', toId: dId, properties: {}
    });
  });

  patList.forEach(p => {
    if (Array.isArray(p.medicalHistory)) {
      p.medicalHistory.forEach(h => {
        const matched = disList.find(d => d.name.toLowerCase().includes(h.disease.toLowerCase()) || h.disease.toLowerCase().includes(d.name.toLowerCase()));
        if (matched) {
          memoryGraph.relationships.push({
            fromLabel: 'Patient', fromId: p.patientId, relType: 'DIAGNOSED_WITH', toLabel: 'Disease', toId: matched.diseaseId, properties: { diagnosedYear: h.diagnosedYear }
          });
        }
      });
    }
  });

  sampleData.doctorTreatsDiseases.forEach(item => {
    memoryGraph.relationships.push({
      fromLabel: 'Doctor', fromId: item.doctorId, relType: 'TREATS', toLabel: 'Disease', toId: item.diseaseId, properties: {}
    });
  });

  rxList.forEach(rx => {
    if (Array.isArray(rx.medicines)) {
      rx.medicines.forEach(med => {
        if (med.medicineId) {
          memoryGraph.relationships.push({
            fromLabel: 'Doctor', fromId: rx.doctorId, relType: 'PRESCRIBED', toLabel: 'Medicine', toId: med.medicineId, properties: { dosage: med.dosage }
          });
          memoryGraph.relationships.push({
            fromLabel: 'Patient', fromId: rx.patientId, relType: 'TAKES', toLabel: 'Medicine', toId: med.medicineId, properties: {}
          });
        }
      });
    }
  });
}

// Auto-run bootstrap
initMemoryGraph();

const neo4jService = {
  // Helper to execute Cypher or fallback
  async runCypher(query, params = {}) {
    if (getStatus()) {
      const session = getSession();
      try {
        const result = await session.run(query, params);
        return result.records;
      } finally {
        await session.close();
      }
    }
    return null;
  },

  // 1. Create / Merge Patient Node
  async createPatientNode(patient) {
    const { patientId, name, age, gender } = patient;
    // Update in-memory
    memoryGraph.nodes.Patient.set(patientId, { patientId, name, age, gender });

    if (getStatus()) {
      const cypher = `
        MERGE (p:Patient { patientId: $patientId })
        SET p.name = $name, p.age = $age, p.gender = $gender
        RETURN p
      `;
      return this.runCypher(cypher, { patientId, name, age: Number(age), gender });
    }
    return { success: true, mode: 'fallback', data: { patientId, name, age, gender } };
  },

  // 2. Create / Merge Doctor Node
  async createDoctorNode(doctor) {
    const { doctorId, name, specialization } = doctor;
    memoryGraph.nodes.Doctor.set(doctorId, { doctorId, name, specialization });

    if (getStatus()) {
      const cypher = `
        MERGE (d:Doctor { doctorId: $doctorId })
        SET d.name = $name, d.specialization = $specialization
        RETURN d
      `;
      return this.runCypher(cypher, { doctorId, name, specialization });
    }
    return { success: true, mode: 'fallback', data: { doctorId, name, specialization } };
  },

  // 3. Create / Merge Department Node
  async createDepartmentNode(department) {
    const { departmentId, name } = department;
    memoryGraph.nodes.Department.set(departmentId, { departmentId, name });

    if (getStatus()) {
      const cypher = `
        MERGE (dept:Department { departmentId: $departmentId })
        SET dept.name = $name
        RETURN dept
      `;
      return this.runCypher(cypher, { departmentId, name });
    }
    return { success: true, mode: 'fallback', data: { departmentId, name } };
  },

  // 4. Create / Merge Disease Node
  async createDiseaseNode(disease) {
    const { diseaseId, name } = disease;
    memoryGraph.nodes.Disease.set(diseaseId, { diseaseId, name });

    if (getStatus()) {
      const cypher = `
        MERGE (dis:Disease { diseaseId: $diseaseId })
        SET dis.name = $name
        RETURN dis
      `;
      return this.runCypher(cypher, { diseaseId, name });
    }
    return { success: true, mode: 'fallback', data: { diseaseId, name } };
  },

  // 5. Create / Merge Medicine Node
  async createMedicineNode(medicine) {
    const { medicineId, name, category } = medicine;
    memoryGraph.nodes.Medicine.set(medicineId, { medicineId, name, category: category || '' });

    if (getStatus()) {
      const cypher = `
        MERGE (m:Medicine { medicineId: $medicineId })
        SET m.name = $name, m.category = $category
        RETURN m
      `;
      return this.runCypher(cypher, { medicineId, name, category: category || '' });
    }
    return { success: true, mode: 'fallback', data: { medicineId, name, category } };
  },

  // 6. Create Relationships
  async createRelationship({ fromLabel, fromIdKey, fromIdValue, relType, toLabel, toIdKey, toIdValue, properties = {} }) {
    // Save in-memory
    const exists = memoryGraph.relationships.some(
      r => r.fromId === fromIdValue && r.relType === relType && r.toId === toIdValue
    );
    if (!exists) {
      memoryGraph.relationships.push({
        fromLabel,
        fromId: fromIdValue,
        relType,
        toLabel,
        toId: toIdValue,
        properties,
      });
    }

    if (getStatus()) {
      const cypher = `
        MATCH (a:${fromLabel} { ${fromIdKey}: $fromIdValue })
        MATCH (b:${toLabel} { ${toIdKey}: $toIdValue })
        MERGE (a)-[r:${relType}]->(b)
        SET r += $properties
        RETURN r
      `;
      return this.runCypher(cypher, { fromIdValue, toIdValue, properties });
    }
    return { success: true, mode: 'fallback', data: { fromIdValue, relType, toIdValue } };
  },

  // 7. Get Patient's Complete Relationship Graph
  async getPatientGraph(patientId) {
    if (getStatus()) {
      const cypher = `
        MATCH (p:Patient { patientId: $patientId })
        OPTIONAL MATCH (p)-[r1:TREATED_BY]->(d:Doctor)
        OPTIONAL MATCH (d)-[r2:BELONGS_TO]->(dept:Department)
        OPTIONAL MATCH (p)-[r3:DIAGNOSED_WITH]->(dis:Disease)
        OPTIONAL MATCH (p)-[r4:TAKES]->(m:Medicine)
        OPTIONAL MATCH (d)-[r5:TREATS]->(dis)
        OPTIONAL MATCH (d)-[r6:PRESCRIBED]->(m)
        RETURN p, 
               collect(DISTINCT d) as doctors, 
               collect(DISTINCT dept) as departments, 
               collect(DISTINCT dis) as diseases, 
               collect(DISTINCT m) as medicines
      `;
      const records = await this.runCypher(cypher, { patientId });
      if (records && records.length > 0) {
        const record = records[0];
        const p = record.get('p') ? record.get('p').properties : null;
        if (!p) return null;
        return {
          patient: p,
          doctors: record.get('doctors').map(node => node.properties),
          departments: record.get('departments').map(node => node.properties),
          diseases: record.get('diseases').map(node => node.properties),
          medicines: record.get('medicines').map(node => node.properties),
        };
      }
    }

    // In-memory fallback
    const p = memoryGraph.nodes.Patient.get(patientId);
    if (!p) return null;

    const patientRels = memoryGraph.relationships.filter(r => r.fromId === patientId || r.toId === patientId);
    const doctorIds = new Set();
    const diseaseIds = new Set();
    const medicineIds = new Set();

    patientRels.forEach(r => {
      if (r.relType === 'TREATED_BY') doctorIds.add(r.toId);
      if (r.relType === 'DIAGNOSED_WITH') diseaseIds.add(r.toId);
      if (r.relType === 'TAKES') medicineIds.add(r.toId);
    });

    const doctors = Array.from(doctorIds).map(id => memoryGraph.nodes.Doctor.get(id)).filter(Boolean);
    const diseases = Array.from(diseaseIds).map(id => memoryGraph.nodes.Disease.get(id)).filter(Boolean);
    const medicines = Array.from(medicineIds).map(id => memoryGraph.nodes.Medicine.get(id)).filter(Boolean);

    // Departments through doctors
    const deptIds = new Set();
    doctors.forEach(doc => {
      memoryGraph.relationships
        .filter(r => r.fromId === doc.doctorId && r.relType === 'BELONGS_TO')
        .forEach(r => deptIds.add(r.toId));
    });
    const departments = Array.from(deptIds).map(id => memoryGraph.nodes.Department.get(id)).filter(Boolean);

    return {
      patient: p,
      doctors,
      departments,
      diseases,
      medicines,
    };
  },

  // 8. Get Doctors in a Department
  async getDoctorsByDepartment(departmentId) {
    if (getStatus()) {
      const cypher = `
        MATCH (d:Doctor)-[:BELONGS_TO]->(dept:Department { departmentId: $departmentId })
        RETURN d, dept
      `;
      const records = await this.runCypher(cypher, { departmentId });
      return records.map(r => ({
        doctor: r.get('d').properties,
        department: r.get('dept').properties,
      }));
    }

    // In-memory fallback
    const doctorRels = memoryGraph.relationships.filter(
      r => r.relType === 'BELONGS_TO' && r.toId === departmentId
    );
    const dept = memoryGraph.nodes.Department.get(departmentId);
    return doctorRels.map(r => ({
      doctor: memoryGraph.nodes.Doctor.get(r.fromId),
      department: dept,
    })).filter(item => item.doctor);
  },

  // 9. Get Diseases associated with a Patient
  async getDiseasesByPatient(patientId) {
    if (getStatus()) {
      const cypher = `
        MATCH (p:Patient { patientId: $patientId })-[:DIAGNOSED_WITH]->(d:Disease)
        RETURN d
      `;
      const records = await this.runCypher(cypher, { patientId });
      return records.map(r => r.get('d').properties);
    }

    const rels = memoryGraph.relationships.filter(
      r => r.fromId === patientId && r.relType === 'DIAGNOSED_WITH'
    );
    return rels.map(r => memoryGraph.nodes.Disease.get(r.toId)).filter(Boolean);
  },

  // 10. Get Medicines prescribed / taken by a Patient
  async getMedicinesByPatient(patientId) {
    if (getStatus()) {
      const cypher = `
        MATCH (p:Patient { patientId: $patientId })-[:TAKES]->(m:Medicine)
        RETURN m
      `;
      const records = await this.runCypher(cypher, { patientId });
      return records.map(r => r.get('m').properties);
    }

    const rels = memoryGraph.relationships.filter(
      r => r.fromId === patientId && r.relType === 'TAKES'
    );
    return rels.map(r => memoryGraph.nodes.Medicine.get(r.toId)).filter(Boolean);
  },

  // 11. Get Full Graph (Nodes & Edges for Visualizer / Graph Explorer)
  async getFullGraph() {
    if (getStatus()) {
      const cypher = `
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, labels(n) as labels, r, type(r) as relType, m, labels(m) as targetLabels
      `;
      const records = await this.runCypher(cypher);
      const nodesMap = new Map();
      const edges = [];

      records.forEach(rec => {
        const sourceNode = rec.get('n');
        if (sourceNode) {
          const sProps = sourceNode.properties;
          const sLabel = rec.get('labels')[0] || 'Unknown';
          const sId = sProps.patientId || sProps.doctorId || sProps.departmentId || sProps.diseaseId || sProps.medicineId || sourceNode.identity.toString();
          if (!nodesMap.has(sId)) {
            nodesMap.set(sId, { id: sId, label: sProps.name || sId, type: sLabel, properties: sProps });
          }

          const targetNode = rec.get('m');
          const rel = rec.get('r');
          if (targetNode && rel) {
            const tProps = targetNode.properties;
            const tLabel = rec.get('targetLabels')[0] || 'Unknown';
            const tId = tProps.patientId || tProps.doctorId || tProps.departmentId || tProps.diseaseId || tProps.medicineId || targetNode.identity.toString();
            if (!nodesMap.has(tId)) {
              nodesMap.set(tId, { id: tId, label: tProps.name || tId, type: tLabel, properties: tProps });
            }
            edges.push({
              id: `${sId}->${tId}:${rec.get('relType')}`,
              from: sId,
              to: tId,
              label: rec.get('relType'),
            });
          }
        }
      });

      return {
        nodes: Array.from(nodesMap.values()),
        edges,
      };
    }

    // Fallback format
    const nodes = [];
    Object.entries(memoryGraph.nodes).forEach(([label, map]) => {
      map.forEach(item => {
        const id = item.patientId || item.doctorId || item.departmentId || item.diseaseId || item.medicineId;
        nodes.push({
          id,
          label: item.name || id,
          type: label,
          properties: item,
        });
      });
    });

    const edges = memoryGraph.relationships.map((rel, idx) => ({
      id: `rel-${idx}`,
      from: rel.fromId,
      to: rel.toId,
      label: rel.relType,
    }));

    return { nodes, edges };
  },

  // Clear graph (for reseeding)
  async clearAll() {
    Object.values(memoryGraph.nodes).forEach(map => map.clear());
    memoryGraph.relationships.length = 0;

    if (getStatus()) {
      return this.runCypher('MATCH (n) DETACH DELETE n');
    }
    return { success: true };
  },
};

module.exports = neo4jService;
