"""
Final E2E Integration Test Suite for Myca OS

Gathers all P0 components into a single E2E pipeline:
1. Compiles prompt: "Telefonumla bu belgenin fotoğrafını çek..." -> intent: CROSS_DEVICE_COLONY.
2. Capability Scheduler maps "camera.capture" to iphone_remote, other nodes to mac_local.
3. ExecutionScheduler executes the DAG.
4. SecurityPolicyEngine checks risk classification (all approved/auto in this scenario).
5. AuditLedger logs node analytics.
6. Event-Sourced Recovery checkpoints each step to SQLite.
7. MemoryController classifies and saves durable semantic memory, and retrieves it on semantic search.
"""

import tempfile
import sqlite3
import pytest
import asyncio
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ed25519

from myca import database as db
from myca.registry import DeviceCapabilityRegistry
from myca.contracts.device import DeviceIdentity, DeviceCapability, TrustState, CapabilityScope
from myca.contracts.execution import ExecutionContractCompiler, ExecutionGraph
from myca.execution.scheduler import ExecutionScheduler
from myca.execution.event_bus import ExecutionEventBus
from myca.execution.policies import SecurityPolicyEngine
from myca.memory import MemoryController
from myca.skills.core.result import SkillResult

class MockRuntime:
    def __init__(self, node):
        self.node = node

class MockNode:
    def __init__(self, registry):
        self.node_id = "mac_local"
        self.current_load = 0.2
        self.device_registry = registry
        self.simulate = True

@pytest.fixture(autouse=True)
def patch_db_paths(monkeypatch):
    """Redirect all database connections to a clean isolated tempdb."""
    test_db = Path(tempfile.mktemp(suffix=".db"))
    monkeypatch.setattr("myca.database.DB_PATH", test_db)
    monkeypatch.setattr("myca.registry.DB_PATH", test_db)
    monkeypatch.setattr("myca.memory.DB_PATH", test_db)
    db.init_db()
    # Explicitly create device_capabilities tables
    registry = DeviceCapabilityRegistry(node_id="mac_local")
    registry.init_db()
    yield test_db
    if test_db.exists():
        try:
            test_db.unlink()
        except Exception:
            pass


@pytest.mark.anyio
async def test_final_e2e_colony_pipeline(patch_db_paths):
    """Verify entire intent-to-DAG execution, dynamic pairing, security check, checkpointing, and second brain storage."""
    test_db = patch_db_paths
    registry = DeviceCapabilityRegistry(node_id="mac_local")

    # 1. Register Mac capabilities
    mac_identity = DeviceIdentity(
        device_id="mac_local",
        public_key="mac_pub",
        device_type="desktop",
        device_name="My MacBook",
        capabilities=[
            DeviceCapability(capability_id="local_llm.inference", available=True, scope=CapabilityScope.ALLOWED),
            DeviceCapability(capability_id="filesystem.write", available=True, scope=CapabilityScope.ALLOWED),
            DeviceCapability(capability_id="vault.write", available=True, scope=CapabilityScope.ALLOWED)
        ],
        trust_state=TrustState.TRUSTED,
        is_self=True
    )
    registry.register_remote_device(mac_identity)

    # 2. Register iPhone capabilities (mobile device pairing)
    iphone_identity = DeviceIdentity(
        device_id="iphone_remote",
        public_key="iphone_pub",
        device_type="mobile",
        device_name="Paired iPhone 15",
        capabilities=[
            DeviceCapability(capability_id="camera.capture", available=True, scope=CapabilityScope.ALLOWED)
        ],
        trust_state=TrustState.TRUSTED,
        is_self=False
    )
    registry.register_remote_device(iphone_identity)

    # 3. Compile natural language prompt to ExecutionContract
    compiler = ExecutionContractCompiler(registry)
    prompt = "Telefonumla bu belgenin fotoğrafını çek, Mac'imde analiz et, önemli bilgileri çıkar, PDF raporu oluştur ve hafızama kaydet."
    
    contract = compiler.compile(prompt)

    # Verify intent and assignments
    assert contract.intent == "CROSS_DEVICE_COLONY"
    assert contract.device_assignments["step_photo"] == "iphone_remote"
    assert contract.device_assignments["step_analysis"] == "mac_local"
    assert contract.device_assignments["step_pdf"] == "mac_local"
    assert contract.device_assignments["step_vault"] == "mac_local"

    # 4. Mock execution of skills
    from myca.skills.core.registry import SkillRegistry
    original_execute = SkillRegistry.execute

    executed_skills = []

    async def mock_execute(ctx, skill_name, **kwargs):
        executed_skills.append(skill_name)
        if skill_name == "camera.capture":
            return SkillResult(success=True, outputs={"photo_url": "file:///photos/invoice.jpg"})
        elif skill_name == "local_llm.inference":
            return SkillResult(success=True, outputs={"text": "Extracted Invoice Data: $1,200 total due."})
        elif skill_name == "filesystem.write":
            return SkillResult(success=True, outputs={"file_path": "/reports/invoice_analysis.pdf"})
        elif skill_name == "vault.write":
            # Store in second brain using MemoryController
            memory_controller = MemoryController()
            memory_id = memory_controller.add_memory("Extracted Invoice Data: $1,200 total due.", "interaction")
            return SkillResult(success=True, outputs={"memory_id": memory_id})
        return SkillResult(success=False, outputs={})

    SkillRegistry.execute = mock_execute

    # 5. Execute DAG using Scheduler, Policy Engine, and Event Bus
    event_bus = ExecutionEventBus()
    policy_engine = SecurityPolicyEngine() # Intercepts node risks
    from myca.execution.cache import ExecutionCache
    clean_cache = ExecutionCache()
    scheduler = ExecutionScheduler(event_bus=event_bus, cache=clean_cache, policy_engine=policy_engine)
    
    graph = ExecutionGraph({"nodes": contract.nodes})
    mock_node = MockNode(registry)
    mock_ctx = MockRuntime(mock_node)

    try:
        success = await scheduler.run(graph, mock_ctx, workflow_id="wf-final-e2e")
        
        # Verify overall success
        assert success is True
        assert executed_skills == ["camera.capture", "local_llm.inference", "filesystem.write", "vault.write"]

        # 6. Assert sqlite state changes
        conn = sqlite3.connect(str(test_db))
        
        # Check checkpoints are saved
        checkpoints = conn.execute("SELECT node_id, status FROM graph_checkpoints WHERE workflow_id = ?", ("wf-final-e2e",)).fetchall()
        assert len(checkpoints) == 4
        assert dict(checkpoints)["step_photo"] == "completed"
        assert dict(checkpoints)["step_vault"] == "completed"

        # Check audit ledger records are populated
        audit_entries = conn.execute("SELECT node_id, success, latency_ms FROM audit_ledger WHERE workflow_id = ?", ("wf-final-e2e",)).fetchall()
        assert len(audit_entries) == 4
        for entry in audit_entries:
            assert entry[1] == 1  # success
            assert entry[2] > 0.0  # latency recorded

        # Check durable memories are stored in the second brain
        memories = conn.execute("SELECT content FROM memories").fetchall()
        assert len(memories) == 1
        assert "Extracted Invoice Data" in memories[0][0]

        conn.close()

        # 7. Verify semantic retrieval from Second Brain Memory Store
        memory_controller = MemoryController(threshold=0.30)
        retrieved = memory_controller.retrieve_relevant_memories("Invoice total due")
        assert len(retrieved) > 0
        assert "Extracted Invoice Data: $1,200 total due." in retrieved[0]["text"]

    finally:
        SkillRegistry.execute = original_execute
