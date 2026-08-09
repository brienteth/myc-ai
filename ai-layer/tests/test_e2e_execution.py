import asyncio
import httpx
import json

BASE_URL = "http://localhost:8420/execution/intelligence"

async def test_missing_credential():
    print("Running Test 1: Telegram Missing Credential")
    intent = "Send me a telegram notification when a new customer arrives."
    
    async with httpx.AsyncClient() as client:
        # 1. Plan
        plan_resp = await client.post(f"{BASE_URL}/plan", json={"intent": intent})
        print(f"Plan response status: {plan_resp.status_code}")
        
        # 2. Simulate
        sim_resp = await client.post(f"{BASE_URL}/simulate", json={"intent": intent})
        sim_data = sim_resp.json()
        print(f"Simulate response: {sim_data}")
        
        # Check if credential is flagged as missing
        # The backend simulation should report blocked if credentials are missing
        if sim_data.get('status') == 'BLOCKED' and 'telegram_bot_token' in str(sim_data):
            print("✅ TEST 1 PASSED: Execution blocked due to missing Telegram token.")
        else:
            print("❌ TEST 1 FAILED: Execution was not properly blocked.")

async def test_parallel_research():
    print("\\nRunning Test 2: Parallel Research Execution")
    intent = "Research Tesla, BYD, and Rivian"
    
    async with httpx.AsyncClient() as client:
        plan_resp = await client.post(f"{BASE_URL}/plan", json={"intent": intent})
        contract = plan_resp.json().get("contract", {})
        
        # We expect parallelLevels to be > 1 for this research task
        if contract.get("parallelLevels", 0) > 1 and contract.get("agentCount", 0) >= 3:
            print(f"✅ TEST 2 PASSED: Graph parallelized with {contract.get('agentCount')} agents across {contract.get('parallelLevels')} levels.")
        else:
            print(f"❌ TEST 2 FAILED: Graph parallelization failed. Levels: {contract.get('parallelLevels')}")

async def test_loop_and_repair():
    print("\\nRunning Test 3: Loop/Repair Mechanisms")
    # This involves ensuring maxIterations > 1 and verificationRequired = True
    intent = "Research competitors and create a verified report"
    
    async with httpx.AsyncClient() as client:
        plan_resp = await client.post(f"{BASE_URL}/plan", json={"intent": intent})
        contract = plan_resp.json().get("contract", {})
        
        if contract.get("maxIterations", 0) > 1 and contract.get("verificationRequired"):
            print("✅ TEST 3 PASSED: Loop mechanism and Verification enforced by Contract.")
        else:
            print("❌ TEST 3 FAILED: Verification/Loop missing.")

async def test_runtime_policy():
    print("\\nRunning Test 4: Runtime Policy Fallback")
    intent = "telegram notification"
    
    async with httpx.AsyncClient() as client:
        plan_resp = await client.post(f"{BASE_URL}/plan", json={"intent": intent})
        contract = plan_resp.json().get("contract", {})
        
        if contract.get("runtimePolicy") == "LOCAL":
            print("✅ TEST 4 PASSED: Privacy-focused intent correctly selected LOCAL runtime.")
        else:
            print(f"❌ TEST 4 FAILED: Selected runtime: {contract.get('runtimePolicy')}")

async def test_budget_hard_stop():
    print("\\nRunning Test 5: Budget Hard Stop")
    intent = "telegram notification"
    
    async with httpx.AsyncClient() as client:
        plan_resp = await client.post(f"{BASE_URL}/plan", json={"intent": intent})
        contract = plan_resp.json().get("contract", {})
        budget = float(contract.get("budget", "1.00"))
        
        if budget <= 0.10:
            print(f"✅ TEST 5 PASSED: Budget strictly bounded at ${budget} for simple task.")
        else:
            print(f"❌ TEST 5 FAILED: Budget bound is too high: ${budget}")

async def main():
    print("Starting E2E Validation Tests...")
    await test_missing_credential()
    await test_parallel_research()
    await test_loop_and_repair()
    await test_runtime_policy()
    await test_budget_hard_stop()

if __name__ == "__main__":
    asyncio.run(main())
