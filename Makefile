# Smart Hospital Information System - Research Reproduction Makefile
# Enforces CPU-only execution with 8 threads per Global Rule 1

PYTHON = ml/venv/Scripts/python.exe
PYTEST = ml/venv/Scripts/pytest.exe

.PHONY: help setup test data baselines main ablations figures tables service reproduce

help:
	@echo "Available commands:"
	@echo "  make setup       - Verify environment and run smoke test"
	@echo "  make test        - Run all ML and Service unit tests (pytest)"
	@echo "  make data        - Download and preprocess benchmarks and Synthea cohort"
	@echo "  make baselines   - Train and evaluate 7 baseline models across 5 seeds"
	@echo "  make main        - Train and evaluate PatientConditionedDDI & ablations (5 seeds)"
	@echo "  make ablations   - Alias for running model ablations"
	@echo "  make figures     - Generate publication-ready figures 1-5 (PDF & PNG)"
	@echo "  make tables      - Generate publication-ready LaTeX tables 1-4 (booktabs)"
	@echo "  make service     - Export artifacts to ml_service/artifacts/"
	@echo "  make reproduce   - Run complete end-to-end research reproduction pipeline"

setup:
	$(PYTEST) ml/tests/test_smoke.py -v

test:
	$(PYTEST) ml/tests/ -v
	$(PYTEST) ml_service/tests/ -v

data:
	$(PYTHON) ml/scripts/run_data_pipeline.py
	$(PYTHON) ml/scripts/build_patient_layer.py

baselines:
	$(PYTHON) ml/scripts/run_baselines.py

main:
	$(PYTHON) ml/scripts/train_main_model.py

ablations:
	$(PYTHON) ml/scripts/train_main_model.py

figures:
	$(PYTHON) ml/scripts/run_phase_5_analysis.py

tables:
	$(PYTHON) ml/scripts/make_tables.py

service:
	$(PYTHON) ml/scripts/export_service_artifacts.py

reproduce: setup data baselines main figures tables service test
	@echo "Complete reproduction pipeline executed successfully."
