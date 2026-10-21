// ====================================================================
// SMART HOSPITAL INFORMATION SYSTEM - REPRODUCIBLE CYPHER SEED DATA
// Project: Smart Hospital Information System using MongoDB and Neo4j
// ====================================================================

// 1. CREATE DEPARTMENTS
MERGE (dept:Department { departmentId: "DEP01" }) SET dept.name = "Cardiology", dept.description = "Comprehensive heart, cardiovascular, and thoracic care";
MERGE (dept:Department { departmentId: "DEP02" }) SET dept.name = "Neurology", dept.description = "Brain, central nervous system, and neuro-muscular disorders";
MERGE (dept:Department { departmentId: "DEP03" }) SET dept.name = "Orthopedics", dept.description = "Bone fractures, joint replacements, and musculoskeletal wellness";
MERGE (dept:Department { departmentId: "DEP04" }) SET dept.name = "General Medicine", dept.description = "Primary outpatient consultation and internal medical care";

// 2. CREATE DOCTORS & ASSIGN TO DEPARTMENTS
MERGE (d:Doctor { doctorId: "D101" }) SET d.name = "Dr. Rajesh Sharma", d.specialization = "Interventional Cardiology", d.experience = 14;
MATCH (d:Doctor { doctorId: "D101" }), (dept:Department { departmentId: "DEP01" }) MERGE (d)-[:BELONGS_TO]->(dept);
MERGE (d:Doctor { doctorId: "D102" }) SET d.name = "Dr. Ananya Iyer", d.specialization = "Preventive Cardiology", d.experience = 8;
MATCH (d:Doctor { doctorId: "D102" }), (dept:Department { departmentId: "DEP01" }) MERGE (d)-[:BELONGS_TO]->(dept);
MERGE (d:Doctor { doctorId: "D103" }) SET d.name = "Dr. Vikram Rao", d.specialization = "Clinical Neurology", d.experience = 12;
MATCH (d:Doctor { doctorId: "D103" }), (dept:Department { departmentId: "DEP02" }) MERGE (d)-[:BELONGS_TO]->(dept);
MERGE (d:Doctor { doctorId: "D104" }) SET d.name = "Dr. Sneha Patel", d.specialization = "Orthopedic Surgery", d.experience = 10;
MATCH (d:Doctor { doctorId: "D104" }), (dept:Department { departmentId: "DEP03" }) MERGE (d)-[:BELONGS_TO]->(dept);
MERGE (d:Doctor { doctorId: "D105" }) SET d.name = "Dr. Amitav Ghosh", d.specialization = "Internal Medicine", d.experience = 16;
MATCH (d:Doctor { doctorId: "D105" }), (dept:Department { departmentId: "DEP04" }) MERGE (d)-[:BELONGS_TO]->(dept);

// 3. CREATE DISEASES
MERGE (dis:Disease { diseaseId: "DIS01" }) SET dis.name = "Hypertension", dis.description = "Chronic arterial blood pressure elevation";
MERGE (dis:Disease { diseaseId: "DIS02" }) SET dis.name = "Coronary Artery Disease", dis.description = "Impairment of blood flow through coronary arteries";
MERGE (dis:Disease { diseaseId: "DIS03" }) SET dis.name = "Type 2 Diabetes", dis.description = "Metabolic disorder characterized by hyperglycemia and insulin resistance";
MERGE (dis:Disease { diseaseId: "DIS04" }) SET dis.name = "Migraine", dis.description = "Neurological headache disorder accompanied by sensory sensitivity";
MERGE (dis:Disease { diseaseId: "DIS05" }) SET dis.name = "Osteoarthritis", dis.description = "Degenerative joint disease resulting from cartilage breakdown";
MERGE (dis:Disease { diseaseId: "DIS06" }) SET dis.name = "Lumbar Spondylosis", dis.description = "Age-related degenerative osteoarthritis of lumbar spine";
MERGE (dis:Disease { diseaseId: "DIS07" }) SET dis.name = "Bronchial Asthma", dis.description = "Inflammatory disease of airways causing periodic wheezing";
MERGE (dis:Disease { diseaseId: "DIS08" }) SET dis.name = "GERD", dis.description = "Gastroesophageal reflux disease causing mucosal acid damage";

