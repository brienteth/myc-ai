"""
Automation API Router (Phase 3.0)
FastAPI endpoints for listing workflows, runs, triggering execution and secrets vault.
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional

from .history import AutomationDB
from .planner import AutomationPlanner
from .templates import get_templates

router = APIRouter(prefix="/automation")

class WorkflowPayload(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = ""
    enabled: bool = True
    trigger: Dict[str, Any]
    nodes: list[Dict[str, Any]] = []
    edges: list[Dict[str, Any]] = []
    variables: Dict[str, Any] = {}
    permissions: list[str] = []

class RunPayload(BaseModel):
    variables: Optional[Dict[str, Any]] = None

class SecretPayload(BaseModel):
    key: str
    value: str

class IntentPayload(BaseModel):
    prompt: str

class MCPServerPayload(BaseModel):
    id: Optional[str] = None
    name: str
    type: str  # stdio, sse
    command: Optional[str] = None
    url: Optional[str] = None

# Injected by create_app inside api.py
scheduler = None

# ── Workflows ──────────────────────────────────────────────

@router.get("/workflows")
async def list_workflows():
    return {"workflows": AutomationDB.get_workflows()}

@router.post("/workflows")
async def create_workflow(payload: WorkflowPayload):
    import uuid
    w_dict = payload.model_dump()
    if not w_dict.get("id"):
        w_dict["id"] = f"flow-{uuid.uuid4().hex[:8]}"
    AutomationDB.save_workflow(w_dict)
    return {"status": "ok", "workflow": w_dict}

@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str):
    AutomationDB.delete_workflow(workflow_id)
    return {"status": "deleted"}

# ── Run controls ───────────────────────────────────────────

@router.post("/run/{workflow_id}")
async def trigger_workflow(workflow_id: str, payload: Optional[RunPayload] = None):
    w = AutomationDB.get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Run in background task using scheduler executor
    import asyncio
    input_vars = payload.variables if payload else None
    asyncio.create_task(scheduler.executor.execute(w, input_variables=input_vars))
    return {"status": "triggered"}

@router.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: str):
    success = scheduler.executor.cancel_run(run_id)
    if not success:
        raise HTTPException(status_code=404, detail="Active run not found or already completed")
    return {"status": "cancelled"}

# ── History ────────────────────────────────────────────────

@router.get("/history")
async def get_history():
    return {"history": AutomationDB.get_history()}

# ── Templates ──────────────────────────────────────────────

@router.get("/templates")
async def list_templates():
    return {"templates": get_templates()}

# ── Secrets Vault ──────────────────────────────────────────

@router.get("/secrets")
async def get_secrets():
    return {"keys": AutomationDB.get_secret_keys()}

@router.post("/secrets")
async def set_secret(payload: SecretPayload):
    AutomationDB.set_secret(payload.key, payload.value)
    return {"status": "saved"}

@router.delete("/secrets/{key}")
async def delete_secret(key: str):
    AutomationDB.delete_secret(key)
    return {"status": "deleted"}

# ── Intent Planning ────────────────────────────────────────

@router.post("/plan")
async def plan_workflow(payload: IntentPayload):
    planner = AutomationPlanner(scheduler.runtime.node.inference_engine)
    plan = await planner.plan_intent(payload.prompt)
    return {"plan": plan}

# ── Execution OS Data (Mocked Backend Data) ────────────────
# In a real implementation these would fetch from respective databases

# ── Model Context Protocol (MCP) ───────────────────────────

@router.get("/mcp")
async def list_mcp_servers():
    return {"servers": AutomationDB.get_mcp_servers()}

@router.post("/mcp")
async def add_mcp_server(payload: MCPServerPayload):
    import uuid
    s_dict = payload.model_dump()
    if not s_dict.get("id"):
        s_dict["id"] = f"mcp-{uuid.uuid4().hex[:8]}"
    s_dict["status"] = "Disconnected"
    s_dict["tools_count"] = 0
    s_dict["error_log"] = None
    AutomationDB.save_mcp_server(s_dict)
    return {"status": "ok", "server": s_dict}

@router.delete("/mcp/{server_id}")
async def delete_mcp_server(server_id: str):
    from .mcp import MCPManager
    await MCPManager.disconnect_server(server_id)
    AutomationDB.delete_mcp_server(server_id)
    return {"status": "deleted"}

@router.post("/mcp/{server_id}/connect")
async def connect_mcp_server(server_id: str):
    from .mcp import MCPManager
    servers = AutomationDB.get_mcp_servers()
    srv = next((s for s in servers if s["id"] == server_id), None)
    if not srv:
        raise HTTPException(status_code=404, detail="MCP server config not found")
    
    try:
        if srv["type"] == "stdio":
            await MCPManager.connect_server(server_id, srv["command"])
        else:
            # SSE implementation can be mocked or simply marked as connected
            AutomationDB.update_mcp_status(server_id, "Connected", 5)
        return {"status": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect: {str(e)}")

@router.post("/mcp/{server_id}/disconnect")
async def disconnect_mcp_server(server_id: str):
    from .mcp import MCPManager
    await MCPManager.disconnect_server(server_id)
    return {"status": "disconnected"}

@router.get("/marketplace")
async def list_marketplace():
    return {
        "items": [
            {"id": "1", "name": "Advanced Researcher Agent", "author": "Myca Team", "rating": 4.9, "installs": "12k", "type": "Agent"},
            {"id": "2", "name": "Notion Sync", "author": "Community", "rating": 4.5, "installs": "8k", "type": "Workflow"},
            {"id": "3", "name": "Email Triager", "author": "Myca Team", "rating": 4.8, "installs": "25k", "type": "Skill"},
        ]
    }

@router.get("/policies")
async def list_policies():
    # Example serialization from myca.policies
    return {
        "policies": [
            {"id": "1", "name": "Require Approval for Financial Tx", "condition": "tool.category == 'finance' && args.amount > 100", "action": "Require Human Approval", "status": "Active"},
            {"id": "2", "name": "Block Destructive FS Operations", "condition": "tool.id == 'fs.delete' && args.path.contains('system')", "action": "Block", "status": "Active"},
            {"id": "3", "name": "Auto-approve Local Search", "condition": "tool.id == 'browser.search' && confidence > 0.8", "action": "Auto-Approve", "status": "Inactive"},
        ]
    }

@router.get("/tools")
async def list_tools():
    return {
        "tools": [
            {"id": "browser.search", "name": "Browser Search", "category": "Browser", "latency": "400ms", "success": "99.2%", "permissions": "network.out"},
            {"id": "fs.read", "name": "Read File", "category": "Filesystem", "latency": "2ms", "success": "100%", "permissions": "fs.read"},
            {"id": "ai.summary", "name": "AI Summary", "category": "AI", "latency": "1200ms", "success": "98.5%", "permissions": "ai.local"},
        ]
    }
