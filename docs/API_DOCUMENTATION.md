# Smart Hospital Information System - Complete REST API Specification

**Project:** Smart Hospital Information System using MongoDB and Neo4j  
**Team Members / Authors:**
1. **Yash Khose** (23BCE0625)
2. **Tanish Chawla** (23BCE0502)  
**Institution:** Vellore Institute of Technology (VIT)  
**Base URL:** `http://localhost:5000/api`  
**Content-Type:** `application/json`

---

## Architecture & Conventions

All endpoints adhere to standard RESTful conventions:
- **`200 OK`**: Request succeeded with response body.
- **`201 Created`**: Entity successfully inserted into MongoDB / Neo4j.
- **`400 Bad Request`**: Validation error (missing required fields, bad type, out-of-range value).
- **`404 Not Found`**: Resource with given identifier does not exist.
- **`409 Conflict`**: Unique identifier constraint violation (duplicate key).
- **`500 Internal Server Error`**: Unexpected database exception caught by centralized error middleware.

---

## 1. System & Health APIs

### 1.1 Health Check
- **Method:** `GET`
- **URL:** `/api/health`
- **Purpose:** Verifies operational readiness of backend server.
- **Database Affected:** None
- **Example Response (`200 OK`):**
  ```json
  {
    "status": "OK",
    "message": "Smart Hospital Information System API is running",
    "timestamp": "2026-09-25T16:37:03.982Z"
  }
  ```

---

## 2. Patient Management APIs (MongoDB Document Store)

### 2.1 Register New Patient
- **Method:** `POST`
- **URL:** `/api/patients`
- **Purpose:** Registers a new patient document and creates a corresponding `(:Patient)` node in Neo4j.
- **Database Affected:** MongoDB (`smart_hospital.patients`) & Neo4j (`:Patient` node)
- **Request Body:**
  ```json
  {
    "patientId": "P111",
    "name": "Kavish Patel",
    "age": 32,
    "gender": "Male",
    "bloodGroup": "B+",
    "phone": "9811223344",
    "email": "kavish.patel@example.com",
    "address": {
      "street": "44 Linking Road",
      "city": "Mumbai",
      "state": "Maharashtra",
      "zipCode": "400050"
    },
    "medicalHistory": [
      {
        "disease": "Hypertension",
        "diagnosedYear": 2024,
        "notes": "Mild elevated systolic pressure"
      }
    ]
  }
  ```
- **Example Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Patient registered successfully in MongoDB and Neo4j graph",
    "data": {
      "_id": "673f1a2b3c4d5e6f7a8b9c01",
      "patientId": "P111",
      "name": "Kavish Patel",
      "age": 32,
      "gender": "Male",
      "bloodGroup": "B+",
      "phone": "9811223344",
      "email": "kavish.patel@example.com",
      "address": { "street": "44 Linking Road", "city": "Mumbai", "state": "Maharashtra", "zipCode": "400050" },
      "medicalHistory": [{ "disease": "Hypertension", "diagnosedYear": 2024, "notes": "Mild elevated systolic pressure" }],
      "createdAt": "2026-09-25T16:38:00.000Z",
      "updatedAt": "2026-09-25T16:38:00.000Z"
    }
  }
  ```
- **Errors:** `400 Bad Request` (invalid email, age < 0), `409 Conflict` (duplicate `patientId`).

### 2.2 Get All Patients
- **Method:** `GET`
- **URL:** `/api/patients`
- **Query Parameters:**
  - `search` (optional): Filter by name, patientId, or phone
  - `gender` (optional): Male, Female, Other
  - `bloodGroup` (optional): Blood group filter
- **Database Affected:** MongoDB (`patients`)
- **Example Response (`200 OK`):**
  ```json
  {
    "success": true,
    "count": 10,
    "data": [
      {
        "patientId": "P101",
        "name": "Rahul Verma",
        "age": 38,
        "gender": "Male",
        "bloodGroup": "B+",
        "phone": "9876543210",
        "email": "rahul.verma@example.com"
      }
    ]
  }
  ```

### 2.3 Get Patient by ID
- **Method:** `GET`
- **URL:** `/api/patients/:id`
- **Path Parameter:** `id` (e.g. `P101`)
- **Database Affected:** MongoDB (`patients`)
- **Example Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "patientId": "P101",
      "name": "Rahul Verma",
      "age": 38,
      "gender": "Male",
      "bloodGroup": "B+",
      "phone": "9876543210",
      "email": "rahul.verma@example.com",
      "address": { "street": "14 MG Road", "city": "Mumbai", "state": "Maharashtra", "zipCode": "400001" },
      "medicalHistory": [{ "disease": "Hypertension", "diagnosedYear": 2023, "notes": "Stage 1 essential hypertension" }]
    }
  }
  ```
- **Errors:** `404 Not Found` if `id` does not exist.

