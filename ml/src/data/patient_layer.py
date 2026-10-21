"""
Patient layer construction, Synthea cohort generation, ingredient normalization,
and patient-context graph builder.
Supports:
- Task A: Real pairwise DDI (patient-agnostic benchmark)
- Task B: Controlled simulation with physiological context rules (Clearly marked SYNTHETIC)
- Task C: MIMIC-IV loader skeleton (flagged with use_mimic: false and PhysioNet DUA note)
"""

import os
import re
import yaml
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any, Optional
import numpy as np
import pandas as pd
import torch

from ml.src.utils import get_logger, ML_ROOT, DATA_DIR

logger = get_logger("PatientLayer")
SYNTHEA_DIR = DATA_DIR / "synthea"
CONFIGS_DIR = ML_ROOT / "configs"


# ====================================================================
# 1. Synthea 10k Cohort Generation
# ====================================================================

def generate_synthea_cohort(
    output_dir: Optional[Path] = None,
    num_patients: int = 10000,
    seed: int = 42
) -> Dict[str, Path]:
    """
    Generate a 10,000-patient synthetic clinical cohort matching Synthea's exact CSV schemas:
    patients.csv, conditions.csv, medications.csv, encounters.csv.
    """
    output_dir = output_dir or SYNTHEA_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)

    logger.info(f"Generating deterministic {num_patients}-patient Synthea cohort (seed={seed})...")

    # 1. Patients
    patient_ids = [f"SYN_{i:06d}" for i in range(num_patients)]
    genders = rng.choice(["M", "F"], size=num_patients, p=[0.49, 0.51])
    birth_years = rng.integers(1940, 2010, size=num_patients)
    races = rng.choice(["white", "black", "asian", "other"], size=num_patients, p=[0.70, 0.15, 0.10, 0.05])

    df_patients = pd.DataFrame({
        "Id": patient_ids,
        "BIRTHDATE": [f"{y}-05-15" for y in birth_years],
        "GENDER": genders,
        "RACE": races
    })
    patients_csv = output_dir / "patients.csv"
    df_patients.to_csv(patients_csv, index=False)

    # Common chronic conditions
    condition_pool = [
        ("38341003", "Essential hypertension"),
        ("44054006", "Type 2 diabetes mellitus"),
        ("709044004", "Chronic kidney disease stage 3"),
        ("49436004", "Atrial fibrillation"),
        ("195967001", "Asthma"),
        ("13645005", "Chronic obstructive pulmonary disease"),
        ("84114007", "Heart failure"),
        ("55822004", "Hyperlipidemia"),
        ("39848009", "Peptic ulcer disease"),
        ("370143000", "Major depressive disorder"),
        ("399211009", "History of gastrointestinal hemorrhage"),
        ("49601007", "Cardiac arrhythmia")
    ]

    # Common clinical medications with dosage forms
    medication_pool = [
        ("311621", "Lisinopril 10 MG Oral Tablet"),
        ("860975", "Metformin hydrochloride 500 MG Oral Tablet"),
        ("259255", "Atorvastatin 20 MG Oral Tablet"),
        ("5640", "Ibuprofen 400 MG Oral Tablet"),
        ("314231", "Amlodipine 5 MG Oral Tablet"),
        ("855332", "Warfarin sodium 5 MG Oral Tablet"),
        ("313988", "Furosemide 40 MG Oral Tablet"),
        ("312292", "Omeprazole 20 MG Oral Delayed Release Capsule"),
        ("310798", "Ciprofloxacin 500 MG Oral Tablet"),
        ("312961", "Sertraline 50 MG Oral Tablet"),
        ("245314", "Albuterol 0.09 MG/ACTUAT Inhalation Aerosol"),
        ("197361", "Aspirin 81 MG Oral Tablet"),
        ("198013", "Naproxen 500 MG Oral Tablet"),
        ("312615", "Prednisone 20 MG Oral Tablet"),
        ("310429", "Metoprolol succinate 50 MG Oral Tablet"),
        ("312935", "Spironolactone 25 MG Oral Tablet")
    ]

    # 2. Conditions
    condition_rows = []
    # 3. Medications
    medication_rows = []
    # 4. Encounters
    encounter_rows = []

    for idx, p_id in enumerate(patient_ids):
        # Assign 1 to 4 conditions
        n_cond = rng.integers(1, 5)
        chosen_conds = rng.choice(len(condition_pool), size=min(n_cond, len(condition_pool)), replace=False)
        for c_idx in chosen_conds:
            c_code, c_desc = condition_pool[c_idx]
            condition_rows.append({"PATIENT": p_id, "CODE": c_code, "DESCRIPTION": c_desc})

        # Assign 1 to 5 active medications
        n_meds = rng.integers(1, 6)
        chosen_meds = rng.choice(len(medication_pool), size=min(n_meds, len(medication_pool)), replace=False)
        for m_idx in chosen_meds:
            m_code, m_desc = medication_pool[m_idx]
            medication_rows.append({"PATIENT": p_id, "CODE": m_code, "DESCRIPTION": m_desc})

        # 1-2 Encounters
        n_enc = rng.integers(1, 3)
        for e in range(n_enc):
            encounter_rows.append({
                "Id": f"ENC_{idx}_{e}",
                "PATIENT": p_id,
                "CODE": "185349003",
                "REASONDESCRIPTION": condition_pool[chosen_conds[0]][1]
            })

    df_conditions = pd.DataFrame(condition_rows)
    df_medications = pd.DataFrame(medication_rows)
    df_encounters = pd.DataFrame(encounter_rows)

    conditions_csv = output_dir / "conditions.csv"
    medications_csv = output_dir / "medications.csv"
    encounters_csv = output_dir / "encounters.csv"

    df_conditions.to_csv(conditions_csv, index=False)
    df_medications.to_csv(medications_csv, index=False)
    df_encounters.to_csv(encounters_csv, index=False)

    logger.info(
        f"Synthea cohort generated: {len(df_patients)} patients, "
        f"{len(df_conditions)} condition instances, {len(df_medications)} medication instances."
    )

    return {
        "patients": patients_csv,
        "conditions": conditions_csv,
        "medications": medications_csv,
        "encounters": encounters_csv
    }


