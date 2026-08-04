"""
Execution Graph (DAG) Runner & OS NodeReference Data Pipe
Executes the JSON/Object DAG produced by the Planner and Graph Optimizer.
Resolves OS NodeReferences natively and manages parallel execution across nodes.
"""

import asyncio
import logging
from enum import Enum
from typing import Dict, Any, Optional, List

logger = logging.getLogger("myca.planner.dag")

class NodeState(str, Enum):
    CREATED = "created"
    QUEUED = "queued"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    WAITING = "waiting"
    RETRYING = "retrying"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class NodeReference:
    """First-class OS Reference Object representing data piping between DAG nodes."""
    def __init__(self, node_id: str, output_field: str, data_type: str = "any"):
        self.node_id = node_id
        self.output_field = output_field
        self.data_type = data_type

    def resolve(self, completed_nodes: Dict[str, "ExecutionNode"]) -> Any:
        dep_node = completed_nodes.get(self.node_id)
        if dep_node and dep_node.result and dep_node.result.success:
            return dep_node.result.outputs.get(self.output_field, "")
        return ""

class ExecutionNode:
    def __init__(self, id: str, skill_name: str, inputs: dict, dependencies: list[str] = None):
        self.id = id
        self.skill_name = skill_name
        self.inputs = inputs
        self.dependencies = dependencies or []
        self.result = None
        self.status = NodeState.CREATED
        self.references: Dict[str, NodeReference] = {}
        
        # Parse inputs for NodeReferences or string templates
        self._parse_references()

    def _parse_references(self):
        for k, v in list(self.inputs.items()):
            if isinstance(v, NodeReference):
                self.references[k] = v
            elif isinstance(v, str) and (v.startswith("$") or ("{{" in v and "nodes." in v)):
                # Parse format like "$node_id.output_field" or "{{nodes.node_id.outputs.output_field}}"
                clean = v.replace("{{", "").replace("}}", "").replace("nodes.", "").strip()
                if clean.startswith("$"):
                    clean = clean[1:]
                parts = clean.split(".")
                dep_id = parts[0]
                field = parts[1] if len(parts) > 1 else "content"
                if field == "outputs" and len(parts) > 2:
                    field = parts[2]
                
                ref = NodeReference(node_id=dep_id, output_field=field)
                self.references[k] = ref
                if dep_id not in self.dependencies:
                    self.dependencies.append(dep_id)

class ExecutionGraph:
    def __init__(self, plan_json: dict):
        self.nodes: Dict[str, ExecutionNode] = {}
        for n in plan_json.get("nodes", []):
            deps = n.get("deps", n.get("depends_on", []))
            self.nodes[n["id"]] = ExecutionNode(
                id=n["id"],
                skill_name=n["skill"],
                inputs=n.get("inputs", {}),
                dependencies=list(deps)
            )
            
    async def execute(self, ctx) -> bool:
        """Runs the DAG, resolving dependencies and managing parallel execution via OS State Machine."""
        logger.info(f"Starting ExecutionGraph with {len(self.nodes)} nodes.")
        
        # Set all nodes to QUEUED
        for n in self.nodes.values():
            n.status = NodeState.QUEUED
        
        node_tasks = {}
        
        async def run_node(node_id):
            node = self.nodes[node_id]
            node.status = NodeState.SCHEDULED

            if node.dependencies:
                node.status = NodeState.WAITING
                dep_tasks = [get_or_create_task(dep_id) for dep_id in node.dependencies]
                results = await asyncio.gather(*dep_tasks, return_exceptions=True)
                
                if any(isinstance(r, Exception) or r is False for r in results):
                    node.status = NodeState.FAILED
                    logger.error(f"Node '{node.id}' aborted because dependency failed.")
                    return False
                    
                if any(self.nodes[dep_id].status != NodeState.COMPLETED for dep_id in node.dependencies):
                    node.status = NodeState.FAILED
                    logger.error(f"Node '{node.id}' aborted because dependency node was not completed.")
                    return False
            
            node.status = NodeState.RUNNING
            return await self._execute_node(node, ctx)
            
        def get_or_create_task(node_id):
            if node_id not in node_tasks:
                node_tasks[node_id] = asyncio.create_task(run_node(node_id))
            return node_tasks[node_id]
            
        all_tasks = [get_or_create_task(node_id) for node_id in self.nodes]
        results = await asyncio.gather(*all_tasks, return_exceptions=True)
        success = all(r is True for r in results if not isinstance(r, Exception))
        logger.info(f"ExecutionGraph completed with success={success}.")
        return success

    async def _execute_node(self, node: ExecutionNode, ctx) -> bool:
        logger.info(f"Executing Node {node.id}: {node.skill_name}")
        try:
            from myca.skills.core.registry import SkillRegistry
            
            resolved_inputs = dict(node.inputs)
            # Resolve NodeReference objects
            for k, ref in node.references.items():
                resolved_inputs[k] = ref.resolve(self.nodes)

            manifest = getattr(SkillRegistry._skills.get(node.skill_name), "manifest", None)
            retries = manifest.retry if manifest else 0
            max_attempts = retries + 1
            
            for attempt in range(max_attempts):
                if attempt > 0:
                    node.status = NodeState.RETRYING
                try:
                    node.result = await SkillRegistry.execute(ctx, node.skill_name, **resolved_inputs)
                    if node.result.success:
                        # Post-Execution Verifier Check
                        output_valid = True
                        if isinstance(node.result.outputs, dict):
                            # Ensure outputs are valid and not empty errors
                            if "error" in node.result.outputs and node.result.outputs["error"]:
                                output_valid = False
                        
                        if output_valid:
                            node.status = NodeState.COMPLETED
                            return True
                        else:
                            logger.warning(f"Node '{node.id}' post-execution verification failed.")
                except Exception as exc:
                    logger.error(f"Attempt {attempt + 1}/{max_attempts} failed for node '{node.id}': {exc}")
                    if attempt == max_attempts - 1:
                        break
            
            node.status = NodeState.FAILED
            return False
        except Exception as e:
            logger.error(f"Node {node.id} failed: {e}")
            node.status = NodeState.FAILED
            return False
