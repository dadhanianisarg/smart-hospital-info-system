"""
Latency verification test for Phase 6 FastAPI inference service.
Posts 100 requests and asserts that p95 latency is strictly under 100 ms.
"""

import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pytest
import numpy as np
from fastapi.testclient import TestClient
from ml_service.app import app

client = TestClient(app)


def test_service_latency_sla_100_runs():
    """Verify that 95th percentile latency across 100 requests is strictly < 100 ms."""
    payload = {
        "patient_id": "P_BENCH_001",
        "new_drug_name": "Ibuprofen",
        "current_meds": ["Lisinopril", "Metformin"],
        "diagnoses": ["Chronic kidney disease stage 3"]
    }

    # Warmup
    for _ in range(10):
        _ = client.post("/score", json=payload)

    latencies_ms = []
    for _ in range(100):
        t0 = time.perf_counter()
        res = client.post("/score", json=payload)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        assert res.status_code == 200
        latencies_ms.append(elapsed_ms)

    p50 = np.percentile(latencies_ms, 50)
    p95 = np.percentile(latencies_ms, 95)
    p99 = np.percentile(latencies_ms, 99)

    print(f"\n[Service Latency Benchmark] p50: {p50:.2f}ms, p95: {p95:.2f}ms, p99: {p99:.2f}ms")
    assert p95 < 100.0, f"SLA Violation: p95 latency {p95:.2f}ms exceeds 100ms threshold"