# ====================================================================
# 2. Ingredient Normalization & DrugBank Vocabulary Mapping
# ====================================================================

BRAND_AND_SYNONYM_MAP: Dict[str, str] = {
    # Paracetamol / Acetaminophen (DB00316)
    "dolo": "acetaminophen",
    "dolo 650": "acetaminophen",
    "dolo650": "acetaminophen",
    "crocin": "acetaminophen",
    "calpol": "acetaminophen",
    "tylenol": "acetaminophen",
    "panadol": "acetaminophen",
    "pacimol": "acetaminophen",
    "metacin": "acetaminophen",
    "sumo": "acetaminophen",
    "pcm": "acetaminophen",
    "paracetamol": "acetaminophen",
    "acetaminophen": "acetaminophen",
    # NSAIDs
    "brufen": "ibuprofen",
    "advil": "ibuprofen",
    "motrin": "ibuprofen",
    "combiflam": "ibuprofen",
    "ibugesic": "ibuprofen",
    "voveran": "diclofenac",
    "voltaren": "diclofenac",
    "dynapar": "diclofenac",
    "zerodol": "aceclofenac",
    "hifenac": "aceclofenac",
    "naprosyn": "naproxen",
    "aleve": "naproxen",
    "ketorol": "ketorolac",
    "toradol": "ketorolac",
    "cobix": "celecoxib",
    "celebrex": "celecoxib",
    "indocap": "indomethacin",
    # Antiplatelets / Anticoagulants
    "ecosprin": "aspirin",
    "disprin": "aspirin",
    "loprin": "aspirin",
    "acitrom": "warfarin",
    "coumadin": "warfarin",
    "uniwarfin": "warfarin",
    "eliquis": "apixaban",
    "xarelto": "rivaroxaban",
    "plavix": "clopidogrel",
    "clopilet": "clopidogrel",
    "deplatt": "clopidogrel",
    # PPIs / GI
    "pan": "pantoprazole",
    "pantocid": "pantoprazole",
    "pantop": "pantoprazole",
    "protonix": "pantoprazole",
    "omez": "omeprazole",
    "prilosec": "omeprazole",
    "rantac": "ranitidine",
    "zinetac": "ranitidine",
    "emeset": "ondansetron",
    "zofran": "ondansetron",
    # Antibiotics
    "augmentin": "amoxicillin",
    "mox": "amoxicillin",
    "novamox": "amoxicillin",
    "amoxil": "amoxicillin",
    "azithral": "azithromycin",
    "azee": "azithromycin",
    "zithromax": "azithromycin",
    "ciplox": "ciprofloxacin",
    "cifran": "ciprofloxacin",
    "cipro": "ciprofloxacin",
    "levaquin": "levofloxacin",
    "levomac": "levofloxacin",
    "flagyl": "metronidazole",
    "metrogyl": "metronidazole",
    # Antidiabetics
    "glycomet": "metformin",
    "glucophage": "metformin",
    "obimet": "metformin",
    "amaryl": "glimepiride",
    "glimy": "glimepiride",
    "glucotrol": "glipizide",
    # Antihypertensives & Cardiac
    "telma": "telmisartan",
    "telsartan": "telmisartan",
    "micardis": "telmisartan",
    "stamlo": "amlodipine",
    "amlong": "amlodipine",
    "norvasc": "amlodipine",
    "zestril": "lisinopril",
    "prinivil": "lisinopril",
    "lipril": "lisinopril",
    "losar": "losartan",
    "cozaar": "losartan",
    "cardace": "ramipril",
    "altace": "ramipril",
    "vasotec": "enalapril",
    "envas": "enalapril",
    "betaloc": "metoprolol",
    "metolar": "metoprolol",
    "lopressor": "metoprolol",
    "tenormin": "atenolol",
    "inderal": "propranolol",
    "ciplar": "propranolol",
    "cardivas": "carvedilol",
    "calaptin": "verapamil",
    "dilzem": "diltiazem",
    "cordarone": "amiodarone",
    "lanoxin": "digoxin",
    # Statins
    "lipitor": "atorvastatin",
    "atorva": "atorvastatin",
    "tonact": "atorvastatin",
    "crestor": "rosuvastatin",
    "rosuvas": "rosuvastatin",
    "zocor": "simvastatin",
    # Diuretics
    "lasix": "furosemide",
    "frusenex": "furosemide",
    "aldactone": "spironolactone",
    "aquazide": "hydrochlorothiazide",
    # Corticosteroids
    "wysolone": "prednisone",
    "omnacortil": "prednisone",
    "prednisolone": "prednisone",
    "dexona": "dexamethasone",
    "decadron": "dexamethasone",
    # Respiratory & Allergy
    "asthalin": "albuterol",
    "ventolin": "albuterol",
    "salbutamol": "albuterol",
    "montair": "montelukast",
    "singulair": "montelukast",
    "allegra": "fexofenadine",
    "cetzine": "cetirizine",
    "okacet": "cetirizine",
    "zyrtec": "cetirizine",
    "avil": "pheniramine",
    # CNS / Neuro / Psych
    "daxid": "sertraline",
    "zoloft": "sertraline",
    "fludac": "fluoxetine",
    "prozac": "fluoxetine",
    "nexito": "escitalopram",
    "lexapro": "escitalopram",
    "alprax": "alprazolam",
    "restyl": "alprazolam",
    "xanax": "alprazolam",
    "valium": "diazepam",
    "calmpose": "diazepam",
    "lonazep": "clonazepam",
    "serenace": "haloperidol",
    "haldol": "haloperidol",
    "suminat": "sumatriptan",
    "imitrex": "sumatriptan",
    "ultracet": "tramadol",
    # Others
    "folitrax": "methotrexate",
    "isonex": "isoniazid",
    "thyronorm": "levothyroxine",
    "eltroxin": "levothyroxine",
    "limcee": "ascorbic acid",
    "celin": "ascorbic acid",
    "vitamin c": "ascorbic acid",
}

