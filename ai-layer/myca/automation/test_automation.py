"""
Automation OS Unit Tests (Phase 3.0)
Validates variable resolution, conditional evaluations, and execution runs.
"""
import pytest
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock

from myca.automation.workflow import Workflow, WorkflowNode, WorkflowEdge
from myca.automation.executor import WorkflowExecutor
from myca.automation.history import AutomationDB

# Simple runtime mock
class MockRuntime:
    def __init__(self):
        self.memory = MagicMock()
        self.node = MagicMock()

def test_variable_resolution():
    runtime = MockRuntime()
    executor = WorkflowExecutor(runtime)

    workflow_vars = {"user_name": "Antigravity", "counter": 42}
    node_outputs = {"node_A": {"extracted_val": "result_of_A"}}

    # 1. Test standard string variable resolution
    res_str = executor._resolve_variables("Hello {{variables.user_name}}", workflow_vars, node_outputs)
    assert res_str == "Hello Antigravity"

    # 2. Test node outputs reference resolution
    res_node = executor._resolve_variables("Received {{nodes.node_A.extracted_val}}", workflow_vars, node_outputs)
    assert res_node == "Received result_of_A"

def test_condition_evaluation():
    runtime = MockRuntime()
    executor = WorkflowExecutor(runtime)

    variables = {"status": "ok", "value": 150}

    # Evaluate true condition
    assert executor._evaluate_condition("variables['status'] == 'ok'", variables) is True
    assert executor._evaluate_condition("variables['value'] > 100", variables) is True

    # Evaluate false condition
    assert executor._evaluate_condition("variables['value'] < 50", variables) is False
