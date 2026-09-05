import pytest
import httpx
from myca.testing.harness import RuntimeTestHarness
from myca.api import create_app

@pytest.mark.asyncio
async def test_e2e_execution_pipeline():
    """
    E2E Integration Validation Tests for Execution Intelligence Endpoints.
    Runs completely in-memory against a mock node runtime without requiring 
    a physical background HTTP server.
    """
    harness = RuntimeTestHarness(node_id="mac_local")
    await harness.start()
    
    app = create_app(harness.node)
    
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Test 1: Telegram Missing Credential
        intent1 = "Send me a telegram notification when a new customer arrives."
        plan_resp = await client.post("/execution/intelligence/plan", json={"intent": intent1})
        assert plan_resp.status_code == 200
        
        sim_resp = await client.post("/execution/intelligence/simulate", json={"intent": intent1})
        assert sim_resp.status_code == 200
        sim_data = sim_resp.json()
        assert sim_data.get('status') == 'BLOCKED'
        assert 'telegram_bot_token' in str(sim_data)
        
        # Test 2: Parallel Research Execution
        intent2 = "Research Tesla, BYD, and Rivian"
        plan_resp = await client.post("/execution/intelligence/plan", json={"intent": intent2})
        assert plan_resp.status_code == 200
        contract = plan_resp.json().get("contract", {})
        assert contract.get("parallelLevels", 0) > 1
        assert contract.get("agentCount", 0) >= 3
        
        # Test 3: Loop/Repair Mechanisms
        intent3 = "Research competitors and create a verified report"
        plan_resp = await client.post("/execution/intelligence/plan", json={"intent": intent3})
        assert plan_resp.status_code == 200
        contract = plan_resp.json().get("contract", {})
        assert contract.get("maxIterations", 0) > 1
        assert contract.get("verificationRequired") is True
        
        # Test 4: Runtime Policy Fallback
        intent4 = "telegram notification"
        plan_resp = await client.post("/execution/intelligence/plan", json={"intent": intent4})
        assert plan_resp.status_code == 200
        contract = plan_resp.json().get("contract", {})
        assert contract.get("runtimePolicy") == "LOCAL"
        
        # Test 5: Budget Hard Stop
        intent5 = "telegram notification"
        plan_resp = await client.post("/execution/intelligence/plan", json={"intent": intent5})
        assert plan_resp.status_code == 200
        contract = plan_resp.json().get("contract", {})
        budget = float(contract.get("budget", "1.00"))
        assert budget <= 0.10
        
    await harness.stop()