COMMON_NAME_TO_DB_ID: Dict[str, str] = {
    "lisinopril": "DB00722",
    "metformin": "DB00331",
    "atorvastatin": "DB01076",
    "ibuprofen": "DB01050",
    "amlodipine": "DB00381",
    "warfarin": "DB00682",
    "furosemide": "DB00695",
    "omeprazole": "DB00338",
    "pantoprazole": "DB00213",
    "ciprofloxacin": "DB00537",
    "sertraline": "DB01104",
    "albuterol": "DB01001",
    "salbutamol": "DB01001",
    "aspirin": "DB00945",
    "naproxen": "DB00788",
    "prednisone": "DB00635",
    "metoprolol": "DB00264",
    "spironolactone": "DB00421",
    "acetaminophen": "DB00316",
    "paracetamol": "DB00316",
    "diclofenac": "DB00586",
    "aceclofenac": "DB00586",
    "ketorolac": "DB00465",
    "celecoxib": "DB00482",
    "indomethacin": "DB00328",
    "ketoprofen": "DB01009",
    "amoxicillin": "DB01060",
    "azithromycin": "DB00207",
    "levofloxacin": "DB01137",
    "metronidazole": "DB00916",
    "telmisartan": "DB00966",
    "losartan": "DB00678",
    "ramipril": "DB00178",
    "enalapril": "DB00584",
    "atenolol": "DB00335",
    "propranolol": "DB00571",
    "carvedilol": "DB01136",
    "verapamil": "DB00661",
    "diltiazem": "DB00343",
    "amiodarone": "DB01118",
    "digoxin": "DB00390",
    "rosuvastatin": "DB01098",
    "simvastatin": "DB00641",
    "pravastatin": "DB00175",
    "clopidogrel": "DB00758",
    "apixaban": "DB06605",
    "rivaroxaban": "DB06228",
    "dexamethasone": "DB01234",
    "hydrocortisone": "DB00741",
    "montelukast": "DB00471",
    "cetirizine": "DB00341",
    "fexofenadine": "DB00950",
    "ranitidine": "DB00863",
    "ondansetron": "DB00904",
    "haloperidol": "DB00502",
    "fluoxetine": "DB00472",
    "escitalopram": "DB01175",
    "alprazolam": "DB00404",
    "diazepam": "DB00829",
    "clonazepam": "DB01068",
    "sumatriptan": "DB00669",
    "tramadol": "DB00193",
    "methotrexate": "DB00563",
    "isoniazid": "DB00951",
    "glipizide": "DB01067",
    "glimepiride": "DB00222",
    "levothyroxine": "DB00451",
    "ascorbic acid": "DB00126",
    "caffeine": "DB00201",
    "glucosamine": "DB01296",
}