### 2.4 Update Patient
- **Method:** `PUT`
- **URL:** `/api/patients/:id`
- **Path Parameter:** `id` (e.g. `P101`)
- **Request Body:** JSON containing updated demographic fields.
- **Database Affected:** MongoDB (`patients`) and Neo4j (`:Patient` node properties)
- **Example Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Patient updated successfully in MongoDB and Neo4j",
    "data": { "patientId": "P101", "name": "Rahul Verma", "age": 39 }
  }
  ```

### 2.5 Delete Patient
- **Method:** `DELETE`
- **URL:** `/api/patients/:id`
- **Database Affected:** MongoDB (`patients`)
- **Example Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Patient P101 deleted successfully from MongoDB"
  }
  ```

---

## 3. Doctor Management APIs

### 3.1 Register Doctor
- **Method:** `POST`
- **URL:** `/api/doctors`
- **Database Affected:** MongoDB (`doctors`), Neo4j (`:Doctor` node and `[:BELONGS_TO]` relationship to `:Department`)
- **Request Body:**
  ```json
  {
    "doctorId": "D106",
    "name": "Dr. Sunita Rao",
    "specialization": "Pediatric Cardiology",
    "departmentId": "DEP01",
    "phone": "9820998877",
    "email": "sunita.rao@hospital.org",
    "experience": 11
  }
  ```
- **Example Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Doctor created successfully in MongoDB and linked in Neo4j",
    "data": {
      "doctorId": "D106",
      "name": "Dr. Sunita Rao",
      "specialization": "Pediatric Cardiology",
      "departmentId": "DEP01",
      "experience": 11
    }
  }
  ```

### 3.2 Get All Doctors
- **Method:** `GET`
- **URL:** `/api/doctors`
- **Query Parameters:** `departmentId`, `search`
- **Database Affected:** MongoDB (`doctors`)

### 3.3 Get Doctor by ID
- **Method:** `GET`
- **URL:** `/api/doctors/:id`

### 3.4 Update Doctor
- **Method:** `PUT`
- **URL:** `/api/doctors/:id`

### 3.5 Delete Doctor
- **Method:** `DELETE`
- **URL:** `/api/doctors/:id`

---

## 4. Department Management APIs

### 4.1 Create Department
- **Method:** `POST`
- **URL:** `/api/departments`
- **Database Affected:** MongoDB (`departments`) and Neo4j (`:Department` node)
- **Request Body:**
  ```json
  {
    "departmentId": "DEP05",
    "name": "Oncology",
    "description": "Cancer screening, chemotherapy, and tumor therapy"
  }
  ```

### 4.2 Get All Departments
- **Method:** `GET`
- **URL:** `/api/departments`

### 4.3 Get Department by ID
- **Method:** `GET`
- **URL:** `/api/departments/:id`

### 4.4 Update Department
- **Method:** `PUT`
- **URL:** `/api/departments/:id`

### 4.5 Delete Department
- **Method:** `DELETE`
- **URL:** `/api/departments/:id`

---

## 5. Appointment Management APIs

### 5.1 Schedule Appointment
- **Method:** `POST`
- **URL:** `/api/appointments`
- **Database Affected:** MongoDB (`appointments`) and Neo4j (`(Patient)-[:TREATED_BY]->(Doctor)`)
- **Request Body:**
  ```json
  {
    "appointmentId": "APT111",
    "patientId": "P101",
    "doctorId": "D101",
    "date": "2026-10-05",
    "time": "11:30",
    "status": "Scheduled",
    "reason": "Blood pressure checkup"
  }
  ```
- **Example Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Appointment booked successfully and graph relationship created",
    "data": { "appointmentId": "APT111", "status": "Scheduled" }
  }
  ```

### 5.2 Get All Appointments
- **Method:** `GET`
- **URL:** `/api/appointments`
- **Query Parameters:** `patientId`, `doctorId`, `status`, `date`

### 5.3 Get Appointment by ID
- **Method:** `GET`
- **URL:** `/api/appointments/:id`

### 5.4 Update Appointment / Status
- **Method:** `PUT`
- **URL:** `/api/appointments/:id`
- **Request Body:** `{ "status": "Completed" }`

### 5.5 Delete Appointment
- **Method:** `DELETE`
- **URL:** `/api/appointments/:id`

---

## 6. Prescription Management APIs (Embedded Medicines Model)

### 6.1 Create Prescription
- **Method:** `POST`
- **URL:** `/api/prescriptions`
- **Database Affected:** MongoDB (`prescriptions`), Neo4j (`[:PRESCRIBED]`, `[:TAKES]`)
- **Request Body:**
  ```json
  {
    "prescriptionId": "RX109",
    "patientId": "P101",
    "doctorId": "D101",
    "diagnosis": "Stage 1 Hypertension",
    "instructions": "Take daily after morning breakfast",
    "date": "2026-10-05",
    "medicines": [
      {
        "medicineId": "MED01",
        "name": "Amlodipine 5mg",
        "dosage": "5mg",
        "frequency": "Once daily",
        "duration": "30 days"
      }
    ]
  }
  ```

