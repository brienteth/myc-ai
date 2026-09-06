"""
Unit and Integration Tests for Myca OS P0.9 — Event-Sourced Recovery & Checkpoint Resuming

Verifies:
  1. Successful completion of steps writes checkpoints to graph_checkpoints database.
  2. Running the same workflow_id after a failure skips already completed nodes
     and resumes exactly from the last successful checkpoint.
"""

import os
import sqlite3
import pytest
import asyncio

from myca.database import DB_PATH, init_db, get_checkpoints
from myca.execution.scheduler import ExecutionScheduler
from myca.execution.event_bus import ExecutionEventBus
from myca.contracts.execution import ExecutionGraph, ExecutionNode, NodeState
from myca.skills.core.result import SkillResult


class MockSkillExecutor:
    pass


def setup_function():
    init_db()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("DELETE FROM graph_checkpoints")
    conn.commit()
    conn.close()


@pytest.mark.anyio
async def test_01_checkpoint_resuming():
    """Verify that a partially failed workflow resumes execution from checkpoints without executing completed nodes."""
    event_bus = ExecutionEventBus()

    # Define a 2-node graph: step_1 -> step_2
    node1 = {
        "id": "step_1",
        "skill": "local_llm.inference",
        "inputs": {"prompt": "First step"},
        "deps": []
    }
    node2 = {
        "id": "step_2",
        "skill": "filesystem.write",
        "inputs": {"content": "Second step output", "path": "out.txt"},
        "deps": ["step_1"]
    }
    graph = ExecutionGraph({"nodes": [node1, node2]})

    # Mock Skill Registry
    from myca.skills.core.registry import SkillRegistry
    original_execute = SkillRegistry.execute

    execution_calls = []

    # Run 1: step_1 succeeds, step_2 fails (throws exception)
    async def mock_execute_run1(ctx, skill_name, **kwargs):
        execution_calls.append(skill_name)
        if skill_name == "local_llm.inference":
            return SkillResult(success=True, outputs={"text": "Step 1 output text"})
        else:
            raise ValueError("Forced failure in step 2")

    SkillRegistry.execute = mock_execute_run1

    scheduler = ExecutionScheduler(event_bus=event_bus)
    success = await scheduler.run(graph, MockSkillExecutor(), workflow_id="wf-recovery-test")

    # Run 1 must fail overall
    assert success is False
    assert graph.nodes["step_1"].status == NodeState.COMPLETED
    assert graph.nodes["step_2"].status == NodeState.FAILED
    assert execution_calls == ["local_llm.inference", "filesystem.write"]

    # Verify that step_1 is stored in checkpoints database
    conn = sqlite3.connect(str(DB_PATH))
    checkpoints = get_checkpoints("wf-recovery-test")
    conn.close()
    assert "step_1" in checkpoints
    assert checkpoints["step_1"]["status"] == "completed"
    assert checkpoints["step_1"]["outputs"]["text"] == "Step 1 output text"

    # Reset calls tracker
    execution_calls.clear()

    # Run 2: Re-run with the same workflow_id. Both steps should succeed this time.
    # However, step_1 is already completed, so it should be skipped and ONLY step_2 should execute!
    async def mock_execute_run2(ctx, skill_name, **kwargs):
        execution_calls.append(skill_name)
        if skill_name == "local_llm.inference":
            return SkillResult(success=True, outputs={"text": "Step 1 output text"})
        else:
            return SkillResult(success=True, outputs={"file": "out.txt"})

    SkillRegistry.execute = mock_execute_run2

    # Instantiate a fresh graph for Run 2
    graph_run2 = ExecutionGraph({"nodes": [node1, node2]})
    scheduler_run2 = ExecutionScheduler(event_bus=event_bus)
    success_run2 = await scheduler_run2.run(graph_run2, MockSkillExecutor(), workflow_id="wf-recovery-test")

    # Run 2 must succeed overall
    assert success_run2 is True
    assert graph_run2.nodes["step_1"].status == NodeState.COMPLETED
    assert graph_run2.nodes["step_2"].status == NodeState.COMPLETED

    # Crucial assertion: "local_llm.inference" (step_1) should NOT be in execution_calls because it resumed from checkpoint!
    assert "local_llm.inference" not in execution_calls
    assert execution_calls == ["filesystem.write"]

    # Restore original executor
    SkillRegistry.execute = original_execute
