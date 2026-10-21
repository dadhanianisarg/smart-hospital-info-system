# Smart Hospital Information System - Database Deliverables & Restore Guide

This directory contains the database dumps, JSON exports, and Cypher reproduction scripts for the **Smart Hospital Information System using MongoDB and Neo4j**.

---

## Directory Structure

```
database/
├── mongodb/
│   ├── patients.json                    # Exported MongoDB Patients collection
│   ├── doctors.json                     # Exported MongoDB Doctors collection
│   ├── departments.json                 # Exported MongoDB Departments collection
│   ├── appointments.json                # Exported MongoDB Appointments collection
│   ├── prescriptions.json               # Exported MongoDB Prescriptions collection
│   ├── diseases.json                    # Exported MongoDB Diseases collection
│   ├── medicines.json                   # Exported MongoDB Medicines collection
│   ├── smart_hospital_full_dump.json    # Complete consolidated database dump
│   └── restore_mongo.js                 # Automated Node.js MongoDB restoration script
├── neo4j/
│   ├── init_graph.cypher                # Schema constraints & graph indexes
│   └── sample_data.cypher               # Complete MERGE & relationship Cypher statements
├── export_all.js                        # Master export utility
└── README.md                            # Documentation and restoration procedures
```

---

## 1. MongoDB Restoration Instructions

### Option A: Using the Automated Node Script (Recommended)
Ensure your local MongoDB daemon is running (default port `27017`), then run from the root directory:
```bash
node database/mongodb/restore_mongo.js
```
This script will parse each collection's JSON file, clear the collections, and insert all documents with preserved ObjectIds and schemas.

### Option B: Using Native `mongoimport` CLI
If the MongoDB Database Tools are installed on your system PATH, you can import each collection directly:
```bash
mongoimport --db smart_hospital --collection patients --file database/mongodb/patients.json --jsonArray --drop
mongoimport --db smart_hospital --collection doctors --file database/mongodb/doctors.json --jsonArray --drop
mongoimport --db smart_hospital --collection departments --file database/mongodb/departments.json --jsonArray --drop
mongoimport --db smart_hospital --collection appointments --file database/mongodb/appointments.json --jsonArray --drop
mongoimport --db smart_hospital --collection prescriptions --file database/mongodb/prescriptions.json --jsonArray --drop
mongoimport --db smart_hospital --collection diseases --file database/mongodb/diseases.json --jsonArray --drop
mongoimport --db smart_hospital --collection medicines --file database/mongodb/medicines.json --jsonArray --drop
```

### Option C: Using Backend Seeder
From the `server` directory, run:
```bash
npm run seed
```

---

## 2. Neo4j Restoration Instructions

### Option A: Using Neo4j Browser UI (Desktop / AuraDB / Web)
1. Open Neo4j Browser at `http://localhost:7474`.
2. First, execute the constraints from `database/neo4j/init_graph.cypher`:
   ```cypher
   CREATE CONSTRAINT patient_id_unique IF NOT EXISTS FOR (p:Patient) REQUIRE p.patientId IS UNIQUE;
   CREATE CONSTRAINT doctor_id_unique IF NOT EXISTS FOR (d:Doctor) REQUIRE d.doctorId IS UNIQUE;
   CREATE CONSTRAINT department_id_unique IF NOT EXISTS FOR (dept:Department) REQUIRE dept.departmentId IS UNIQUE;
   CREATE CONSTRAINT disease_id_unique IF NOT EXISTS FOR (dis:Disease) REQUIRE dis.diseaseId IS UNIQUE;
   CREATE CONSTRAINT medicine_id_unique IF NOT EXISTS FOR (m:Medicine) REQUIRE m.medicineId IS UNIQUE;
   ```
3. Open `database/neo4j/sample_data.cypher`, copy all statements, paste into the Cypher prompt, and run.

### Option B: Using `cypher-shell` CLI
Run via terminal or command prompt:
```bash
cypher-shell -u neo4j -p password -f database/neo4j/init_graph.cypher
cypher-shell -u neo4j -p password -f database/neo4j/sample_data.cypher
```

### Option C: Built-in Synchronized Graph Fallback
The backend server includes a synchronized graph engine. If Neo4j Community/Desktop is not currently running, the server automatically initializes the graph model in memory, enabling seamless querying and graph visualization without service interruption.

---

## 3. Data Integrity & Verification

| Entity / Collection | Count | Description | Primary Key |
|---------------------|-------|-------------|-------------|
| `patients`          | 10    | Patients with demographics & histories | `patientId` |
| `doctors`           | 5     | Physicians mapped to departments | `doctorId` |
| `departments`       | 4     | Hospital clinical divisions | `departmentId` |
| `appointments`      | 10    | Consultations linking Patient & Doctor | `appointmentId` |
| `prescriptions`     | 8     | Medications prescribed to Patients | `prescriptionId` |
| `diseases`          | 8     | Medical diagnoses | `diseaseId` |
| `medicines`         | 10    | Pharmaceutical drugs | `medicineId` |
| Graph Relationships | 64    | `TREATED_BY`, `BELONGS_TO`, `DIAGNOSED_WITH`, `TREATS`, `PRESCRIBED`, `TAKES` | Edge pairs |
