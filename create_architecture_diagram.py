import os
from PIL import Image, ImageDraw, ImageFont

def create_architecture_diagram(output_path):
    width = 1200
    height = 840
    
    img = Image.new("RGB", (width, height), "#F8FAFC")
    draw = ImageDraw.Draw(img)
    
    try:
        font_main_title = ImageFont.truetype("arialbd.ttf", 22)
        font_tier = ImageFont.truetype("arialbd.ttf", 15)
        font_sub = ImageFont.truetype("arialbd.ttf", 13)
        font_body = ImageFont.truetype("arial.ttf", 12)
        font_arrow = ImageFont.truetype("arialbd.ttf", 11)
        font_caption = ImageFont.truetype("ariali.ttf", 11)
        font_badge = ImageFont.truetype("arialbd.ttf", 11)
    except:
        font_main_title = ImageFont.load_default()
        font_tier = font_main_title
        font_sub = font_main_title
        font_body = font_main_title
        font_arrow = font_main_title
        font_caption = font_main_title
        font_badge = font_main_title

    # Header Title Banner
    draw.rectangle([(0, 0), (width, 65)], fill="#0F172A")
    draw.text((30, 20), "SMART HOSPITAL INFORMATION SYSTEM — SYSTEM ARCHITECTURE", fill="#38BDF8", font=font_main_title)
    draw.text((930, 24), "POLYGLOT PERSISTENCE", fill="#94A3B8", font=font_sub)

    # 1. TIER 1: CLIENT TIER (React)
    x1, y1, x2, y2 = 80, 95, 1120, 245
    draw.rounded_rectangle([x1, y1, x2, y2], radius=10, fill="#FFFFFF", outline="#CBD5E1", width=2)
    draw.rounded_rectangle([x1, y1, x2, y1 + 38], radius=8, fill="#0284C7")
    draw.text((x1 + 16, y1 + 10), "CLIENT TIER: REACT.JS 18 USER INTERFACE (SPA)", fill="#FFFFFF", font=font_tier)
    draw.text((x2 - 320, y1 + 12), "[ Port 5173 Dev / Port 5000 Prod ]", fill="#E0F2FE", font=font_badge)

    client_items = [
        "• Executive Dashboard: Aggregated count metrics (Patients, Doctors, Departments, Appointments, Prescriptions).",
        "• Patient & Doctor Management: Tabular directory, demographic search, modal editors, and full CRUD workflows.",
        "• Appointments & Prescriptions: Scheduling management and medication orders with embedded dosages.",
        "• Interactive Neo4j Graph Explorer: Patient-centric subgraph traversals, multi-hop relationship inspection, and Cypher logs."
    ]
    cur_y = y1 + 50
    for itm in client_items:
        draw.text((x1 + 20, cur_y), itm, fill="#334155", font=font_body)
        cur_y += 24

    # Arrow 1: Client -> Backend
    draw.line([(600, 245), (600, 290)], fill="#0284C7", width=3)
    draw.polygon([(594, 290), (606, 290), (600, 300)], fill="#0284C7")
    draw.rounded_rectangle([(420, 258), (780, 286)], radius=6, fill="#E0F2FE", outline="#0284C7", width=1)
    draw.text((438, 265), "HTTP REST APIs / JSON Payloads (Port 5000)", fill="#0369A1", font=font_arrow)

    # 2. TIER 2: APPLICATION / BACKEND TIER (Node.js & Express.js)
    x1, y1, x2, y2 = 80, 300, 1120, 480
    draw.rounded_rectangle([x1, y1, x2, y2], radius=10, fill="#FFFFFF", outline="#CBD5E1", width=2)
    draw.rounded_rectangle([x1, y1, x2, y1 + 38], radius=8, fill="#0F172A")
    draw.text((x1 + 16, y1 + 10), "APPLICATION TIER: NODE.JS & EXPRESS.JS REST API ENGINE", fill="#FFFFFF", font=font_tier)
    draw.text((x2 - 280, y1 + 12), "[ Layered Architecture: server/src ]", fill="#94A3B8", font=font_badge)

    backend_items = [
        "• Request Validators: Strict schema validation, regex email formats, valid age ranges (0-130), and ID verification.",
        "• REST Controllers: Modular controllers for Patients, Doctors, Departments, Appointments, Prescriptions, and Graph.",
        "• Polyglot Orchestration Layer: Dual-write handlers ensuring atomic document updates and Neo4j graph edge creation.",
        "• Centralized Error Middleware: Intercepts Mongoose unique index violations (code 11000) -> returns clean 409 Conflict.",
        "• Database Drivers: Mongoose ODM (v8.9) with connection pooling & Neo4j official Bolt driver (v5.28)."
    ]
    cur_y = y1 + 48
    for itm in backend_items:
        draw.text((x1 + 20, cur_y), itm, fill="#334155", font=font_body)
        cur_y += 24

    # Arrow 2: Backend -> MongoDB (Left)
    draw.line([(340, 480), (340, 535)], fill="#10B981", width=3)
    draw.polygon([(334, 535), (346, 535), (340, 545)], fill="#10B981")
    draw.rounded_rectangle([(210, 498), (470, 526)], radius=6, fill="#DCFCE7", outline="#10B981", width=1)
    draw.text((226, 505), "Mongoose ODM (Port 27017)", fill="#166534", font=font_arrow)

    # Arrow 3: Backend -> Neo4j (Right)
    draw.line([(860, 480), (860, 535)], fill="#8B5CF6", width=3)
    draw.polygon([(854, 535), (866, 535), (860, 545)], fill="#8B5CF6")
    draw.rounded_rectangle([(710, 498), (1010, 526)], radius=6, fill="#EDE9FE", outline="#8B5CF6", width=1)
    draw.text((725, 505), "Bolt Protocol (Port 7687) / Cypher", fill="#5B21B6", font=font_arrow)

    # 3. TIER 3: DUAL PERSISTENCE TIER
    # 3A. MongoDB (Document Model)
    x1, y1, x2, y2 = 80, 545, 580, 785
    draw.rounded_rectangle([x1, y1, x2, y2], radius=10, fill="#F0FDF4", outline="#86EFAC", width=2)
    draw.rounded_rectangle([x1, y1, x2, y1 + 38], radius=8, fill="#10B981")
    draw.text((x1 + 16, y1 + 10), "MONGODB DOCUMENT STORE", fill="#FFFFFF", font=font_tier)
    draw.text((x2 - 190, y1 + 12), "[ DB: smart_hospital ]", fill="#DCFCE7", font=font_badge)

    mongo_items = [
        "• 7 Collections: patients, doctors, departments,",
        "  appointments, prescriptions, diseases, medicines.",
        "• Embedded Documents: Medical history subdocuments &",
        "  prescription items with dosage, frequency, and duration.",
        "• Referenced Documents: Appointments reference patientId",
        "  and doctorId; doctors reference departmentId.",
        "• Indexes: Unique & secondary indexes on patientId, email,",
        "  doctorId, departmentId, appointmentId, and date."
    ]
    cur_y = y1 + 48
    for itm in mongo_items:
        draw.text((x1 + 16, cur_y), itm, fill="#1F2937", font=font_body)
        cur_y += 22

    # 3B. Neo4j (Native Graph Model)
    x1, y1, x2, y2 = 620, 545, 1120, 785
    draw.rounded_rectangle([x1, y1, x2, y2], radius=10, fill="#F5F3FF", outline="#C4B5FD", width=2)
    draw.rounded_rectangle([x1, y1, x2, y1 + 38], radius=8, fill="#8B5CF6")
    draw.text((x1 + 16, y1 + 10), "NEO4J NATIVE GRAPH DATABASE", fill="#FFFFFF", font=font_tier)
    draw.text((x2 - 200, y1 + 12), "[ Bolt / Cypher Engine ]", fill="#EDE9FE", font=font_badge)

    neo_items = [
        "• 5 Node Labels: (:Patient), (:Doctor), (:Department),",
        "  (:Disease), and (:Medicine).",
        "• 6 Directed Relationships:",
        "  - (:Patient)-[:TREATED_BY]->(:Doctor)",
        "  - (:Doctor)-[:BELONGS_TO]->(:Department)",
        "  - (:Patient)-[:DIAGNOSED_WITH]->(:Disease)",
        "  - (:Doctor)-[:TREATS]->(:Disease)",
        "  - (:Doctor)-[:PRESCRIBED]->(:Medicine)",
        "  - (:Patient)-[:TAKES]->(:Medicine)"
    ]
    cur_y = y1 + 48
    for itm in neo_items:
        draw.text((x1 + 16, cur_y), itm, fill="#1F2937", font=font_body)
        cur_y += 22

    # Bottom caption
    draw.text((360, 805), "Figure 2.1: Polyglot Persistence Architecture of the Smart Hospital Information System", fill="#64748B", font=font_caption)

    # Save to outputs
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    img.save(output_path, "PNG")
    print(f"Generated clean architecture diagram at {output_path}")

if __name__ == '__main__':
    create_architecture_diagram("assets/architecture_diagram.png")
    create_architecture_diagram("review2_submission/architecture_diagram.png")
