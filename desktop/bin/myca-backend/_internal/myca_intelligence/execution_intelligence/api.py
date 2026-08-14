from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from myca_intelligence.execution_intelligence.engine import ExecutionIntelligenceEngine
from myca.economics.ledger import EconomicLedgerDB
from myca.economics.savings import SavingsEngine
# from myca.secrets import SecretsVault # Assuming we have a secrets vault

router = APIRouter(prefix="/execution/intelligence")

# Instantiate real engine for testing (Mocking dependencies for now)
class MockInferenceEngine:
    pass

class MockSecretsVault:
    pass

engine = ExecutionIntelligenceEngine(MockInferenceEngine(), MockSecretsVault())

@router.post("/plan")
async def plan_execution(request: Dict[str, Any]):
    intent = request.get("intent")
    if not intent:
        raise HTTPException(status_code=400, detail="Missing intent")
    return await engine.plan(intent)

@router.post("/simulate")
async def simulate_execution(request: Dict[str, Any]):
    intent = request.get("intent")
    if not intent:
        raise HTTPException(status_code=400, detail="Missing intent")
    return await engine.simulate(intent)

@router.post("/run")
async def run_execution(request: Dict[str, Any]):
    intent = request.get("intent")
    if not intent:
        raise HTTPException(status_code=400, detail="Missing intent")
    return await engine.run(intent)

@router.get("/executions")
async def list_executions():
    # Fetch from ExecutionDB
    return {"executions": []}

@router.get("/executions/{exe_id}")
async def get_execution(exe_id: str):
    return {"id": exe_id, "status": "UNKNOWN"}

@router.post("/executions/{exe_id}/pause")
async def pause_execution(exe_id: str):
    return {"id": exe_id, "status": "PAUSED"}

@router.post("/executions/{exe_id}/resume")
async def resume_execution(exe_id: str):
    return {"id": exe_id, "status": "RESUMED"}

@router.post("/executions/{exe_id}/cancel")
async def cancel_execution(exe_id: str):
    return {"id": exe_id, "status": "CANCELLED"}

@router.get("/economics")
async def get_economics():
    """Returns aggregated economic metrics."""
    # This is a stub returning mock analytics data combined with ledger data
    total_spend = EconomicLedgerDB.get_total_spend()
    savings_data = SavingsEngine.get_savings_breakdown()
    
    return {
        "monthlySpend": 112480 + total_spend,
        "spendDelta": -8.4,
        "executionVolume": 38400000,
        "volumeDelta": 21.7,
        "customerSavings": savings_data["total_savings"],
        "savingsDelta": 14.2,
        "grossValueCreated": 1840000,
        "breakdown": {
            "platform": 42000,
            "execution": 31200,
            "compute": 21480 + total_spend,
            "drivers": 17800
        },
        "savings": savings_data
    }
