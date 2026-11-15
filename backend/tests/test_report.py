import pytest

def test_numbers_in_text_all_present_in_facts():
    from app.services.report import assert_numbers_grounded
    facts = {
        "snr": 11.2,
        "sepArcsec": 2.4,
        "ra": 210.8023,
        "dec": 54.3490,
        "numEpochs": 3,
        "shiftPx": 6.0
    }
    valid_text = (
        "Point source detected with SNR 11.2 across 3 epochs. "
        "Astrometric shift of 6.0 px matches known asteroid at 2.4 arcsec."
    )
    # Should pass without error
    assert_numbers_grounded(valid_text, facts)

def test_invented_number_is_rejected():
    from app.services.report import assert_numbers_grounded, UngroundedNumberError
    facts = {
        "snr": 11.2,
        "sepArcsec": 2.4
    }
    # Text invents a number 99.8 or 450.0 not in facts
    invalid_text = "Source with SNR 11.2 located at distance 450.0 AU."
    with pytest.raises(UngroundedNumberError):
        assert_numbers_grounded(invalid_text, facts)

def test_forbidden_words_rejected():
    from app.services.report import validate_terminology, TerminologyViolationError
    # Must use 'candidato' / 'posible' / 'candidate', never 'descubrimiento' or 'planet x encontrado'
    with pytest.raises(TerminologyViolationError):
        validate_terminology("¡Gran descubrimiento científico en el cielo!")
        
    with pytest.raises(TerminologyViolationError):
        validate_terminology("Planet X encontrado en órbita solar.")
        
    # Valid text should pass
    assert validate_terminology("Candidato a objeto en movimiento no validado.") is True

def test_llm_failure_falls_back_to_template():
    from app.services.report import generate_candidate_report
    facts = {
        "id": "CAND-01",
        "snr": 12.5,
        "sepArcsec": 1.5,
        "catalog": "JPL SBIdent",
        "name": "Asteroid 1999 RQ36",
        "shiftPx": 4.0
    }
    # When no API key is provided, falls back cleanly to deterministic template
    report = generate_candidate_report(facts, lang="es", api_key=None)
    assert report["source"] == "template"
    assert "Candidato" in report["text"] or "candidato" in report["text"]
    assert "12.5" in report["text"]
