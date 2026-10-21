import json
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
VOCAB_PATH = PROJECT_ROOT / "ml_service" / "artifacts" / "vocabularies.json"
DDI_DESC_PATH = PROJECT_ROOT / "ml" / "data" / "ogbl_ddi" / "mapping" / "ddi_description.csv.gz"
DOCS_OUT_PATH = PROJECT_ROOT / "docs" / "ALL_1706_DRUGBANK_DRUGS.md"
CLIENT_JSON_PATH = PROJECT_ROOT / "client" / "src" / "data" / "drugbank_1706.json"

def main():
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocabs = json.load(f)

    drug_id_to_idx = vocabs.get("drug_id_to_idx", {})
    print(f"Loaded {len(drug_id_to_idx)} DrugBank IDs from vocabularies.json")

    # Read mapping from ddi_description.csv.gz
    df = pd.read_csv(
        DDI_DESC_PATH,
        usecols=["first drug id", "first drug name", "second drug id", "second drug name"]
    )

    id_to_name = {}
    for db_id, name in zip(df["first drug id"], df["first drug name"]):
        if isinstance(db_id, str) and isinstance(name, str) and db_id not in id_to_name:
            id_to_name[db_id] = name.strip()
    for db_id, name in zip(df["second drug id"], df["second drug name"]):
        if isinstance(db_id, str) and isinstance(name, str) and db_id not in id_to_name:
            id_to_name[db_id] = name.strip()

    name_to_db_id = vocabs.get("name_to_db_id", {})
    db_id_to_name = {}

    matched = 0
    all_rows = []
    for db_id, idx in sorted(drug_id_to_idx.items(), key=lambda x: x[1]):
        eng_name = id_to_name.get(db_id, f"DrugBank Compound {db_id}")
        if db_id in id_to_name:
            matched += 1
        db_id_to_name[db_id] = eng_name
        name_to_db_id[eng_name.lower()] = db_id
        all_rows.append({
            "index": idx + 1,
            "drugbank_id": db_id,
            "name": eng_name,
            "label": f"{eng_name} ({db_id})"
        })

    vocabs["name_to_db_id"] = name_to_db_id
    vocabs["db_id_to_name"] = db_id_to_name

    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(vocabs, f, indent=2)

    print(f"Matched {matched}/{len(drug_id_to_idx)} DrugBank IDs to official English generic names.")

    # Export Markdown catalog of all 1,706 drugs
    DOCS_OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Complete Catalog of All 1,706 DrugBank Drugs in the R-GCN Knowledge Graph",
        "",
        f"Total Drugs in Graph: **{len(all_rows)}** (Matched to official DrugBank generic names: **{matched}**)",
        "",
        "You can type **any Drug Name** or **DrugBank ID (`DBxxxxx`)** listed below into the Prescription DDI Check modal.",
        "",
        "| # | DrugBank ID | Official Generic Drug Name |",
        "|---|---|---|"
    ]
    for r in all_rows:
        lines.append(f"| {r['index']} | `{r['drugbank_id']}` | **{r['name']}** |")

    with open(DOCS_OUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    # Also save compact JSON list for React frontend autocomplete
    CLIENT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CLIENT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump([r["label"] for r in all_rows], f)

    print(f"Saved {DOCS_OUT_PATH} and {CLIENT_JSON_PATH}")
    print("First 30 drugs:")
    for r in all_rows[:30]:
        print(f"  {r['index']:4d}. {r['drugbank_id']} -> {r['name']}")

if __name__ == "__main__":
    main()
