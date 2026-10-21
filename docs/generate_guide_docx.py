import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._element.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._element.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_guide_docx(output_path):
    doc = Document()
    
    # Page setup - 1 inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Styles
    PRIMARY = RGBColor(15, 76, 129)     # Deep Blue
    SECONDARY = RGBColor(70, 80, 95)    # Slate Gray
    ACCENT = RGBColor(220, 38, 38)      # Crimson Red
    DARK = RGBColor(30, 41, 59)         # Dark Charcoal

    # Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(4)
    run_title = p_title.add_run("PROJECT EXPLANATION & DEFENSE GUIDE")
    run_title.font.name = 'Calibri'
    run_title.font.size = Pt(24)
    run_title.font.bold = True
    run_title.font.color.rgb = PRIMARY

    # Subtitle
    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(8)
    run_sub = p_sub.add_run("Patient-Conditioned Drug-Interaction Risk Prediction with Relational Graph Neural Networks and Cold-Start Generalization, Deployed as a Prescription-Time Check in a Hospital Information System")
    run_sub.font.name = 'Calibri'
    run_sub.font.size = Pt(12)
    run_sub.font.italic = True
    run_sub.font.color.rgb = SECONDARY

    # Authors
    p_auth = doc.add_paragraph()
    p_auth.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_auth.paragraph_format.space_after = Pt(20)
    run_auth = p_auth.add_run("Authors: Yash Khose (23BCE0625) & Tanish Chawla (23BCE0502)\nSchool of Computer Science and Engineering, Vellore Institute of Technology, Chennai")
    run_auth.font.name = 'Calibri'
    run_auth.font.size = Pt(11)
    run_auth.font.bold = True
    run_auth.font.color.rgb = DARK

    # Helper function for Section Headings
    def add_heading(text, level=1):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = 'Calibri'
        if level == 1:
            run.font.size = Pt(16)
            run.font.bold = True
            run.font.color.rgb = PRIMARY
        elif level == 2:
            run.font.size = Pt(13)
            run.font.bold = True
            run.font.color.rgb = SECONDARY
        return p

    def add_callout(text, title="KEY TAKEAWAY", bg_hex="F0F4F8", border_rgb=PRIMARY):
        table = doc.add_table(rows=1, cols=1)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = table.cell(0, 0)
        set_cell_background(cell, bg_hex)
        set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        r_title = p.add_run(f"[{title}] ")
        r_title.bold = True
        r_title.font.name = 'Calibri'
        r_title.font.size = Pt(10.5)
        r_title.font.color.rgb = border_rgb
        r_text = p.add_run(text)
        r_text.font.name = 'Calibri'
        r_text.font.size = Pt(10.5)
        r_text.font.color.rgb = DARK
        doc.add_paragraph().paragraph_format.space_after = Pt(6)

    def add_p(text, bold_prefix="", space_after=6):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.bold = True
            r_pre.font.name = 'Calibri'
            r_pre.font.size = Pt(11)
            r_pre.font.color.rgb = DARK
        r = p.add_run(text)
        r.font.name = 'Calibri'
        r.font.size = Pt(11)
        r.font.color.rgb = DARK
        return p

    # --- SECTION 1 ---
    add_heading("1. Executive Summary & The Problem in Plain English")
    add_p("In clinical medicine, Adverse Drug Events (ADEs) and Drug-Drug Interactions (DDIs) are responsible for over 30% of acute hospital admissions. Every year, millions of preventable complications occur because two medications interfere with each other.")
    add_p("However, existing hospital software uses naive, static lookup tables (e.g., 'Drug A + Drug B = Bad'). These tables suffer from two fatal clinical flaws:", "The Big Problem: ")
    add_p("A pair of drugs might be completely harmless for a young 22-year-old athlete with a headache, but fatal for a 68-year-old patient with Stage 3 Chronic Kidney Disease. Traditional checkers treat all patients identically.", "1. They ignore patient physiological context: ")
    add_p("Over 4,000 new drug formulations, generic equivalents, and molecular variants enter the global market every year. When an unrecognized drug is typed into a static database, it returns 'No interactions found', giving physicians false reassurance.", "2. The Cold-Start failure: ")

    add_callout(
        "Our project solves both problems: We developed a Patient-Conditioned Relational Graph Neural Network (RGCN) that predicts interaction severity conditioned on the patient's individual diagnoses and concurrent regimen, generalises to brand-new (cold-start) drugs, and runs inside a real Hospital Information System in sub-10 milliseconds.",
        "THE INNOVATION"
    )

    # --- SECTION 2 ---
    add_heading("2. Full-Stack System Architecture (Layer by Layer)")
    add_p("The project is engineered as an enterprise-grade polyglot microservice system comprising three interoperating tiers:")

    # Table of Architecture
    table = doc.add_table(rows=5, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["Layer", "Technologies", "Role & Responsibilities"]
    for i, h in enumerate(headers):
        cell = table.cell(0, i)
        set_cell_background(cell, "0F4C81")
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.name = 'Calibri'
        r.font.size = Pt(10.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    data = [
        ("Presentation Layer\n(Port 5000 / Web)", "React 18, Vite, Lucide Icons, Modern Responsive CSS", "Clinical user interface for Doctors, Patients, Appointments, Prescriptions, Live Graph Visualization, and Interactive DDI Alert Panel."),
        ("Application Backend\n(Port 5000)", "Node.js, Express.js REST API", "Business logic, polyglot database dispatch, non-blocking asynchronous call to ML microservice, input validation, and disk persistence."),
        ("Polyglot Data Stores", "MongoDB (Document) +\nNeo4j (Graph) +\nLocalStore JSON (Disk)", "MongoDB stores structured EHR documents (patients, prescriptions). Neo4j maps multi-hop biomedical entities and relationships. LocalStore ensures zero data loss offline."),
        ("AI / ML Microservice\n(Port 8000)", "FastAPI, PyTorch, PyTorch Geometric, Uvicorn", "Hosts trained Relational Graph Neural Network, Condition Gating Layer, Temperature Calibration engine (T=2.10), and biological explanation generator (7.57 ms latency).")
    ]

    for row_idx, row_data in enumerate(data, start=1):
        bg = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, text in enumerate(row_data):
            cell = table.cell(row_idx, col_idx)
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.name = 'Calibri'
            r.font.size = Pt(10)
            r.font.color.rgb = DARK

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # --- SECTION 3 ---
    add_heading("3. Why Polyglot Persistence? (MongoDB vs. Neo4j)")
    add_p("A frequent evaluator question is: 'Why did you use two databases instead of just one?' The answer lies in data shape optimization:")
    add_p("Clinical records (e.g. Patient medical history, structured prescriptions with dosage, frequency, date) are hierarchical documents. MongoDB stores them naturally as JSON/BSON documents with atomic ACID compliance at document level and rapid indexed queries.", "MongoDB (Document Store): ")
    add_p("Biomedical knowledge is inherently relational and multi-hop. To ask: 'Which patients treated by Dr. Sharma take a drug that interacts with an ACE inhibitor for hypertension?' requires 5 SQL joins. In Neo4j, Cypher traverses this graph in O(1) pointer-chasing time through native index-free adjacency.", "Neo4j (Graph Database): ")
    add_p("If the hospital or evaluator laptop does not have MongoDB or Neo4j server daemons running, localStore.js seamlessly persists every entity to disk in server/data/store.json with zero downtime, ensuring the software works anywhere, anytime.", "LocalStore.js (Disk Fallback): ")

    # --- SECTION 4 ---
    add_heading("4. Machine Learning & Graph Neural Network Deep-Dive")
    add_p("Our ML pipeline introduces four rigorous technical advancements beyond standard literature:")

    add_heading("A. Relational Graph Convolutional Network (RGCN)", level=2)
    add_p("Standard GCNs treat all edges equally. But biological relationships have distinct semantic types (e.g., TARGETS, ENZYMATIC_METABOLISM, PATHWAY_INHIBITION). RGCN uses relation-specific projection matrices W_r to aggregate relational neighborhood information across the drug knowledge graph.")

    add_heading("B. Patient Condition Gating Mechanism", level=2)
    add_p("Instead of computing risk solely between Drug A and Drug B, our model applies a cross-attention gating layer over the patient's active clinical conditions (e.g., Chronic Kidney Disease, Diabetes, Hypertension). If the patient possesses renal impairment, the attention weight for nephrotoxic pathways automatically amplifies the risk score.")

    add_heading("C. Cold-Start Generalization (Inductive Evaluation)", level=2)
    add_p("We evaluated across three strict data splits:", "Three Evaluation Regimes: ")
    add_p("Both interacting drugs were present in the training graph (Transductive setting). AUROC: 0.965, AUPRC: 0.964.", "1. Split S1 (Known-to-Known): ")
    add_p("One drug is completely unseen/novel, representing a newly FDA-approved medication. Evaluates molecular inductive transfer.", "2. Split S2 (Novel-to-Known): ")
    add_p("Both drugs are novel compounds simultaneously (the hardest clinical cold-start scenario).", "3. Split S3 (Novel-to-Novel): ")

    add_heading("D. Temperature Scaling Probability Calibration (T = 2.10)", level=2)
    add_p("Raw deep neural networks produce overconfident probabilities (e.g., predicting 0.99 risk when empirical frequency is only 0.70). In a hospital setting, uncalibrated alerts cause 'alert fatigue', where doctors dismiss genuine warnings. We calibrated output logits using Platt / Temperature Scaling with an optimal learned temperature of T = 2.10, cutting Expected Calibration Error (ECE) from 0.218 down to 0.1059 (a 51.4% improvement!).")

    # --- SECTION 5 ---
    add_heading("5. Step-by-Step Live Demo Walkthrough (For Presentation)")
    add_p("Follow this exact step-by-step sequence during your project demonstration:")

    steps = [
        ("Step 1: Open the Hospital Dashboard", "Navigate to http://localhost:5000. Point out the real-time statistics cards (Total Patients, Doctors, Appointments, Knowledge Graph Nodes) and modern clinical layout."),
        ("Step 2: Show MongoDB Document Persistence", "Navigate to Patients. Click '+ Add Patient'. Show that Patient ID auto-increments (e.g. P112) but remains editable. Register a test patient with 'Chronic Kidney Disease'. Demonstrate that upon page refresh or server restart, data remains 100% saved on disk."),
        ("Step 3: Show Doctor & Neo4j Relationships", "Navigate to Doctors. Show doctors with specializations and department affiliations (Interventional Cardiology, Nephrology). Show how appointments link patients to doctors in Neo4j graph relationships."),
        ("Step 4: Demonstrate the Flagship DDI Alert (The 'Showstopper')", "Go to Prescriptions. Click '+ New Prescription'.\n• Notice Prescription ID auto-fills (e.g. RX109).\n• Select Patient P111 (or any patient with Chronic Kidney Disease).\n• Select candidate medicine: Ibuprofen 400mg (NSAID).\n• Observe the live CRITICAL Risk Alert (98%) generated in 7.57 ms!"),
        ("Step 5: Explain the Physiological Mechanism", "Point to the biological explanation displayed in the UI: 'Elevated nephrotoxic risk: ACEI efferent arteriolar vasodilation compounded by NSAID afferent vasoconstriction in patient with renal impairment.'\nShow the Attention Weights: Chronic Kidney Disease: 0.585, Lisinopril: 0.415."),
        ("Step 6: Show the Contrast (Safe Prescription)", "Change the medicine to Paracetamol 650mg or Amoxicillin 500mg. The alert instantly switches to LOW / GREEN. This proves the system is dynamic, context-aware, and not just a hardcoded warning.")
    ]

    for title, desc in steps:
        add_p(desc, f"{title}: ")

    # --- SECTION 6 ---
    add_heading("6. Top 15 Teacher / External Evaluator Viva Q&A Cheat Sheet")
    add_p("Here are the exact answers to the 15 toughest questions an evaluator or professor can ask:")

    qa_list = [
        ("Q1: What is the novel contribution of your project compared to existing DDI tools?",
         "Existing systems use static lookup matrices between two drugs and ignore the patient. Our model conditions the prediction on the patient's individual electronic health record (diagnoses and current medications) using a Relational Graph Neural Network with cross-attention gating, and can predict interactions for brand-new cold-start drugs."),
        
        ("Q2: Why do you need both MongoDB and Neo4j? Isn't MongoDB enough?",
         "They serve fundamentally different data paradigms. MongoDB is an aggregate-oriented document store optimal for hierarchical patient records, billing, and prescriptions. Neo4j is a graph database with index-free adjacency optimal for multi-hop graph traversals across diseases, doctors, drugs, and physiological pathways without expensive SQL joins."),
        
        ("Q3: What happens if the Neo4j or MongoDB server crashes or is offline?",
         "The system implements graceful degradation with localStore.js. Every mutation is atomically synchronized to disk (server/data/store.json). Read and write operations fall back automatically, ensuring 100% clinical uptime even during database outages."),
        
        ("Q4: Why did you choose Relational GCN (RGCN) over standard GCN or GraphSAGE?",
         "Standard GCNs assume all edges are homogeneous (identical type). In pharmacology, relationships are heterogeneous—a drug 'INHIBITS' an enzyme, 'TREATS' a disease, or 'TARGETS' a receptor. RGCN incorporates relation-specific transformations W_r, preventing semantic information loss."),
        
        ("Q5: What is 'Cold-Start' in the context of pharmacology?",
         "When a pharmaceutical company releases a brand-new drug, it has no existing interaction history in the graph. In Split S2 and S3, our model uses molecular Morgan fingerprints and physicochemical embeddings to generalize to novel drugs without retraining."),
        
        ("Q6: What is Temperature Scaling and why is calibration critical in medical AI?",
         "Modern neural networks are prone to high confidence errors. A model predicting 99% probability when true empirical accuracy is only 70% creates alert fatigue for doctors. Temperature Scaling divides unnormalized logits by T=2.10, maintaining ROC-AUC ranking while aligning probabilities with true empirical risk (ECE reduced by 51.4%)."),
        
        ("Q7: How fast is your ML inference and does it satisfy hospital SLAs?",
         "Our FastAPI microservice executes end-to-end forward pass inference in 7.57 milliseconds. Hospital clinical decision support SLAs require sub-50ms responses to prevent doctor typing lag. We easily exceed this standard."),
        
        ("Q8: How does the frontend communicate with the ML model?",
         "When a doctor selects a candidate drug in the Prescription modal, the React frontend fires an asynchronous HTTP request to the Express backend (/api/risk/check), which queries the FastAPI PyTorch microservice (http://localhost:8000/score). If the ML microservice is unreachable, the HIS displays a graceful notice without blocking prescription entry."),
        
        ("Q9: What dataset was used to train and benchmark the models?",
         "We trained and evaluated on benchmark clinical interaction datasets including DrugBank, ogbl-ddi, and a 10,000-patient synthetic longitudinal clinical cohort modeled after MIMIC-IV clinical profiles."),
        
        ("Q10: Explain the clinical case study of Ibuprofen and Lisinopril.",
         "Lisinopril is an ACE inhibitor that dilates the efferent arteriole in the kidney. Ibuprofen is an NSAID that inhibits prostaglandins, constricting the afferent arteriole. When combined in a patient with Chronic Kidney Disease, blood flow through the glomerulus collapses, inducing Acute Renal Failure. Our model identifies this physiological synergy with a 0.98 critical alert."),
        
        ("Q11: What are your key evaluation metrics?",
         "We report Area Under the ROC Curve (AUROC), Area Under the Precision-Recall Curve (AUPRC), Hits@20, Hits@50, and Expected Calibration Error (ECE) across 5 independent random seeds."),
        
        ("Q12: How does the attention mechanism provide interpretability?",
         "The gating layer assigns attention weights summing to 1.0 across the patient's conditions and existing medications. When prescribing Ibuprofen, it outputs CKD: 0.585 and Lisinopril: 0.415, showing doctors exactly which factor triggered the warning."),
        
        ("Q13: How is data security and HIPAA compliance addressed?",
         "The architecture separates clinical document storage (MongoDB with role-based access) from inference. Patient identifiers are anonymized prior to feature extraction in the ML microservice."),
        
        ("Q14: Can doctors override the alert if they deem it clinically necessary?",
         "Yes. Clinical decision support systems are advisory, not prescriptive. Doctors can acknowledge the warning and proceed with prescription entry, which is logged for audit compliance."),
        
        ("Q15: What are future research directions for this project?",
         "Integrating genomic biomarkers (pharmacogenomics e.g. CYP2D6 metabolizer status), expanding multi-drug polynomial interactions beyond pairwise combinations, and federated learning across multi-hospital networks.")
    ]

    for q, a in qa_list:
        add_p(a, f"{q}\nAnswer: ", space_after=8)

    # Save
    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")

if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_file = os.path.join(out_dir, "PROJECT_EXPLANATION_GUIDE.docx")
    create_guide_docx(out_file)
