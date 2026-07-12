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
    nodes: list[Dict[str, Any]]
    edges: list[Dict[str, Any]]
    variables: Dict[str, Any]
    permissions: list[str]

class RunPayload(BaseModel):
    variables: Optional[Dict[str, Any]] = None

class SecretPayload(BaseModel):
    key: str
    value: str

class IntentPayload(BaseModel):
    prompt: str

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
