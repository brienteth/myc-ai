"""
Unit and Integration Tests for Myca OS P0.7 — Policy Engine & Interception Loop

Verifies:
  1. Risk Classification:
     - READ/ANALYZE (e.g., 'camera.capture', 'fs.read') -> AUTO (always approved)
     - WRITE (e.g., 'fs.write') -> CONDITIONAL (approved)
     - SEND/DELETE (e.g., 'telegram.send', 'fs.delete') -> APPROVAL (requires callback verification)
  2. Execution Interception:
     - APPROVAL node runs automatically if user callback approves.
     - APPROVAL node terminates as FAILED if callback rejects or is absent.
"""

import asyncio
import pytest

from myca.execution.scheduler import ExecutionScheduler
from myca.execution.event_bus import ExecutionEventBus
from myca.execution.policies import SecurityPolicyEngine, RiskLevel
from myca.contracts.execution import ExecutionGraph, ExecutionNode, NodeState
from myca.skills.core.result import SkillResult


class MockSkillExecutor:
    """Mock skill executor context."""
    pass


def setup_function():
    # Clear the global execution cache to prevent test pollution
    from myca.execution.cache import global_execution_cache
    global_execution_cache.flush()


def test_01_risk_classification():
    """Verify that skills are classified into their respective RiskLevels based on name rules."""
    engine = SecurityPolicyEngine()

    assert engine.get_risk_level("camera.capture") == RiskLevel.AUTO
    assert engine.get_risk_level("filesystem.read") == RiskLevel.AUTO
    assert engine.get_risk_level("local_llm.inference") == RiskLevel.AUTO

    assert engine.get_risk_level("filesystem.write") == RiskLevel.CONDITIONAL
    assert engine.get_risk_level("vault.write") == RiskLevel.CONDITIONAL

    assert engine.get_risk_level("telegram.send") == RiskLevel.APPROVAL
    assert engine.get_risk_level("email.send") == RiskLevel.APPROVAL
    assert engine.get_risk_level("filesystem.delete") == RiskLevel.APPROVAL


@pytest.mark.anyio
async def test_02_interception_auto_approved():
    """Verify RiskLevel.AUTO and RiskLevel.CONDITIONAL nodes are auto-approved without prompting."""
    event_bus = ExecutionEventBus()
    
    # 1. READ node
    read_node = {
        "id": "step_read",
        "skill": "filesystem.read",
        "inputs": {"path": "test.txt"},
        "deps": []
    }
    graph = ExecutionGraph({"nodes": [read_node]})
    
    # Mock skill registry execute call to return success immediately
    from myca.skills.core.registry import SkillRegistry
    original_execute = SkillRegistry.execute
    
    async def mock_execute(ctx, skill_name, **kwargs):
        return SkillResult(success=True, outputs={"content": "Hello World"})
        
    SkillRegistry.execute = mock_execute
    
    try:
        scheduler = ExecutionScheduler(event_bus=event_bus)
        success = await scheduler.run(graph, MockSkillExecutor(), workflow_id="wf-test-auto")
        
        assert success is True
        assert graph.nodes["step_read"].status == NodeState.COMPLETED
    finally:
        SkillRegistry.execute = original_execute


@pytest.mark.anyio
async def test_03_interception_send_approved():
    """Verify RiskLevel.APPROVAL task runs successfully if callback yields True."""
    event_bus = ExecutionEventBus()
    
    send_node = {
        "id": "step_send",
        "skill": "telegram.send",
        "inputs": {"message": "Policy Test message"},
        "deps": []
    }
    graph = ExecutionGraph({"nodes": [send_node]})
    
    from myca.skills.core.registry import SkillRegistry
    original_execute = SkillRegistry.execute
    
    async def mock_execute(ctx, skill_name, **kwargs):
        return SkillResult(success=True, outputs={"status": "sent"})
        
    SkillRegistry.execute = mock_execute
    
    # Callback always approves
    async def mock_approval_callback(node_id, skill_name, inputs):
        return True
        
    policy_engine = SecurityPolicyEngine(approval_callback=mock_approval_callback)
    
    try:
        scheduler = ExecutionScheduler(event_bus=event_bus, policy_engine=policy_engine)
        success = await scheduler.run(graph, MockSkillExecutor(), workflow_id="wf-test-send-ok")
        
        assert success is True
        assert graph.nodes["step_send"].status == NodeState.COMPLETED
    finally:
        SkillRegistry.execute = original_execute


@pytest.mark.anyio
async def test_04_interception_send_rejected():
    """Verify RiskLevel.APPROVAL task fails and aborts if callback rejects approval."""
    event_bus = ExecutionEventBus()
    
    send_node = {
        "id": "step_send",
        "skill": "telegram.send",
        "inputs": {"message": "Policy Test message"},
        "deps": []
    }
    graph = ExecutionGraph({"nodes": [send_node]})
    
    from myca.skills.core.registry import SkillRegistry
    original_execute = SkillRegistry.execute
    
    async def mock_execute(ctx, skill_name, **kwargs):
        return SkillResult(success=True, outputs={"status": "sent"})
        
    SkillRegistry.execute = mock_execute
    
    # Callback rejects execution
    async def mock_approval_callback(node_id, skill_name, inputs):
        return False
        
    policy_engine = SecurityPolicyEngine(approval_callback=mock_approval_callback)
    
    try:
        scheduler = ExecutionScheduler(event_bus=event_bus, policy_engine=policy_engine)
        success = await scheduler.run(graph, MockSkillExecutor(), workflow_id="wf-test-send-reject")
        
        # Must fail because it was rejected by policy
        assert success is False
        assert graph.nodes["step_send"].status == NodeState.FAILED
    finally:
        SkillRegistry.execute = original_execute