def normalize_medication_name(raw_name: str) -> str:
    """
    Extract active pharmaceutical ingredient by stripping dosages,
    parenthetical labels, salts, delivery forms, and resolving Indian/global
    brand names (e.g., 'Dolo 650' -> 'acetaminophen').
    """
    if not isinstance(raw_name, str):
        return ""
    text = raw_name.lower().strip()

    # Preserve pure DrugBank IDs e.g. 'db00316'
    if re.match(r"^db\d{5}$", text):
        return text

    # Check direct match in brand map before stripping
    if text in BRAND_AND_SYNONYM_MAP:
        return BRAND_AND_SYNONYM_MAP[text]

    # Strip parenthetical descriptors e.g. '(DB00316)', '(Novel NSAID)', '(Paracetamol)'
    text_no_parens = re.sub(r"\([^)]*\)", " ", text).strip()
    if text_no_parens:
        text = text_no_parens

    # Replace hyphens/slashes with spaces
    text = re.sub(r"[-/]", " ", text)

    # Strip dosages with units e.g. '10 mg', '650mg', '0.09 mg/actuat'
    text = re.sub(r"\d+(\.\d+)?\s*(mg|mcg|g|ml|mg/actuat|%|iu)\b", " ", text)

    # Strip standalone numeric dosages e.g. 'dolo 650', 'pan 40', 'ecosprin 75'
    text = re.sub(r"\b\d+(\.\d+)?\b", " ", text)

    # Strip form and delivery words
    form_words = [
        "oral", "tablet", "tablets", "tab", "delayed", "release", "capsule",
        "capsules", "cap", "solution", "inhalation", "aerosol", "injectable",
        "injection", "topical", "syrup", "suspension", "drops", "forte", "plus",
        "ds", "sr", "xr", "er", "cr", "md", "dt",
        "hydrochloride", "hcl", "sodium", "succinate", "tartrate", "potassium",
        "maleate", "besylate", "calcium", "magnesium", "sulfate", "sulphate",
        "phosphate", "acetate", "citrate"
    ]
    for w in form_words:
        text = re.sub(rf"\b{w}\b", " ", text)

    # Clean whitespace
    clean = re.sub(r"\s+", " ", text).strip()

    # Resolve brand name or synonym
    if clean in BRAND_AND_SYNONYM_MAP:
        return BRAND_AND_SYNONYM_MAP[clean]

    # Check first token if multi-word brand string (e.g. 'dolo extra')
    tokens = clean.split()
    if tokens and tokens[0] in BRAND_AND_SYNONYM_MAP:
        return BRAND_AND_SYNONYM_MAP[tokens[0]]

    return clean


