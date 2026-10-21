"""
Chemical feature extraction module using RDKit.
Extracts 2048-bit Morgan fingerprints (radius 2) from SMILES strings
to enable inductive cold-start generalization for unseen drugs.
"""

from typing import Dict, List, Tuple, Optional
import numpy as np
from rdkit import Chem
from rdkit.Chem import AllChem
from rdkit import RDLogger

# Suppress RDKit verbose warnings
RDLogger.DisableLog('rdApp.*')


def smiles_to_morgan_fingerprint(
    smiles: str,
    radius: int = 2,
    n_bits: int = 2048
) -> Optional[np.ndarray]:
    """
    Convert a SMILES string to a binary Morgan fingerprint bit vector.
    Returns None if the SMILES string is invalid or cannot be parsed.
    """
    if not isinstance(smiles, str) or not smiles.strip():
        return None
    try:
        mol = Chem.MolFromSmiles(smiles.strip())
        if mol is None:
            return None
        fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=radius, nBits=n_bits)
        arr = np.zeros((n_bits,), dtype=np.float32)
        arr[list(fp.GetOnBits())] = 1.0
        return arr
    except Exception:
        return None


def build_drug_fingerprint_matrix(
    drug_to_smiles: Dict[str, str],
    drug_id_to_idx: Dict[str, int],
    n_bits: int = 2048
) -> Tuple[np.ndarray, List[str]]:
    """
    Build a dense fingerprint feature matrix for all indexed drugs.
    Returns:
        feature_matrix: np.ndarray of shape (num_drugs, n_bits)
        invalid_drugs: list of drug IDs that failed SMILES parsing (filled with mean vector)
    """
    num_drugs = len(drug_id_to_idx)
    matrix = np.zeros((num_drugs, n_bits), dtype=np.float32)
    invalid_drugs = []
    valid_fps = []

    for drug_id, idx in drug_id_to_idx.items():
        smiles = drug_to_smiles.get(drug_id, "")
        fp = smiles_to_morgan_fingerprint(smiles, n_bits=n_bits)
        if fp is not None:
            matrix[idx] = fp
            valid_fps.append(fp)
        else:
            invalid_drugs.append(drug_id)

    # Impute invalid/missing SMILES with global mean fingerprint to prevent zero-norm collapse
    if invalid_drugs and valid_fps:
        mean_fp = np.mean(valid_fps, axis=0)
        for drug_id in invalid_drugs:
            matrix[drug_id_to_idx[drug_id]] = mean_fp

    return matrix, invalid_drugs
