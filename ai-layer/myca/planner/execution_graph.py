"""
Execution Graph (DAG) Runner

Executes the JSON DAG produced by the Planner.
Allows parallel branch execution across the capability mesh.
"""

import asyncio
import logging
from typing import Dict, Any

logger = logging.getLogger("myca.planner.dag")

class ExecutionNode:
    def __init__(self, id: str, skill_name: str, inputs: dict, dependencies: list[str] = None):
        self.id = id
        self.skill_name = skill_name
        self.inputs = inputs
        self.dependencies = dependencies or []
        self.result = None
        self.status = "pending"  # pending, running, completed, failed

class ExecutionGraph:
    def __init__(self, plan_json: dict):
        """
        plan_json example:
        {
            "nodes": [
                {"id": "A", "skill": "shell.execute", "inputs": {"command": "echo Hello"}, "deps": []},
                {"id": "B", "skill": "fs.read", "inputs": {"path": "file.txt"}, "deps": []},
                {"id": "C", "skill": "browser.goto", "inputs": {"url": "http://x.com"}, "deps": ["A", "B"]}
            ]
        }
        """
        self.nodes: Dict[str, ExecutionNode] = {}
        for n in plan_json.get("nodes", []):
            self.nodes[n["id"]] = ExecutionNode(
                id=n["id"],
                skill_name=n["skill"],
                inputs=n.get("inputs", {}),
                dependencies=n.get("deps", [])
            )
            
    async def execute(self, ctx):
        """Runs the DAG, resolving dependencies and running parallel branches natively."""
        logger.info(f"Starting ExecutionGraph with {len(self.nodes)} nodes.")
        
        node_tasks = {}
        
        async def run_node(node_id):
            node = self.nodes[node_id]
            if node.dependencies:
                # Wait for all dependencies to finish
                dep_tasks = [get_or_create_task(dep_id) for dep_id in node.dependencies]
                results = await asyncio.gather(*dep_tasks, return_exceptions=True)
                
                # Verify parent node success
                if any(isinstance(r, Exception) or r is False for r in results):
                    node.status = "failed"
                    logger.error(f"Node '{node.id}' aborted because dependency failed.")
                    return False
                    
                if any(self.nodes[dep_id].status != "completed" for dep_id in node.dependencies):
                    node.status = "failed"
                    logger.error(f"Node '{node.id}' aborted because dependency node was not completed.")
                    return False
            
            node.status = "running"
            return await self._execute_node(node, ctx)
            
        def get_or_create_task(node_id):
            if node_id not in node_tasks:
                node_tasks[node_id] = asyncio.create_task(run_node(node_id))
            return node_tasks[node_id]
            
        # Kick off all tasks
        all_tasks = [get_or_create_task(node_id) for node_id in self.nodes]
        await asyncio.gather(*all_tasks, return_exceptions=True)
        logger.info("ExecutionGraph completed.")

    async def _execute_node(self, node: ExecutionNode, ctx) -> bool:
        logger.info(f"Executing Node {node.id}: {node.skill_name}")
        try:
            from myca.skills.core.registry import SkillRegistry
            
            # Resolve dynamic inputs from dependencies (if dependency output maps to input)
            # Example logic: resolve references like "$node_id.output_field"
            resolved_inputs = {}
            for k, v in node.inputs.items():
                if isinstance(v, str) and v.startswith("$"):
                    # Parse "$node_id.field"
                    parts = v[1:].split(".")
                    dep_node_id = parts[0]
                    field_name = parts[1] if len(parts) > 1 else "response"
                    
                    dep_node = self.nodes.get(dep_node_id)
                    if dep_node and dep_node.result and dep_node.result.success:
                        # Extract from output schemas or outputs dict
                        resolved_inputs[k] = dep_node.result.outputs.get(field_name, "")
                    else:
                        resolved_inputs[k] = ""
                else:
                    resolved_inputs[k] = v
            
            # Execute the skill with retries (Recovery Phase 1)
            manifest = getattr(SkillRegistry._skills.get(node.skill_name), "manifest", None)
            retries = manifest.retry if manifest else 0
            max_attempts = retries + 1
            
            for attempt in range(max_attempts):
                try:
                    node.result = await SkillRegistry.execute(ctx, node.skill_name, **resolved_inputs)
                    if node.result.success:
                        node.status = "completed"
                        return True
                    
                    logger.warning(f"Attempt {attempt + 1}/{max_attempts} failed for node '{node.id}'")
                except Exception as exc:
                    logger.error(f"Attempt {attempt + 1}/{max_attempts} raised exception for node '{node.id}': {exc}")
                    if attempt == max_attempts - 1:
                        break
            
            # Recovery Phase 2: Alternative Skill Fallback
            # For demonstration and architecture compliance, check if there's an alternative skill registered
            # E.g. browser.search fallback -> browser.goto or core.chat
            alternatives = {
                "browser.search": "core.chat",
                "fs.list": "core.chat"
            }
            if node.skill_name in alternatives:
                alt_skill = alternatives[node.skill_name]
                logger.info(f"Recovery Phase 2: Attempting alternative skill '{alt_skill}' for failed '{node.skill_name}'")
                try:
                    node.result = await SkillRegistry.execute(ctx, alt_skill, prompt=resolved_inputs.get("query" if "query" in resolved_inputs else "path", "Hello"))
                    if node.result.success:
                        node.status = "completed"
                        return True
                except Exception as alt_err:
                    logger.error(f"Alternative skill '{alt_skill}' execution failed: {alt_err}")

            node.status = "failed"
            return False
        except Exception as e:
            logger.error(f"Node {node.id} failed: {e}")
            node.status = "failed"
            return False