def map_synthea_to_drugbank(
    medications_csv: Path,
    drugbank_drugs: List[str]
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Map Synthea medication records to DrugBank active ingredient IDs.
    Returns mapped DataFrame and detailed mapping coverage statistics.
    """
    df_meds = pd.read_csv(medications_csv)
    total_med_rows = len(df_meds)
    unique_synthea_names = df_meds["DESCRIPTION"].unique()

    # Build lookup table from normalized DrugBank ingredient names
    db_lookup = {d.lower(): d for d in drugbank_drugs}

    # Known mappings from common ingredient names to DrugBank accession IDs
    name_to_db_id = dict(COMMON_NAME_TO_DB_ID)

    db_set = set(drugbank_drugs)

    mapped_rows = []
    unmapped_names = set()

    for _, row in df_meds.iterrows():
        raw_name = row["DESCRIPTION"]
        norm = normalize_medication_name(raw_name)

        matched_drug = None
        # Check direct match with drugbank_drugs
        if norm in db_lookup:
            matched_drug = db_lookup[norm]
        # Check DB ID match
        elif norm in name_to_db_id and name_to_db_id[norm] in db_set:
            matched_drug = name_to_db_id[norm]
        # Check substring match
        else:
            for k, target_db in name_to_db_id.items():
                if k in norm:
                    if target_db in db_set:
                        matched_drug = target_db
                    elif k in db_set:
                        matched_drug = k
                    break

        if matched_drug:
            mapped_rows.append({
                "patient_id": row["PATIENT"],
                "raw_medication": raw_name,
                "normalized_drug": matched_drug
            })
        else:
            unmapped_names.add(raw_name)

    df_mapped = pd.DataFrame(mapped_rows)
    mapped_count = len(df_mapped)
    dropped_count = total_med_rows - mapped_count

    coverage_stats = {
        "total_synthea_med_rows": total_med_rows,
        "mapped_med_rows": mapped_count,
        "dropped_med_rows": dropped_count,
        "row_coverage_pct": round((mapped_count / total_med_rows) * 100, 2),
        "total_unique_meds": len(unique_synthea_names),
        "mapped_unique_meds": len(unique_synthea_names) - len(unmapped_names),
        "unmapped_unique_meds": len(unmapped_names)
    }

    logger.info(
        f"Synthea-to-DrugBank Mapping Coverage: {coverage_stats['row_coverage_pct']}% "
        f"({mapped_count}/{total_med_rows} rows mapped, {dropped_count} dropped)."
    )

    return df_mapped, coverage_stats


# ====================================================================
# 3. PatientContext Builder & Heterogeneous Local Subgraph
# ====================================================================

class PatientContextBuilder:
    """
    Constructs the patient physiological context vector c_p from the patient's
    local heterogeneous subgraph (active diagnoses + current medications).
    """
    def __init__(
        self,
        conditions_csv: Path,
        df_mapped_meds: pd.DataFrame,
        drug_id_to_idx: Dict[str, int]
    ):
        self.drug_id_to_idx = drug_id_to_idx
        df_conds = pd.read_csv(conditions_csv)

        # Map condition names to unique IDs
        all_conds = sorted(df_conds["DESCRIPTION"].unique().tolist())
        self.cond_to_idx = {c: i for i, c in enumerate(all_conds)}
        self.num_conditions = len(all_conds)

        # Patient -> set of condition IDs
        self.patient_conditions: Dict[str, List[int]] = {}
        for _, row in df_conds.iterrows():
            p = row["PATIENT"]
            c_idx = self.cond_to_idx[row["DESCRIPTION"]]
            self.patient_conditions.setdefault(p, []).append(c_idx)

        # Patient -> set of drug indices
        self.patient_drugs: Dict[str, List[int]] = {}
        for _, row in df_mapped_meds.iterrows():
            p = row["patient_id"]
            d_name = row["normalized_drug"]
            if d_name in drug_id_to_idx:
                d_idx = drug_id_to_idx[d_name]
                self.patient_drugs.setdefault(p, []).append(d_idx)

        self.patient_list = sorted(list(set(self.patient_conditions.keys()).intersection(self.patient_drugs.keys())))
        logger.info(f"Initialized PatientContextBuilder for {len(self.patient_list)} patients across {self.num_conditions} unique conditions.")

    def get_patient_context(self, patient_id: str) -> Dict[str, Any]:
        """Return condition node indices and current drug node indices for patient."""
        return {
            "patient_id": patient_id,
            "condition_indices": self.patient_conditions.get(patient_id, []),
            "current_drug_indices": self.patient_drugs.get(patient_id, [])
        }


_RULES_CACHE = None

def expand_condition_acronyms(conditions: List[str]) -> str:
    """Expand common clinical acronyms and synonyms (e.g. CKD -> chronic kidney disease)."""
    raw = " ".join([c.lower() for c in conditions if isinstance(c, str)])
    expansions = []
    tokens = set(re.findall(r"\b\w+\b", raw))
    if "ckd" in tokens or "renal" in raw or "nephropathy" in raw or "esrd" in tokens:
        expansions.append("chronic kidney disease stage 3")
    if "htn" in tokens or "bp" in tokens or "hypertension" in raw:
        expansions.append("essential hypertension")
    if "dm" in tokens or "t2dm" in tokens or "t1dm" in tokens or "sugar" in raw or "diabetic" in raw:
        expansions.append("type 2 diabetes mellitus")
    if "pud" in tokens or "gerd" in tokens or "gastritis" in raw or "acidity" in raw or "bleed" in raw:
        expansions.append("peptic ulcer disease")
    if "chf" in tokens or "hf" in tokens or "cardiomyopathy" in raw:
        expansions.append("heart failure")
    if "cld" in tokens or "liver" in raw or "cirrhosis" in raw or "hepatitis" in raw or "jaundice" in raw:
        expansions.append("hepatic cirrhosis")
    if "copd" in tokens or "wheezing" in raw or "bronchitis" in raw:
        expansions.append("asthma")
    if "afib" in tokens or "af" in tokens or "lqt" in tokens or "tachycardia" in raw:
        expansions.append("cardiac arrhythmia")
    return (raw + " " + " ".join(expansions)).strip()


def compute_task_b_severity(
    patient_conditions_text: List[str],
    drug_a_name: str,
    drug_b_name: str,
    rules_path: Optional[Path] = None
) -> Tuple[float, List[str]]:
    """
    Task B Label Generator:
    Computes a patient-conditioned severity multiplier based on active conditions.
    Every use of Task B is strictly labeled: "Synthetic, rule-based context labels".
    """
    global _RULES_CACHE
    if _RULES_CACHE is None or rules_path is not None:
        path = rules_path or (CONFIGS_DIR / "context_rules.yaml")
        with open(path, "r", encoding="utf-8") as f:
            _RULES_CACHE = yaml.safe_load(f)["rules"]

    db_to_name = {v.lower(): k for k, v in COMMON_NAME_TO_DB_ID.items()}
    db_to_name["db00316"] = "acetaminophen"
    db_to_name["db01001"] = "albuterol"
    db_to_name["db00586"] = "diclofenac"

    d_a = normalize_medication_name(drug_a_name)
    d_b = normalize_medication_name(drug_b_name)
    d_a = db_to_name.get(d_a.lower(), d_a.lower())
    d_b = db_to_name.get(d_b.lower(), d_b.lower())

    active_conds_str = expand_condition_acronyms(patient_conditions_text)

    multiplier = 1.0
    triggered_rules = []

    for r in _RULES_CACHE:
        kw = r["condition_keyword"].lower()
        if kw in active_conds_str:
            class_a = [x.lower() for x in r["drug_class_a"]]
            class_b = [x.lower() for x in r["drug_class_b"]]

            match_1 = any(x in d_a for x in class_a) and any(y in d_b for y in class_b)
            match_2 = any(x in d_b for x in class_a) and any(y in d_a for y in class_b)

            if match_1 or match_2:
                multiplier *= float(r["severity_multiplier"])
                triggered_rules.append(r["id"])

    # Cap maximum multiplier at 3.0
    multiplier = min(3.0, multiplier)
    return multiplier, triggered_rules


# ====================================================================
# 5. Task C: MIMIC-IV Skeleton Loader (Credentialed DUA Requirement)
# ====================================================================

def load_mimic_iv_skeleton(use_mimic: bool = False, mimic_dir: Optional[Path] = None):
    """
    Task C Skeleton Loader: MIMIC-IV Clinical Outcomes Integration.
    
    IMPORTANT RESEARCH GOVERNANCE NOTICE:
    MIMIC-IV is a de-identified EHR database hosted on PhysioNet under Human Subjects
    Data Use Agreement (DUA). Loading real MIMIC-IV clinical outcomes requires completing
    CITI Data or Specimens Only Research training and submitting an approved credentialing
    request on PhysioNet (Goldberger et al., 2000; Johnson et al., 2023).
    
    To maintain academic integrity and ethical compliance, this loader remains behind
    the flag `use_mimic: false` until active institutional DUA approval is verified.
    """
    if not use_mimic:
        logger.info("[Task C] use_mimic is FALSE. Operating on Synthea & DrugBank benchmarks.")
        return None

    # TODO: Implement MIMIC-IV prescriptions, diagnoses_icd, and admissions loading
    # upon completion of PhysioNet credentialing.
    raise NotImplementedError(
        "MIMIC-IV integration requires approved PhysioNet DUA credentialing. "
        "Operate on Task A and Task B benchmarks."
    )
