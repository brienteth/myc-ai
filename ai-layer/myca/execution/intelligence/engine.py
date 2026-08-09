import logging
import uuid
from typing import Dict, Any
from myca.execution.intelligence.db import ExecutionDB
from myca.execution.intelligence.graph_runtime import GraphRuntime
from myca.execution.intelligence.agent_runtime import AgentRuntime
from myca.execution.intelligence.verifier_runtime import VerifierRuntime
from myca.execution.intelligence.checkpoint import CheckpointManager
from myca.execution.intelligence.models import ExecutionBudget
from myca.economics.ledger import EconomicLedgerDB, EconomicEvent, EconomicEventType
from myca.economics.optimizer import ExecutionOptimizer

logger = logging.getLogger("myca.execution.intelligence.engine")

class ExecutionIntelligenceEngine:
    """
    Main orchestrator for Execution Intelligence v4.
    """
    
    def __init__(self, inference_engine, secrets_vault):
        self.inference = inference_engine
        self.secrets = secrets_vault
        
        self.agent_runtime = AgentRuntime(self.inference, self.secrets)
        self.verifier_runtime = VerifierRuntime(self.inference)
        self.graph_runtime = GraphRuntime(self.agent_runtime, self.verifier_runtime)

    async def plan(self, intent: str) -> Dict[str, Any]:
        """Creates an Execution Contract and Graph from Intent."""
        logger.info(f"[ENGINE] Planning execution for intent: {intent[:50]}...")
        # Mocking Planner v3 Adapter for Telegram scenario
        is_telegram = "telegram" in intent.lower()
        requires_privacy = is_telegram
        
        # Optimize runtime
        optimization = ExecutionOptimizer.evaluate(intent, requires_privacy)
        selected_rt = optimization["selected"]["name"]
        estimated_cost = optimization["selected"]["cost"]
        
        contract = {
            "intent": intent,
            "goal": "Send a verified notification via Telegram." if is_telegram else "Research competitors and create a verified report",
            "inputs": ["chat_id", "message"] if is_telegram else ["competitor_list"],
            "credentials": [
                {"name": "telegram_bot_token", "status": "missing"}
            ] if is_telegram else [
                {"name": "Web Search", "status": "ready"}
            ],
            "capabilities": ["communication.send"] if is_telegram else ["research.search", "data.extract", "report.generate"],
            "agentCount": 1 if is_telegram else 3,
            "dependencyCount": 0 if is_telegram else 3,
            "parallelLevels": 1 if is_telegram else 2,
            "verificationRequired": not is_telegram,
            "qualityTarget": 100 if is_telegram else 96,
            "budget": "0.10" if is_telegram else "1.00",
            "maxIterations": 1 if is_telegram else 8,
            "runtimePolicy": selected_rt,
            "estimatedCost": estimated_cost,
            "approvalRequired": False
        }
        
        return {"contract": contract, "optimization": optimization}

    async def simulate(self, intent: str) -> Dict[str, Any]:
        """Dry run to show the user what will happen."""
        logger.info(f"[ENGINE] Simulating execution for intent: {intent[:50]}...")
        
        plan_res = await self.plan(intent)
        contract = plan_res.get("contract", {})
        
        # Check credentials
        missing_creds = [c["name"] for c in contract.get("credentials", []) if c.get("status") == "missing"]
        
        if missing_creds:
            return {
                "status": "BLOCKED",
                "reason": "Missing required credential",
                "missing_credentials": missing_creds
            }

        return {
            "status": "SIMULATED",
            "estimated_cost": contract.get("estimatedCost", 0.42),
            "estimated_duration": "2m 14s",
            "graph": {},
            "optimization": plan_res.get("optimization")
        }

    async def run(self, intent: str) -> Dict[str, Any]:
        """Main execution entrypoint."""
        execution_id = f"EX-{str(uuid.uuid4())[:8]}"
        logger.info(f"[ENGINE] Starting execution {execution_id} for intent: {intent[:50]}...")
        
        # Emit ExecutionStarted
        EconomicLedgerDB.record_event(EconomicEvent(
            execution_id=execution_id,
            type=EconomicEventType.EXECUTION_STARTED
        ))
        
        budget = ExecutionBudget().model_dump()
        ExecutionDB.save_execution(execution_id, intent, "RUNNING", budget)
        
        try:
            # 1. PLANNER V3 / COMPILER (Mocked here, would integrate actual Planner)
            logger.info("[ENGINE] Generating Execution Contract and Agents...")
            # contract = await self.planner.plan(intent)
            
            # For now, simulate a contract
            agent_definitions = {} # Populated from contract
            graph = {"id": "g-1", "nodes": [], "edges": []}
            
            # 2. RUN GRAPH
            context = {"intent": intent, "execution_id": execution_id}
            
            # In full implementation, wrap this in LoopRuntime if the entire graph is iterative
            final_artifact = await self.graph_runtime.execute_graph(graph, agent_definitions, context)
            
            # 3. SAVE
            CheckpointManager.save_state(execution_id, {"final_artifact": final_artifact})
            ExecutionDB.update_execution_status(execution_id, "COMPLETED")
            
            # Emit ExecutionCompleted & ComputeConsumed
            EconomicLedgerDB.record_event(EconomicEvent(
                execution_id=execution_id,
                type=EconomicEventType.COMPUTE_CONSUMED,
                compute_cost=0.51, # Simulated actual cost
                units=182431
            ))
            EconomicLedgerDB.record_event(EconomicEvent(
                execution_id=execution_id,
                type=EconomicEventType.EXECUTION_COMPLETED
            ))
            
            logger.info(f"[ENGINE] Execution {execution_id} completed successfully.")
            return {
                "execution_id": execution_id,
                "status": "COMPLETED",
                "artifact": final_artifact
            }
            
        except Exception as e:
            logger.error(f"[ENGINE] Execution {execution_id} failed: {e}")
            ExecutionDB.update_execution_status(execution_id, "FAILED")
            EconomicLedgerDB.record_event(EconomicEvent(
                execution_id=execution_id,
                type=EconomicEventType.EXECUTION_FAILED
            ))
            raise e