### 6.2 Get All Prescriptions
- **Method:** `GET`
- **URL:** `/api/prescriptions`
- **Query Parameters:** `patientId`, `doctorId`

### 6.3 Get Prescription by ID
- **Method:** `GET`
- **URL:** `/api/prescriptions/:id`

### 6.4 Delete Prescription
- **Method:** `DELETE`
- **URL:** `/api/prescriptions/:id`

---

## 7. Neo4j Graph Query APIs

### 7.1 Get Patient Complete Relationship Graph
- **Method:** `GET`
- **URL:** `/api/graph/patient/:patientId`
- **Purpose:** Traverses Neo4j multi-hop graph to retrieve the patient node, all treating doctors, their departments, diagnosed diseases, and prescribed/taken medicines.
- **Underlying Cypher:**
  ```cypher
  MATCH (p:Patient { patientId: $patientId })
  OPTIONAL MATCH (p)-[:TREATED_BY]->(d:Doctor)
  OPTIONAL MATCH (d)-[:BELONGS_TO]->(dept:Department)
  OPTIONAL MATCH (p)-[:DIAGNOSED_WITH]->(dis:Disease)
  OPTIONAL MATCH (p)-[:TAKES]->(m:Medicine)
  RETURN p, collect(DISTINCT d), collect(DISTINCT dept), collect(DISTINCT dis), collect(DISTINCT m);
  ```
- **Example Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "patient": { "patientId": "P101", "name": "Rahul Verma", "age": 38, "gender": "Male" },
      "doctors": [{ "doctorId": "D101", "name": "Dr. Rajesh Sharma", "specialization": "Interventional Cardiology" }],
      "departments": [{ "departmentId": "DEP01", "name": "Cardiology" }],
      "diseases": [{ "diseaseId": "DIS01", "name": "Hypertension" }],
      "medicines": [
        { "medicineId": "MED01", "name": "Amlodipine 5mg", "category": "Antihypertensive" },
        { "medicineId": "MED10", "name": "Telmisartan 40mg", "category": "Antihypertensive" }
      ]
    }
  }
  ```

### 7.2 Get Doctors in Department
- **Method:** `GET`
- **URL:** `/api/graph/department/:departmentId/doctors`
- **Underlying Cypher:**
  ```cypher
  MATCH (d:Doctor)-[:BELONGS_TO]->(dept:Department { departmentId: $departmentId })
  RETURN d, dept;
  ```

### 7.3 Get Diseases Associated with Patient
- **Method:** `GET`
- **URL:** `/api/graph/patient/:patientId/diseases`
- **Underlying Cypher:**
  ```cypher
  MATCH (p:Patient { patientId: $patientId })-[:DIAGNOSED_WITH]->(d:Disease)
  RETURN d;
  ```

### 7.4 Get Medicines Prescribed / Taken by Patient
- **Method:** `GET`
- **URL:** `/api/graph/patient/:patientId/medicines`
- **Underlying Cypher:**
  ```cypher
  MATCH (p:Patient { patientId: $patientId })-[:TAKES]->(m:Medicine)
  RETURN m;
  ```

### 7.5 Get Full Overview Graph
- **Method:** `GET`
- **URL:** `/api/graph/all`
- **Purpose:** Returns all nodes and directed edges formatted for visualization.

### 7.6 Multi-Database Dashboard Statistics
- **Method:** `GET`
- **URL:** `/api/graph/stats`
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "totalPatients": 10,
      "totalDoctors": 5,
      "totalDepartments": 4,
      "totalAppointments": 10,
      "totalPrescriptions": 8
    }
  }
  ```

---

## 8. Explicit Graph Node & Edge Creation APIs

| Endpoint | Method | Purpose | Payload |
|---|---|---|---|
| `/api/graph/nodes/patient` | `POST` | Create `(:Patient)` node | `{ patientId, name, age, gender }` |
| `/api/graph/nodes/doctor` | `POST` | Create `(:Doctor)` node | `{ doctorId, name, specialization }` |
| `/api/graph/nodes/department` | `POST` | Create `(:Department)` node | `{ departmentId, name }` |
| `/api/graph/nodes/disease` | `POST` | Create `(:Disease)` node | `{ diseaseId, name }` |
| `/api/graph/nodes/medicine` | `POST` | Create `(:Medicine)` node | `{ medicineId, name, category }` |
| `/api/graph/relationships` | `POST` | Create directed relationship | `{ fromLabel, fromIdValue, relType, toLabel, toIdValue, properties }` |
