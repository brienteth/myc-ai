"""
Unit and Integration Tests for Myca OS P0.8 — Audit Ledger

Verifies:
  1. Creation of audit_ledger SQLite table.
  2. add_audit_entry inserts complete logging details.
  3. Every scheduler node run writes an entry containing inputs, outputs, latency, and costs.
"""

import tempfile
import sqlite3
import pytest
import time
from pathlib import Path

from myca.database import init_db, add_audit_entry
from myca.execution.scheduler import ExecutionScheduler
from myca.execution.event_bus import ExecutionEventBus
from myca.contracts.execution import ExecutionGraph
from myca.skills.core.result import SkillResult

class MockSkillExecutor:
    pass

TEST_DB = Path(tempfile.mktemp(suffix=".db"))

@pytest.fixture(autouse=True)
def patch_db_path(monkeypatch):
    """Redirect DB_PATH to isolated temp database for testing."""
    monkeypatch.setattr("myca.database.DB_PATH", TEST_DB)
    init_db()
    yield
    if TEST_DB.exists():
        try:
            TEST_DB.unlink()
        except Exception:
            pass


def test_01_ledger_direct_insertion():
    """Verify add_audit_entry writes a complete and correct record to the audit_ledger table."""
    audit_id = add_audit_entry(
        workflow_id="wf-direct-test",
        node_id="step_direct",
        skill_id="fs.read",
        device_id="mac_local",
        model_name="auto",
        inputs={"path": "/docs"},
        outputs={"success": True},
        success=True,
        cost=0.0,
        latency_ms=15.6
    )

    assert audit_id != ""

    conn = sqlite3.connect(str(TEST_DB))
    cursor = conn.cursor()
    row = cursor.execute("SELECT * FROM audit_ledger WHERE id = ?", (audit_id,)).fetchone()
    conn.close()

    assert row is not None
    # Verify values by index matching the schema:
    # id, workflow_id, node_id, skill_id, device_id, model_name, inputs_json, outputs_json, success, cost, latency_ms, timestamp
    assert row[1] == "wf-direct-test"
    assert row[2] == "step_direct"
    assert row[3] == "fs.read"
    assert row[4] == "mac_local"
    assert row[5] == "auto"
    assert "path" in row[6]
    assert "success" in row[7]
    assert row[8] == 1  # SQLite Boolean success is 1
    assert row[9] == 0.0
    assert row[10] == 15.6


@pytest.mark.anyio
async def test_02_scheduler_writes_audit():
    """Verify that running a DAG scheduler automatically writes audit records for each step."""
    event_bus = ExecutionEventBus()

    node_def = {
        "id": "step_audit_test",
        "skill": "local_llm.inference",
        "inputs": {"prompt": "Write a poem"},
        "deps": []
    }
    graph = ExecutionGraph({"nodes": [node_def]})

    from myca.skills.core.registry import SkillRegistry
    original_execute = SkillRegistry.execute

    async def mock_execute(ctx, skill_name, **kwargs):
        return SkillResult(success=True, outputs={"text": "A beautiful poem..."})

    SkillRegistry.execute = mock_execute

    try:
        scheduler = ExecutionScheduler(event_bus=event_bus)
        success = await scheduler.run(graph, MockSkillExecutor(), workflow_id="wf-audit-sched")

        assert success is True

        # Check database for audit entry
        conn = sqlite3.connect(str(TEST_DB))
        rows = conn.execute("SELECT * FROM audit_ledger WHERE workflow_id = ?", ("wf-audit-sched",)).fetchall()
        conn.close()

        assert len(rows) == 1
        row = rows[0]
        assert row[2] == "step_audit_test"
        assert row[3] == "local_llm.inference"
        assert "Write a poem" in row[6]
        assert "A beautiful poem..." in row[7]
        assert row[8] == 1
        assert row[10] > 0.0  # Latency recorded
    finally:
        SkillRegistry.execute = original_execute