// 4. CREATE MEDICINES
MERGE (m:Medicine { medicineId: "MED01" }) SET m.name = "Amlodipine 5mg", m.category = "Antihypertensive";
MERGE (m:Medicine { medicineId: "MED02" }) SET m.name = "Atorvastatin 20mg", m.category = "Lipid-Lowering";
MERGE (m:Medicine { medicineId: "MED03" }) SET m.name = "Metformin 500mg", m.category = "Antidiabetic";
MERGE (m:Medicine { medicineId: "MED04" }) SET m.name = "Sumatriptan 50mg", m.category = "Antimigraine";
MERGE (m:Medicine { medicineId: "MED05" }) SET m.name = "Paracetamol 650mg", m.category = "Analgesic";
MERGE (m:Medicine { medicineId: "MED06" }) SET m.name = "Glucosamine 500mg", m.category = "Chondroprotective";
MERGE (m:Medicine { medicineId: "MED07" }) SET m.name = "Aceclofenac 100mg", m.category = "NSAID";
MERGE (m:Medicine { medicineId: "MED08" }) SET m.name = "Montelukast 10mg", m.category = "Antiasthmatic";
MERGE (m:Medicine { medicineId: "MED09" }) SET m.name = "Pantoprazole 40mg", m.category = "Proton Pump Inhibitor";
MERGE (m:Medicine { medicineId: "MED10" }) SET m.name = "Telmisartan 40mg", m.category = "Antihypertensive";

// 5. CREATE PATIENTS & DIAGNOSED_WITH RELATIONSHIPS
MERGE (p:Patient { patientId: "P101" }) SET p.name = "Rahul Verma", p.age = 38, p.gender = "Male";
MATCH (p:Patient { patientId: "P101" }), (dis:Disease { diseaseId: "DIS01" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2023 }]->(dis);
MERGE (p:Patient { patientId: "P102" }) SET p.name = "Priya Nair", p.age = 29, p.gender = "Female";
MATCH (p:Patient { patientId: "P102" }), (dis:Disease { diseaseId: "DIS04" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2022 }]->(dis);
MERGE (p:Patient { patientId: "P103" }) SET p.name = "Suresh Menon", p.age = 58, p.gender = "Male";
MATCH (p:Patient { patientId: "P103" }), (dis:Disease { diseaseId: "DIS02" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2021 }]->(dis);
MATCH (p:Patient { patientId: "P103" }), (dis:Disease { diseaseId: "DIS01" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2019 }]->(dis);
MERGE (p:Patient { patientId: "P104" }) SET p.name = "Kavita Reddy", p.age = 44, p.gender = "Female";
MATCH (p:Patient { patientId: "P104" }), (dis:Disease { diseaseId: "DIS03" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2020 }]->(dis);
MERGE (p:Patient { patientId: "P105" }) SET p.name = "Arun Mukherjee", p.age = 62, p.gender = "Male";
MATCH (p:Patient { patientId: "P105" }), (dis:Disease { diseaseId: "DIS05" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2022 }]->(dis);
MERGE (p:Patient { patientId: "P106" }) SET p.name = "Sunita Sharma", p.age = 51, p.gender = "Female";
MATCH (p:Patient { patientId: "P106" }), (dis:Disease { diseaseId: "DIS06" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2023 }]->(dis);
MATCH (p:Patient { patientId: "P106" }), (dis:Disease { diseaseId: "DIS01" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2024 }]->(dis);
MERGE (p:Patient { patientId: "P107" }) SET p.name = "Deepak Joshi", p.age = 34, p.gender = "Male";
MATCH (p:Patient { patientId: "P107" }), (dis:Disease { diseaseId: "DIS07" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2018 }]->(dis);
MERGE (p:Patient { patientId: "P108" }) SET p.name = "Meera Das", p.age = 41, p.gender = "Female";
MATCH (p:Patient { patientId: "P108" }), (dis:Disease { diseaseId: "DIS08" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2024 }]->(dis);
MERGE (p:Patient { patientId: "P109" }) SET p.name = "Karan Kapoor", p.age = 47, p.gender = "Male";
MATCH (p:Patient { patientId: "P109" }), (dis:Disease { diseaseId: "DIS03" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2021 }]->(dis);
MATCH (p:Patient { patientId: "P109" }), (dis:Disease { diseaseId: "DIS01" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2022 }]->(dis);
MERGE (p:Patient { patientId: "P110" }) SET p.name = "Anjali Bhatt", p.age = 26, p.gender = "Female";
MATCH (p:Patient { patientId: "P110" }), (dis:Disease { diseaseId: "DIS04" }) MERGE (p)-[:DIAGNOSED_WITH { diagnosedYear: 2025 }]->(dis);

