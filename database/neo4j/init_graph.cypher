// ====================================================================
// SMART HOSPITAL INFORMATION SYSTEM - NEO4J SCHEMA DEFINITIONS & CONSTRAINTS
// ====================================================================

// Uniqueness Constraints for Graph Entity Nodes
CREATE CONSTRAINT patient_id_unique IF NOT EXISTS FOR (p:Patient) REQUIRE p.patientId IS UNIQUE;
CREATE CONSTRAINT doctor_id_unique IF NOT EXISTS FOR (d:Doctor) REQUIRE d.doctorId IS UNIQUE;
CREATE CONSTRAINT department_id_unique IF NOT EXISTS FOR (dept:Department) REQUIRE dept.departmentId IS UNIQUE;
CREATE CONSTRAINT disease_id_unique IF NOT EXISTS FOR (dis:Disease) REQUIRE dis.diseaseId IS UNIQUE;
CREATE CONSTRAINT medicine_id_unique IF NOT EXISTS FOR (m:Medicine) REQUIRE m.medicineId IS UNIQUE;

// Performance Indexes for Traversal
CREATE INDEX patient_name_idx IF NOT EXISTS FOR (p:Patient) ON (p.name);
CREATE INDEX doctor_specialization_idx IF NOT EXISTS FOR (d:Doctor) ON (d.specialization);
