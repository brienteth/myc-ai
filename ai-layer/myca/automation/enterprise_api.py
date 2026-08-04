"""
Enterprise Domain Router API (Phase 3.0 — Dashboard Command Center)
FastAPI endpoints for Enterprise Dashboard, Digital Twin, Drivers Marketplace, Approvals & Policy Engine.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Dict, Any, Optional

from myca.execution.enterprise.digital_twin import digital_twin_engine
from myca.execution.enterprise.driver_manager import DriverManager
from myca.execution.enterprise.capability_resolver import CapabilityResolver
from myca.execution.enterprise.approval_engine import ApprovalEngine
from myca.execution.enterprise.policy_engine import PolicyEngine
from myca.execution.enterprise.secrets_manager import SecretsManager
from myca.execution.enterprise.analytics import EnterpriseAnalytics
from myca.execution.enterprise.dashboard_service import dashboard_service
from myca.execution.enterprise.opportunity_engine import opportunity_engine
from myca.execution.enterprise.global_search import global_search_service

router = APIRouter(prefix="/enterprise")

class InstallDriverPayload(BaseModel):
    driver_id: str

class ApprovalActionPayload(BaseModel):
    passkey: Optional[str] = ""
    reason: Optional[str] = ""

# ── Dashboard Command Center Endpoints ────────────────────────────────

@router.get("/dashboard")
async def get_enterprise_dashboard():
    """Full dashboard payload: summary + cards + graph + executions + approvals + drivers + AI + timeline + feed."""
    return dashboard_service.get_full_dashboard()

@router.get("/dashboard/summary")
async def get_dashboard_summary():
    return dashboard_service.get_summary()

@router.get("/dashboard/cards")
async def get_dashboard_cards():
    return dashboard_service.get_cards()

@router.get("/dashboard/refresh")
async def refresh_dashboard():
    """Force-refresh all dashboard aggregates."""
    return dashboard_service.get_full_dashboard()

@router.get("/dashboard/search")
async def global_search(q: str = Query(default="", description="Search query")):
    return {"results": global_search_service.search(q)}

@router.get("/dashboard/recommendations")
async def get_ai_recommendations():
    return {"recommendations": opportunity_engine.get_recommendations()}

@router.get("/dashboard/timeline")
async def get_dashboard_timeline():
    return {"timeline": dashboard_service.get_timeline()}

@router.get("/dashboard/activity")
async def get_activity_feed():
    return {"feed": dashboard_service.get_activity_feed()}

@router.get("/dashboard/executions")
async def get_active_executions():
    return {"executions": dashboard_service.get_active_executions()}

# ── Systems Infrastructure Center ──────────────────────────────────────

@router.get("/systems")
async def get_connected_systems():
    from myca.execution.enterprise.systems_service import SystemsService
    return {"systems": SystemsService.get_all_systems(), "stats": SystemsService.get_header_stats()}

@router.get("/systems/{system_id}")
async def get_system_detail(system_id: str):
    from myca.execution.enterprise.systems_service import SystemsService
    sys = SystemsService.get_system(system_id)
    if not sys:
        raise HTTPException(status_code=404, detail="System not found")
    return sys

@router.get("/systems/{system_id}/objects")
async def get_system_objects(system_id: str):
    from myca.execution.enterprise.systems_service import SystemsService
    return {"objects": SystemsService.get_system_objects(system_id)}

@router.get("/systems/{system_id}/capabilities")
async def get_system_capabilities(system_id: str):
    from myca.execution.enterprise.systems_service import SystemsService
    return {"capabilities": SystemsService.get_system_capabilities(system_id)}

@router.get("/systems/{system_id}/permissions")
async def get_system_permissions(system_id: str):
    from myca.execution.enterprise.systems_service import SystemsService
    return {"permissions": SystemsService.get_system_permissions(system_id)}

@router.get("/systems/{system_id}/auth")
async def get_system_auth(system_id: str):
    from myca.execution.enterprise.systems_service import SystemsService
    return SystemsService.get_system_auth(system_id)

@router.get("/systems/{system_id}/health")
async def get_system_health(system_id: str):
    from myca.execution.enterprise.systems_service import SystemsService
    return SystemsService.get_system_health(system_id)

@router.get("/systems/{system_id}/metrics")
async def get_system_metrics(system_id: str):
    from myca.execution.enterprise.systems_service import SystemsService
    return SystemsService.get_system_metrics(system_id)

@router.get("/systems/{system_id}/logs")
async def get_system_logs(system_id: str):
    from myca.execution.enterprise.systems_service import SystemsService
    return {"logs": SystemsService.get_system_logs(system_id)}

@router.get("/systems/{system_id}/version")
async def get_system_version(system_id: str):
    from myca.execution.enterprise.systems_service import SystemsService
    return SystemsService.get_system_version(system_id)

@router.post("/systems/{system_id}/ping")
async def ping_system(system_id: str):
    from myca.execution.enterprise.systems_service import SystemsService
    return SystemsService.ping_system(system_id)

@router.post("/systems/{system_id}/test")
async def test_system_connection(system_id: str):
    from myca.execution.enterprise.systems_service import SystemsService
    return SystemsService.test_connection(system_id)

class ConnectSystemPayload(BaseModel):
    system_type: str

@router.post("/systems/connect")
async def connect_system(payload: ConnectSystemPayload):
    from myca.execution.enterprise.systems_service import SystemsService
    return SystemsService.connect_system(payload.system_type)

# ── Driver Operating System Endpoints ─────────────────────────────────

@router.get("/drivers")
async def get_drivers():
    from myca.execution.enterprise.driver_service import DriverService
    return {
        "installed": DriverService.get_installed_drivers(),
        "marketplace": DriverService.get_marketplace_drivers(),
        "stats": DriverService.get_header_stats()
    }

@router.get("/drivers/{driver_id}")
async def get_driver_detail(driver_id: str):
    from myca.execution.enterprise.driver_service import DriverService
    drv = DriverService.get_driver_detail(driver_id)
    if not drv:
        raise HTTPException(status_code=404, detail="Driver package not found")
    return drv

@router.get("/drivers/{driver_id}/capabilities")
async def get_driver_capabilities(driver_id: str):
    from myca.execution.enterprise.driver_service import DriverService
    return {"capabilities": DriverService.get_driver_capabilities(driver_id)}

@router.get("/drivers/{driver_id}/objects")
async def get_driver_objects(driver_id: str):
    from myca.execution.enterprise.driver_service import DriverService
    return {"objects": DriverService.get_driver_objects(driver_id)}

@router.get("/drivers/{driver_id}/benchmarks")
async def get_driver_benchmarks(driver_id: str):
    from myca.execution.enterprise.driver_service import DriverService
    return {"benchmarks": DriverService.get_driver_benchmarks(driver_id)}

@router.get("/drivers/{driver_id}/events")
async def get_driver_events(driver_id: str):
    from myca.execution.enterprise.driver_service import DriverService
    return {"events": DriverService.get_driver_events(driver_id)}

@router.get("/drivers/{driver_id}/permissions")
async def get_driver_permissions(driver_id: str):
    from myca.execution.enterprise.driver_service import DriverService
    return {"permissions": DriverService.get_driver_permissions(driver_id)}

@router.get("/drivers/{driver_id}/logs")
async def get_driver_logs(driver_id: str):
    from myca.execution.enterprise.driver_service import DriverService
    return {"logs": DriverService.get_driver_logs(driver_id)}

@router.post("/drivers/install")
async def install_driver_package(payload: InstallDriverPayload):
    from myca.execution.enterprise.driver_service import DriverService
    res = DriverService.install_driver(payload.driver_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@router.post("/drivers/{driver_id}/update")
async def update_driver(driver_id: str):
    from myca.execution.enterprise.driver_service import DriverService
    return DriverService.update_driver(driver_id)

@router.post("/drivers/{driver_id}/restart")
async def restart_driver(driver_id: str):
    from myca.execution.enterprise.driver_service import DriverService
    return DriverService.restart_driver(driver_id)

class ToggleDriverPayload(BaseModel):
    enabled: bool

@router.post("/drivers/{driver_id}/toggle")
async def toggle_driver(driver_id: str, payload: ToggleDriverPayload):
    from myca.execution.enterprise.driver_service import DriverService
    return DriverService.toggle_driver(driver_id, payload.enabled)

class CreateDriverPayload(BaseModel):
    name: str
    vendor: str
    auth_type: str

@router.post("/drivers/create")
async def create_driver(payload: CreateDriverPayload):
    from myca.execution.enterprise.driver_service import DriverService
    return DriverService.create_driver_package(payload.name, payload.vendor, payload.auth_type)

# ── Enterprise Ontology Semantic Translation Engine ────────────────────

@router.get("/ontology")
async def get_enterprise_ontology():
    from myca.execution.enterprise.ontology_service import OntologyService
    return {
        "graph": digital_twin_engine.get_company_graph(),
        "objects": OntologyService.get_canonical_objects(),
        "stats": OntologyService.get_stats(),
        "conflicts": OntologyService.get_conflicts(),
        "history": OntologyService.get_history(),
    }

@router.post("/ontology/discover")
async def auto_discover_ontology():
    from myca.execution.enterprise.ontology_service import OntologyService
    return OntologyService.auto_discover()

@router.get("/ontology/objects/{object_id}")
async def get_ontology_object_detail(object_id: str):
    from myca.execution.enterprise.ontology_service import OntologyService
    obj = OntologyService.get_object_detail(object_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Canonical Object not found")
    return obj

class AddMappingPayload(BaseModel):
    vendor: str
    vendor_object: str
    canonical_object: str

@router.post("/ontology/mappings")
async def add_ontology_mapping(payload: AddMappingPayload):
    from myca.execution.enterprise.ontology_service import OntologyService
    return OntologyService.add_mapping(payload.vendor, payload.vendor_object, payload.canonical_object)

class ResolveConflictPayload(BaseModel):
    action: str  # 'accept' | 'reject' | 'merge'

@router.post("/ontology/conflicts/{conflict_id}/resolve")
async def resolve_ontology_conflict(conflict_id: str, payload: ResolveConflictPayload):
    from myca.execution.enterprise.ontology_service import OntologyService
    return OntologyService.resolve_conflict(conflict_id, payload.action)

@router.get("/ontology/objects/{object_id}/export")
async def export_ontology_schema(object_id: str, format: str = Query(default="json", description="json | yaml | openapi")):
    from myca.execution.enterprise.ontology_service import OntologyService
    return OntologyService.export_schema(object_id, format)

# ── Enterprise Capabilities Execution Brain Endpoints ───────────────────

@router.get("/capabilities")
async def get_capabilities():
    from myca.execution.enterprise.capability_service import CapabilityService
    return {
        "capabilities": CapabilityService.get_catalog(),
        "stats": CapabilityService.get_stats(),
        "history": CapabilityService.get_history(),
    }

@router.get("/capabilities/{cap_id}")
async def get_capability_detail(cap_id: str):
    from myca.execution.enterprise.capability_service import CapabilityService
    cap = CapabilityService.get_capability_detail(cap_id)
    if not cap:
        raise HTTPException(status_code=404, detail="Capability not found")
    return cap

class RunCapabilityPayload(BaseModel):
    payload: Optional[Dict[str, Any]] = {}

@router.post("/capabilities/{cap_name}/run")
async def run_capability(cap_name: str, body: Optional[RunCapabilityPayload] = None):
    from myca.execution.enterprise.capability_service import CapabilityService
    p = body.payload if body else {}
    return CapabilityService.run_capability(cap_name, p)

@router.post("/capabilities/{cap_name}/benchmark")
async def benchmark_capability(cap_name: str):
    from myca.execution.enterprise.capability_service import CapabilityService
    return CapabilityService.benchmark_capability(cap_name)

@router.get("/capabilities/{cap_name}/export")
async def export_capability_spec(cap_name: str, format: str = Query(default="json", description="json | yaml | openapi")):
    from myca.execution.enterprise.capability_service import CapabilityService
    return CapabilityService.export_spec(cap_name, format)

# ── Enterprise Execution Runtime Control Center ────────────────────────

@router.get("/executions")
async def get_executions(status: Optional[str] = Query(default=None)):
    from myca.execution.enterprise.execution_service import ExecutionService
    return ExecutionService.get_queue(status)

@router.get("/executions/events")
async def get_live_events():
    from myca.execution.enterprise.execution_service import ExecutionService
    return {"events": ExecutionService.get_live_events()}

class CreateExecutionPayload(BaseModel):
    name: str
    description: str = ""
    need: str = ""
    priority: str = "Medium"
    policy: str = "Standard"
    environment: str = "Production"

@router.post("/executions")
async def create_execution(payload: CreateExecutionPayload):
    from myca.execution.enterprise.execution_service import ExecutionService
    return ExecutionService.create_execution(
        payload.name, payload.description, payload.need,
        payload.priority, payload.policy, payload.environment
    )

@router.get("/executions/{exec_id}")
async def get_execution_detail(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    ex = ExecutionService.get_execution(exec_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
    return ex

@router.get("/executions/{exec_id}/graph")
async def get_execution_graph(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    return ExecutionService.get_graph(exec_id)

@router.get("/executions/{exec_id}/nodes/{node_id}")
async def get_node_detail(exec_id: str, node_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    nd = ExecutionService.get_node_detail(exec_id, node_id)
    if not nd:
        raise HTTPException(status_code=404, detail="Node not found")
    return nd

@router.get("/executions/{exec_id}/timeline")
async def get_execution_timeline(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    return {"timeline": ExecutionService.get_timeline(exec_id)}

@router.get("/executions/{exec_id}/logs")
async def get_execution_logs(exec_id: str, source: Optional[str] = Query(default=None)):
    from myca.execution.enterprise.execution_service import ExecutionService
    return {"logs": ExecutionService.get_logs(exec_id, source)}

@router.get("/executions/{exec_id}/artifacts")
async def get_execution_artifacts(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    return {"artifacts": ExecutionService.get_artifacts(exec_id)}

@router.get("/executions/{exec_id}/variables")
async def get_execution_variables(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    return {"variables": ExecutionService.get_variables(exec_id)}

@router.get("/executions/{exec_id}/drivers")
async def get_execution_drivers(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    return {"drivers": ExecutionService.get_drivers(exec_id)}

@router.get("/executions/{exec_id}/metrics")
async def get_execution_metrics(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    return ExecutionService.get_metrics(exec_id)

@router.post("/executions/{exec_id}/pause")
async def pause_execution(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    return ExecutionService.pause_execution(exec_id)

@router.post("/executions/{exec_id}/resume")
async def resume_execution(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    return ExecutionService.resume_execution(exec_id)

@router.post("/executions/{exec_id}/cancel")
async def cancel_execution(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    return ExecutionService.cancel_execution(exec_id)

@router.post("/executions/{exec_id}/retry")
async def retry_execution(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    return ExecutionService.retry_execution(exec_id)

@router.post("/executions/{exec_id}/replay")
async def replay_execution(exec_id: str):
    from myca.execution.enterprise.execution_service import ExecutionService
    return ExecutionService.replay_execution(exec_id)

# ── Approvals ──────────────────────────────────────────────────────────

@router.get("/approvals")
async def get_approvals():
    return {"pending_approvals": ApprovalEngine.get_pending_approvals()}

@router.post("/approvals/{approval_id}/approve")
async def approve_request(approval_id: str, payload: Optional[ApprovalActionPayload] = None):
    passkey = payload.passkey if payload else ""
    res = ApprovalEngine.approve(approval_id, passkey=passkey)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res

@router.post("/approvals/{approval_id}/reject")
async def reject_request(approval_id: str, payload: Optional[ApprovalActionPayload] = None):
    reason = payload.reason if payload else "User Rejected"
    res = ApprovalEngine.reject(approval_id, reason=reason)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res

# ── Policies ───────────────────────────────────────────────────────────

@router.get("/policies")
async def get_policies():
    return {"policies": PolicyEngine.get_policies()}

# ── Enterprise Audit (Black Box Recorder) ──────────────────────────────

@router.get("/audit/dashboard")
async def get_audit_dashboard():
    from myca.execution.enterprise.audit_service import audit_service
    return audit_service.get_dashboard_metrics()

@router.get("/audit/search")
async def search_audit_executions(
    q: str = Query(default="", description="FTS query"),
    status: Optional[str] = Query(default=None)
):
    from myca.execution.enterprise.audit_service import audit_service
    filters = {"status": status} if status else {}
    return {"executions": audit_service.search_executions(q, filters)}

@router.get("/audit/executions/{exec_id}")
async def get_audit_execution(exec_id: str):
    from myca.execution.enterprise.audit_service import audit_service
    ex = audit_service.get_execution_detail(exec_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Audit record not found")
    return ex

@router.get("/audit/executions/{exec_id}/timeline")
async def get_audit_timeline(exec_id: str):
    from myca.execution.enterprise.audit_service import audit_service
    return {"timeline": audit_service.get_timeline(exec_id)}

@router.get("/audit/executions/{exec_id}/driver-calls")
async def get_audit_driver_calls(exec_id: str):
    from myca.execution.enterprise.audit_service import audit_service
    return {"calls": audit_service.get_driver_calls(exec_id)}

@router.get("/audit/executions/{exec_id}/policy-decisions")
async def get_audit_policy_decisions(exec_id: str):
    from myca.execution.enterprise.audit_service import audit_service
    return {"decisions": audit_service.get_policy_decisions(exec_id)}

@router.get("/audit/executions/{exec_id}/approvals")
async def get_audit_approvals(exec_id: str):
    from myca.execution.enterprise.audit_service import audit_service
    return {"approvals": audit_service.get_approvals(exec_id)}

@router.get("/audit/executions/{exec_id}/artifacts")
async def get_audit_artifacts(exec_id: str):
    from myca.execution.enterprise.audit_service import audit_service
    return {"artifacts": audit_service.get_artifacts(exec_id)}

@router.post("/audit/executions/{exec_id}/replay")
async def replay_audit_execution(exec_id: str, mode: str = Query(default="standard")):
    from myca.execution.enterprise.audit_service import audit_service
    return audit_service.replay_execution(exec_id, mode)

@router.post("/audit/executions/{exec_id}/report")
async def generate_audit_report(exec_id: str):
    from myca.execution.enterprise.audit_service import audit_service
    return audit_service.generate_compliance_report(exec_id)

# ── Analytics (Execution Intelligence Center) ─────────────────────────

@router.get("/analytics/overview")
async def get_analytics_overview():
    from myca.execution.enterprise.analytics_service import analytics_service
    return {"overview": analytics_service.get_overview()}

@router.get("/analytics/score")
async def get_analytics_score():
    from myca.execution.enterprise.analytics_service import analytics_service
    return {"score": analytics_service.get_execution_score()}

@router.get("/analytics/roi")
async def get_analytics_roi():
    from myca.execution.enterprise.analytics_service import analytics_service
    return {"roi": analytics_service.get_roi()}

@router.get("/analytics/workflows")
async def get_analytics_workflows():
    from myca.execution.enterprise.analytics_service import analytics_service
    return {"workflows": analytics_service.get_workflows()}

@router.get("/analytics/departments")
async def get_analytics_departments():
    from myca.execution.enterprise.analytics_service import analytics_service
    return {"departments": analytics_service.get_departments()}

@router.get("/analytics/intelligence")
async def get_analytics_intelligence():
    from myca.execution.enterprise.analytics_service import analytics_service
    return {"intelligence": analytics_service.get_intelligence()}

@router.get("/analytics/energy-cost")
async def get_analytics_energy_cost():
    from myca.execution.enterprise.analytics_service import analytics_service
    return {"energy_cost": analytics_service.get_energy_cost()}

@router.get("/analytics/live")
async def get_analytics_live():
    from myca.execution.enterprise.analytics_service import analytics_service
    return {"live": analytics_service.get_live_metrics()}

# ── Secrets ────────────────────────────────────────────────────────────

@router.get("/secrets")
async def get_secrets():
    return {"secrets": SecretsManager.get_secrets_metadata()}