// 6. DOCTOR TREATS DISEASE RELATIONSHIPS
MATCH (d:Doctor { doctorId: "D101" }), (dis:Disease { diseaseId: "DIS01" }) MERGE (d)-[:TREATS]->(dis);
MATCH (d:Doctor { doctorId: "D101" }), (dis:Disease { diseaseId: "DIS02" }) MERGE (d)-[:TREATS]->(dis);
MATCH (d:Doctor { doctorId: "D102" }), (dis:Disease { diseaseId: "DIS01" }) MERGE (d)-[:TREATS]->(dis);
MATCH (d:Doctor { doctorId: "D102" }), (dis:Disease { diseaseId: "DIS02" }) MERGE (d)-[:TREATS]->(dis);
MATCH (d:Doctor { doctorId: "D103" }), (dis:Disease { diseaseId: "DIS04" }) MERGE (d)-[:TREATS]->(dis);
MATCH (d:Doctor { doctorId: "D104" }), (dis:Disease { diseaseId: "DIS05" }) MERGE (d)-[:TREATS]->(dis);
MATCH (d:Doctor { doctorId: "D104" }), (dis:Disease { diseaseId: "DIS06" }) MERGE (d)-[:TREATS]->(dis);
MATCH (d:Doctor { doctorId: "D105" }), (dis:Disease { diseaseId: "DIS03" }) MERGE (d)-[:TREATS]->(dis);
MATCH (d:Doctor { doctorId: "D105" }), (dis:Disease { diseaseId: "DIS07" }) MERGE (d)-[:TREATS]->(dis);
MATCH (d:Doctor { doctorId: "D105" }), (dis:Disease { diseaseId: "DIS08" }) MERGE (d)-[:TREATS]->(dis);

