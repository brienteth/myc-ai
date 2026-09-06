"""
Unit and Integration Tests for Myca OS P0.6 — Execution Contract

Verifies:
  1. Compiling natural language prompt to a typed ExecutionContract.
  2. Resolving capabilities list and node dependency DAG.
  3. Dynamic capability-driven device assignments matching the registry database.
"""

import os
import sqlite3
import pytest

from myca.registry import DeviceCapabilityRegistry
from myca.contracts.device import DeviceIdentity, DeviceCapability, TrustState, CapabilityScope
from myca.contracts.execution import ExecutionContractCompiler, ExecutionContract

def setup_function():
    # Clean registry before each test
    registry = DeviceCapabilityRegistry(node_id="mac_local")
    import sqlite3
    from myca.registry import DB_PATH
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("DELETE FROM device_capabilities")
    conn.commit()
    conn.close()


def test_01_compile_cross_device_colony():
    """Verify compiling cross-device intents yields correct nodes, dependencies, and capability lists."""
    registry = DeviceCapabilityRegistry(node_id="mac_local")

    # Register Mac with LLM, write/read capabilities
    mac_identity = DeviceIdentity(
        device_id="mac_local",
        public_key="mac_pub",
        device_type="desktop",
        device_name="My MacBook Pro",
        capabilities=[
            DeviceCapability(capability_id="local_llm.inference", available=True, scope=CapabilityScope.ALLOWED),
            DeviceCapability(capability_id="filesystem.write", available=True, scope=CapabilityScope.ALLOWED),
            DeviceCapability(capability_id="vault.write", available=True, scope=CapabilityScope.ALLOWED),
        ],
        trust_state=TrustState.TRUSTED,
        is_self=True
    )
    registry.register_remote_device(mac_identity)

    # Register iPhone with camera.capture
    iphone_identity = DeviceIdentity(
        device_id="iphone_remote",
        public_key="iphone_pub",
        device_type="mobile",
        device_name="My iPhone 15",
        capabilities=[
            DeviceCapability(capability_id="camera.capture", available=True, scope=CapabilityScope.ALLOWED)
        ],
        trust_state=TrustState.TRUSTED,
        is_self=False
    )
    registry.register_remote_device(iphone_identity)

    compiler = ExecutionContractCompiler(registry)
    prompt = "Telefonumla bu belgenin fotoğrafını çek, Mac'imde analiz et, önemli bilgileri çıkar, PDF raporu oluştur ve hafızama kaydet."
    
    contract = compiler.compile(prompt)

    assert isinstance(contract, ExecutionContract)
    assert contract.intent == "CROSS_DEVICE_COLONY"
    assert "camera.capture" in contract.capabilities
    assert "local_llm.inference" in contract.capabilities

    # Verify dependencies
    nodes_map = {n["id"]: n for n in contract.nodes}
    assert "step_photo" in nodes_map
    assert "step_analysis" in nodes_map
    assert "step_photo" in nodes_map["step_analysis"]["deps"]

    # Verify dynamic capability-driven device assignments
    assert contract.device_assignments["step_photo"] == "iphone_remote"
    assert contract.device_assignments["step_analysis"] == "mac_local"
    assert contract.device_assignments["step_pdf"] == "mac_local"
    assert contract.device_assignments["step_vault"] == "mac_local"


def test_02_compile_chat():
    """Verify chat commands compile to CHAT intent with local engine routing."""
    registry = DeviceCapabilityRegistry(node_id="mac_local")
    compiler = ExecutionContractCompiler(registry)

    contract = compiler.compile("Merhaba, nasılsın?")
    assert contract.intent == "CHAT"
    assert len(contract.nodes) == 1
    assert contract.nodes[0]["skill"] == "local_llm.inference"
    assert contract.device_assignments["step_chat"] == "mac_local"
