import re
import os
from typing import Dict, Any, Literal, Optional, Set
import httpx

from app.schemas.manifest import Candidate, FieldManifest

class UngroundedNumberError(Exception):
    """Raised when an AI explanation generates a hallucinated numerical value not in source facts."""
    pass

class TerminologyViolationError(Exception):
    """Raised when scientific text uses forbidden sensationalist words (e.g. discovery, planet x found)."""
    pass

FORBIDDEN_PHRASES = [
    "descubrimiento",
    "discovery",
    "planet x encontrado",
    "planet x found",
    "planeta x encontrado",
    "descubierto",
    "discovered"
]

BENIGN_CONSTANTS: Set[float] = {
    0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0,  # detectors, indices
    2026.0, 60.0, 100.0                # year, grid size, percentage
}

def validate_terminology(text: str) -> bool:
    """Enforces strict Space Apps compliance: 'candidato'/'posible', never 'descubrimiento'."""
    lower_text = text.lower()
    for phrase in FORBIDDEN_PHRASES:
        if phrase in lower_text:
            raise TerminologyViolationError(
                f"Forbidden sensationalist phrase '{phrase}' detected in explanation. Use 'candidate' / 'candidato'."
            )
    return True

def _extract_fact_numbers(obj: Any) -> Set[float]:
    """Recursively collects all numerical values from a fact dictionary."""
    numbers = set()
    if isinstance(obj, (int, float)):
        numbers.add(round(float(obj), 4))
    elif isinstance(obj, dict):
        for v in obj.values():
            numbers.update(_extract_fact_numbers(v))
    elif isinstance(obj, (list, tuple)):
        for item in obj:
            numbers.update(_extract_fact_numbers(item))
    elif isinstance(obj, str):
        # Find any embedded numbers in strings (e.g. "Asteroid (5812) Jayleno")
        found = re.findall(r"\b\d+(?:\.\d+)?\b", obj)
        for num_str in found:
            try:
                numbers.add(round(float(num_str), 4))
            except ValueError:
                pass
    return numbers

def assert_numbers_grounded(text: str, facts: Dict[str, Any], tol: float = 0.05) -> None:
    """Validates that every number in generated text corresponds directly to a source fact."""
    fact_numbers = _extract_fact_numbers(facts)
    fact_numbers.update(BENIGN_CONSTANTS)
    
    # Extract numbers from text
    text_numbers = re.findall(r"\b\d+(?:\.\d+)?\b", text)
    
    for num_str in text_numbers:
        val = float(num_str)
        # Check if val is matched in fact_numbers within tolerance
        matched = any(abs(val - fn) <= tol or (fn != 0 and abs((val - fn) / fn) <= tol) for fn in fact_numbers)
        if not matched:
            raise UngroundedNumberError(
                f"Ungrounded number '{num_str}' in explanation is not present in validated facts: {fact_numbers}"
            )

def facts_for(candidate: Candidate, manifest: FieldManifest) -> Dict[str, Any]:
    """Builds a structured fact dictionary from candidate and field metadata."""
    facts: Dict[str, Any] = {
        "candidateId": candidate.id,
        "kind": candidate.kind,
        "status": candidate.status,
        "snr": candidate.snr,
        "numEpochs": len(candidate.track),
        "ra": manifest.ra,
        "dec": manifest.dec,
        "fovDeg": manifest.fovDeg,
        "collection": manifest.provenance.collection
    }
    if candidate.match:
        facts["catalog"] = candidate.match.catalog
        facts["name"] = candidate.match.name
        facts["sepArcsec"] = candidate.match.sepArcsec
        
    if len(candidate.track) >= 2:
        dx = candidate.track[-1].x - candidate.track[0].x
        dy = candidate.track[-1].y - candidate.track[0].y
        shift_px = round((dx**2 + dy**2)**0.5, 2)
        facts["shiftPx"] = shift_px
    return facts

def explain_template(facts: Dict[str, Any], lang: Literal["en", "es"] = "en") -> str:
    """Generates a strictly grounded scientific explanation from facts."""
    snr = facts.get("snr", 10.0)
    name = facts.get("name")
    catalog = facts.get("catalog")
    sep = facts.get("sepArcsec")
    shift = facts.get("shiftPx", 5.0)
    epochs = facts.get("numEpochs", 2)
    
    if lang == "es":
        if name and catalog:
            return (
                f"Candidato a objeto en movimiento detectado con S/N de {snr} a lo largo de {epochs} épocas "
                f"(desplazamiento de {shift} px). Verificado contra el catálogo {catalog} como {name} "
                f"con una separación angular de {sep} arcsec."
            )
        return (
            f"Candidato a objeto en movimiento no validado detectado con S/N de {snr} "
            f"a lo largo de {epochs} épocas de observación con desplazamiento aparente de {shift} px."
        )
    else:
        if name and catalog:
            return (
                f"Moving object candidate detected with S/N of {snr} across {epochs} observation epochs "
                f"(astrometric shift of {shift} px). Crossmatched against {catalog} as {name} "
                f"within {sep} arcsec."
            )
        return (
            f"Unvalidated moving source candidate detected with S/N of {snr} "
            f"across {epochs} observation epochs with an apparent displacement of {shift} px."
        )

def generate_candidate_report(
    facts: Dict[str, Any],
    lang: Literal["en", "es"] = "en",
    api_key: Optional[str] = None
) -> Dict[str, str]:
    """Generates an explanation, validates grounding, and returns {text, source}."""
    # Deterministic grounded template is the primary reliable pipeline
    text = explain_template(facts, lang=lang)
    validate_terminology(text)
    assert_numbers_grounded(text, facts)
    return {"text": text, "source": "template"}
