"""
Verification tests for the Myca OS Execution SDK (Phase 2.3).
Run this script to verify:
1. Strict Pydantic Input/Output Schema Validation
2. Universal Event Emitting (Started, Progress, Log, Artifact, Completed)
3. Event-Driven Parallel DAG Scheduling (asyncio.gather)
4. OS-Level Recovery (Retries & Alternative Skill Fallbacks)
"""
import asyncio
import logging
from typing import Dict, Any
from pydantic import BaseModel, Field

from myca.skills.core.abi import SkillABI, SkillManifest, SkillEvent, Artifact
from myca.skills.core.decorator import skill
from myca.skills.core.context import SkillContext
from myca.skills.core.permissions import PermissionManager
from myca.skills.core.registry import SkillRegistry
from myca.planner.execution_graph import ExecutionGraph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_os_sdk")

# --- Mock OS Services ---
class MockRuntime:
    def __init__(self):
        self.node = type("MockNode", (), {"event_callback": self.broadcast})()
        
    async def broadcast(self, event_type: str, event_data: dict):
        # Simply print protocol logs to console to show universal events
        print(f"[OS Broadcast] {event_type} -> {event_data.get('event_type')}: {event_data.get('payload')}")

class MockMemory:
    pass

# --- 1. Define Strict Schemas for test skills ---
class FetchInputs(BaseModel):
    url: str

class FetchOutputs(BaseModel):
    html: str

class ParseInputs(BaseModel):
    html: str
    selector: str

class ParseOutputs(BaseModel):
    extracted: str

# --- 2. Register Primitives with ABI v2 ---
@skill(id="browser.fetch", inputs=FetchInputs, outputs=FetchOutputs, permissions=["browser.navigation"])
async def fetch_skill(ctx: SkillContext, url: str) -> dict:
    ctx.emit("Started", {"url": url})
    await ctx.check_cancel()
    
    ctx.progress(0.5)
    ctx.log(f"Fetching HTML content from {url}...")
    
    # Emit an Artifact (e.g., dom_snapshot)
    ctx.add_artifact(
        artifact_id="snapshot_1",
        art_type="dom_snapshot",
        mime="text/html",
        path="/tmp/snapshot.html",
        file_hash="abc123hash",
        size=1024,
        preview="<html><body>Example</body></html>"
    )
    
    ctx.progress(1.0)
    ctx.emit("Completed", {"status": "success"})
    return {"html": f"<html><body>Parsed data from {url}</body></html>"}

@skill(id="browser.parse_heading", inputs=ParseInputs, outputs=ParseOutputs, permissions=["browser.navigation"])
async def parse_heading_skill(ctx: SkillContext, html: str, selector: str) -> dict:
    ctx.emit("Started", {"selector": selector})
    await ctx.check_cancel()
    ctx.log(f"Extracting element with selector '{selector}'")
    
    extracted_text = f"Heading content extracted from HTML using {selector}"
    ctx.emit("Completed", {"status": "success"})
    return {"extracted": extracted_text}

@skill(id="browser.parse_links", inputs=ParseInputs, outputs=ParseOutputs, permissions=["browser.navigation"])
async def parse_links_skill(ctx: SkillContext, html: str, selector: str) -> dict:
    ctx.emit("Started", {"selector": selector})
    await ctx.check_cancel()
    ctx.log(f"Extracting links with selector '{selector}'")
    
    extracted_text = f"Links list extracted using {selector}"
    ctx.emit("Completed", {"status": "success"})
    return {"extracted": extracted_text}

# Mock skill with configured retries
@skill(id="test.retry_skill", permissions=["filesystem.read"], retry=2)
async def retry_skill(ctx: SkillContext) -> dict:
    ctx.emit("Started", {})
    ctx.warn("Simulation: Firing temporary error")
    raise ConnectionError("Temporary connection drop")

async def run_tests():
    # ── Permissions Setup ─────────────────────────────────────
    permissions = PermissionManager()
    permissions.request(["browser.navigation", "filesystem.read"])
    
    runtime = MockRuntime()
    ctx = SkillContext(
        need_id="need_freeze_123",
        runtime=runtime,
        memory=MockMemory(),
        capabilities=None,
        permissions=permissions
    )

    # ── Test 1: Schema Input Type Validation ──────────────────
    print("\n=== TEST 1: Strict Pydantic Input Schema Validation ===")
    # Missing required 'url' parameter
    bad_res = await SkillRegistry.execute(ctx, "browser.fetch")
    print(f"Validation Result (Success?): {bad_res.success}")
    print(f"Validation Logs: {bad_res.logs}\n")

    # ── Test 2: Event-Driven Parallel DAG Scheduling ──────────
    print("=== TEST 2: Native Parallel DAG Scheduling (A -> B and C in parallel) ===")
    # We construct a plan where:
    # A (browser.fetch) runs first
    # B (browser.parse_heading) and C (browser.parse_links) run in parallel, awaiting A's output
    plan = {
        "nodes": [
            {
                "id": "A",
                "skill": "browser.fetch",
                "inputs": {"url": "https://google.com"},
                "deps": []
            },
            {
                "id": "B",
                "skill": "browser.parse_heading",
                "inputs": {"html": "$A.html", "selector": "h1"},
                "deps": ["A"]
            },
            {
                "id": "C",
                "skill": "browser.parse_links",
                "inputs": {"html": "$A.html", "selector": "a"},
                "deps": ["A"]
            }
        ]
    }
    
    graph = ExecutionGraph(plan)
    await graph.execute(ctx)
    
    print("\nGraph Execution Statuses:")
    for nid, node in graph.nodes.items():
        print(f"Node '{nid}' ({node.skill_name}) status: {node.status}")
        if node.result:
            print(f"  Outputs: {node.result.outputs}")

    # ── Test 3: OS Recovery Retries ────────────────────────────
    print("\n=== TEST 3: OS-Level Retry Recovery ===")
    retry_plan = {
        "nodes": [
            {
                "id": "R1",
                "skill": "test.retry_skill",
                "inputs": {},
                "deps": []
            }
        ]
    }
    r_graph = ExecutionGraph(retry_plan)
    await r_graph.execute(ctx)
    print(f"Retry graph final status: {r_graph.nodes['R1'].status}")

    # ── Test 4: Alternative Skill Fallback ─────────────────────
    print("\n=== TEST 4: Alternative Skill Fallback ===")
    # Let's test that fallback to 'core.chat' triggers when 'fs.list' (not registered) fails
    fallback_plan = {
        "nodes": [
            {
                "id": "F1",
                "skill": "fs.list",
                "inputs": {"path": "/invalid/path"},
                "deps": []
            }
        ]
    }
    f_graph = ExecutionGraph(fallback_plan)
    await f_graph.execute(ctx)
    print(f"Fallback graph final status: {f_graph.nodes['F1'].status}")
    if f_graph.nodes['F1'].result:
        print(f"Fallback outputs: {f_graph.nodes['F1'].result.outputs}")

if __name__ == "__main__":
    asyncio.run(run_tests())
