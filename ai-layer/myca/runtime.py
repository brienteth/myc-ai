import logging
import os
import time
from typing import AsyncGenerator
import json

from .core.need import Need, Experience, Capability, PrivacyLevel
from .experience.memory import ExperienceMemory
from .planner.planner import Planner
from .planner.execution_graph import ExecutionGraph
from .skills.core.registry import SkillRegistry

logger = logging.getLogger("myca.runtime")

class Analytics:
    def __init__(self):
        self.total_needs = 0
        self.avoided_needs = 0
        self.energy_saved = 0.0
        self.gpu_seconds_saved = 0.0
        self.total_latency_ms = 0.0
        self.local_execution_count = 0
        self.network_execution_count = 0
        self.reused_experiences = 0

    def get_stats(self):
        avoidance_rate = (self.avoided_needs / self.total_needs * 100) if self.total_needs > 0 else 0
        avg_latency = (self.total_latency_ms / self.total_needs) if self.total_needs > 0 else 0
        
        return {
            "total_needs": self.total_needs,
            "avoidance_rate": f"{avoidance_rate:.1f}%",
            "energy_saved": f"{self.energy_saved:.1f}",
            "gpu_seconds_saved": f"{self.gpu_seconds_saved:.1f}s",
            "average_latency_ms": f"{avg_latency:.1f}",
            "local_execution_pct": f"{(self.local_execution_count / max(1, self.total_needs) * 100):.1f}%",
            "network_execution_pct": f"{(self.network_execution_count / max(1, self.total_needs) * 100):.1f}%",
            "reused_experiences": self.reused_experiences
        }

class RuntimeEngine:
    """
    Myca Distributed Execution OS Runtime
    Need -> Planner (LLM) -> Decision Engine (Mesh) -> Execution Graph (DAG) -> Experience Memory
    """
    def __init__(self, node):
        self.node = node
        self.memory = ExperienceMemory()
        # self.necessity_engine = NecessityEngine(self.memory) # Deprecated legacy for now
        self.planner = Planner(self.node.inference_engine)
        self.analytics = Analytics()
        
    async def schedule(self, need: Need) -> dict:
        self.analytics.total_needs += 1
        start_time = time.time()
        
        # 1. Planning Phase
        available_skills = SkillRegistry.get_manifests()
        plan_json = await self.planner.create_plan(need.prompt, available_skills)
        
        # 2. Execution Graph (DAG) Execution
        from myca.skills.core.context import SkillContext
        from myca.skills.core.permissions import PermissionManager
        
        permissions = PermissionManager()
        permissions.request(["fs", "browser", "network"])
        
        ctx = SkillContext(
            need_id=need.need_id,
            runtime=self,
            memory=self.memory,
            capabilities=None,
            permissions=permissions
        )
        
        graph = ExecutionGraph(plan_json)
        await graph.execute(ctx)
        
        # Determine success
        success = all(n.status == "completed" for n in graph.nodes.values())
        elapsed_ms = (time.time() - start_time) * 1000
        
        # Reconstruct response for the UI/User
        response_text = ""
        for node in graph.nodes.values():
            if node.result and node.result.success:
                # If there's a response key in output dict, print it directly. Else, print representation.
                response_text += node.result.outputs.get("response", str(node.result.outputs))
            else:
                response_text += f"[{node.skill_name}] -> {node.status}\n"
                
        # 3. Store Experience
        self.memory.store_plan_experience(
            need_text=need.prompt,
            plan=plan_json,
            success=success,
            latency=elapsed_ms,
            energy=1.0 # arbitrary
        )
        
        return {
            "response": response_text,
            "source": "executor_mesh",
            "compute_avoided": False,
            "latency_ms": elapsed_ms,
            "node_used": "local_mesh",
            "node_display": "⚡ Yürütücü (Executor)",
            "done": True
        }

    async def stream_schedule(self, need: Need) -> AsyncGenerator[dict, None]:
        # For simplicity, wrap the DAG execution in a single block 
        # and then yield the result, since DAG execution isn't inherently streamable token-by-token
        # without hooks into the DAG nodes.
        yield {"type": "token", "token": "Planning Execution Graph...\n"}
        
        res = await self.schedule(need)
        
        yield {"type": "token", "token": res["response"]}
        yield {
            "type": "done",
            "source": res["source"],
            "compute_avoided": res["compute_avoided"],
            "latency_ms": res["latency_ms"],
            "node_used": res["node_used"],
            "node_display": res["node_display"]
        }