// 7. APPOINTMENT & PRESCRIPTION RELATIONSHIPS (TREATED_BY, PRESCRIBED, TAKES)
MATCH (p:Patient { patientId: "P101" }), (d:Doctor { doctorId: "D101" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (p:Patient { patientId: "P102" }), (d:Doctor { doctorId: "D103" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (p:Patient { patientId: "P103" }), (d:Doctor { doctorId: "D102" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (p:Patient { patientId: "P104" }), (d:Doctor { doctorId: "D105" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (p:Patient { patientId: "P105" }), (d:Doctor { doctorId: "D104" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (p:Patient { patientId: "P106" }), (d:Doctor { doctorId: "D104" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (p:Patient { patientId: "P107" }), (d:Doctor { doctorId: "D105" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (p:Patient { patientId: "P108" }), (d:Doctor { doctorId: "D105" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (p:Patient { patientId: "P109" }), (d:Doctor { doctorId: "D101" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (p:Patient { patientId: "P110" }), (d:Doctor { doctorId: "D103" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (p:Patient { patientId: "P101" }), (d:Doctor { doctorId: "D101" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (d:Doctor { doctorId: "D101" }), (m:Medicine { medicineId: "MED01" }) MERGE (d)-[:PRESCRIBED { dosage: "5mg", date: "2026-09-10" }]->(m);
MATCH (p:Patient { patientId: "P101" }), (m:Medicine { medicineId: "MED01" }) MERGE (p)-[:TAKES]->(m);
MATCH (d:Doctor { doctorId: "D101" }), (m:Medicine { medicineId: "MED10" }) MERGE (d)-[:PRESCRIBED { dosage: "40mg", date: "2026-09-10" }]->(m);
MATCH (p:Patient { patientId: "P101" }), (m:Medicine { medicineId: "MED10" }) MERGE (p)-[:TAKES]->(m);
MATCH (p:Patient { patientId: "P102" }), (d:Doctor { doctorId: "D103" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (d:Doctor { doctorId: "D103" }), (m:Medicine { medicineId: "MED04" }) MERGE (d)-[:PRESCRIBED { dosage: "50mg", date: "2026-09-11" }]->(m);
MATCH (p:Patient { patientId: "P102" }), (m:Medicine { medicineId: "MED04" }) MERGE (p)-[:TAKES]->(m);
MATCH (d:Doctor { doctorId: "D103" }), (m:Medicine { medicineId: "MED05" }) MERGE (d)-[:PRESCRIBED { dosage: "650mg", date: "2026-09-11" }]->(m);
MATCH (p:Patient { patientId: "P102" }), (m:Medicine { medicineId: "MED05" }) MERGE (p)-[:TAKES]->(m);
MATCH (p:Patient { patientId: "P103" }), (d:Doctor { doctorId: "D102" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (d:Doctor { doctorId: "D102" }), (m:Medicine { medicineId: "MED01" }) MERGE (d)-[:PRESCRIBED { dosage: "5mg", date: "2026-09-12" }]->(m);
MATCH (p:Patient { patientId: "P103" }), (m:Medicine { medicineId: "MED01" }) MERGE (p)-[:TAKES]->(m);
MATCH (d:Doctor { doctorId: "D102" }), (m:Medicine { medicineId: "MED02" }) MERGE (d)-[:PRESCRIBED { dosage: "20mg", date: "2026-09-12" }]->(m);
MATCH (p:Patient { patientId: "P103" }), (m:Medicine { medicineId: "MED02" }) MERGE (p)-[:TAKES]->(m);
MATCH (p:Patient { patientId: "P104" }), (d:Doctor { doctorId: "D105" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (d:Doctor { doctorId: "D105" }), (m:Medicine { medicineId: "MED03" }) MERGE (d)-[:PRESCRIBED { dosage: "500mg", date: "2026-09-14" }]->(m);
MATCH (p:Patient { patientId: "P104" }), (m:Medicine { medicineId: "MED03" }) MERGE (p)-[:TAKES]->(m);
MATCH (p:Patient { patientId: "P105" }), (d:Doctor { doctorId: "D104" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (d:Doctor { doctorId: "D104" }), (m:Medicine { medicineId: "MED06" }) MERGE (d)-[:PRESCRIBED { dosage: "500mg", date: "2026-09-15" }]->(m);
MATCH (p:Patient { patientId: "P105" }), (m:Medicine { medicineId: "MED06" }) MERGE (p)-[:TAKES]->(m);
MATCH (d:Doctor { doctorId: "D104" }), (m:Medicine { medicineId: "MED07" }) MERGE (d)-[:PRESCRIBED { dosage: "100mg", date: "2026-09-15" }]->(m);
MATCH (p:Patient { patientId: "P105" }), (m:Medicine { medicineId: "MED07" }) MERGE (p)-[:TAKES]->(m);
MATCH (p:Patient { patientId: "P106" }), (d:Doctor { doctorId: "D104" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (d:Doctor { doctorId: "D104" }), (m:Medicine { medicineId: "MED07" }) MERGE (d)-[:PRESCRIBED { dosage: "100mg", date: "2026-09-18" }]->(m);
MATCH (p:Patient { patientId: "P106" }), (m:Medicine { medicineId: "MED07" }) MERGE (p)-[:TAKES]->(m);
MATCH (d:Doctor { doctorId: "D104" }), (m:Medicine { medicineId: "MED09" }) MERGE (d)-[:PRESCRIBED { dosage: "40mg", date: "2026-09-18" }]->(m);
MATCH (p:Patient { patientId: "P106" }), (m:Medicine { medicineId: "MED09" }) MERGE (p)-[:TAKES]->(m);
MATCH (p:Patient { patientId: "P107" }), (d:Doctor { doctorId: "D105" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (d:Doctor { doctorId: "D105" }), (m:Medicine { medicineId: "MED08" }) MERGE (d)-[:PRESCRIBED { dosage: "10mg", date: "2026-09-20" }]->(m);
MATCH (p:Patient { patientId: "P107" }), (m:Medicine { medicineId: "MED08" }) MERGE (p)-[:TAKES]->(m);
MATCH (p:Patient { patientId: "P108" }), (d:Doctor { doctorId: "D105" }) MERGE (p)-[:TREATED_BY]->(d);
MATCH (d:Doctor { doctorId: "D105" }), (m:Medicine { medicineId: "MED09" }) MERGE (d)-[:PRESCRIBED { dosage: "40mg", date: "2026-09-22" }]->(m);
MATCH (p:Patient { patientId: "P108" }), (m:Medicine { medicineId: "MED09" }) MERGE (p)-[:TAKES]->(m);
