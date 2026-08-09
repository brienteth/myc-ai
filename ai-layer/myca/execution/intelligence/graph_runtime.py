import logging
import asyncio
from typing import Dict, Any, List
from myca.execution.intelligence.dependency_analyzer import DependencyAnalyzer
from myca.execution.intelligence.parallelism import ParallelismEngine

logger = logging.getLogger("myca.execution.intelligence.graph_runtime")

class GraphRuntime:
    """
    Executes a Graph Definition.
    Applies Fake Edge detection, Parallelism generation, and runs levels concurrently.
    """
    
    def __init__(self, agent_runtime, verifier_runtime):
        self.agent_runtime = agent_runtime
        self.verifier_runtime = verifier_runtime

    async def execute_graph(self, graph: Dict[str, Any], agent_definitions: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main execution loop for a graph.
        """
        logger.info(f"[GRAPH RUNTIME] Executing Graph ID: {graph.get('id', 'unknown')}")
        
        # 1. Dependency Analysis (Fake Edge Detection)
        optimized_graph = DependencyAnalyzer.analyze_and_clean(graph, agent_definitions)
        
        # 2. Parallelism (Execution Levels)
        levels = ParallelismEngine.build_execution_levels(optimized_graph)
        
        # 3. Execution
        execution_state = {} # Stores node outputs
        
        for level_idx, level_nodes in enumerate(levels):
            logger.info(f"[GRAPH RUNTIME] Executing Level {level_idx + 1}/{len(levels)} with {len(level_nodes)} nodes")
            
            # Fan-out: execute nodes in parallel
            tasks = []
            for node_id in level_nodes:
                agent_def = agent_definitions.get(node_id)
                if not agent_def:
                    logger.error(f"[GRAPH RUNTIME] Missing agent definition for node {node_id}")
                    continue
                    
                # Collect inputs from execution_state based on edges targeting this node
                node_inputs = self._gather_inputs(node_id, optimized_graph, execution_state, context)
                
                tasks.append(self._run_node_safely(node_id, agent_def, node_inputs))
                
            # Fan-in: Wait for all nodes in the current level
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Store results and handle failures
            for i, node_id in enumerate(level_nodes):
                res = results[i]
                if isinstance(res, Exception):
                    logger.error(f"[GRAPH RUNTIME] Node {node_id} failed critically: {res}")
                    raise RuntimeError(f"Graph execution blocked by node failure: {node_id}")
                else:
                    execution_state[node_id] = res
                    
        logger.info(f"[GRAPH RUNTIME] Graph execution completed successfully.")
        return execution_state

    def _gather_inputs(self, node_id: str, graph: Dict[str, Any], state: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Gathers inputs for a node based on its inbound edges and global context."""
        inputs = {}
        # Simple merge for now
        for edge in graph.get("edges", []):
            if edge["target"] == node_id:
                source_id = edge["source"]
                if source_id in state:
                    inputs.update(state[source_id])
                    
        # Include global context (e.g. original intent)
        inputs.update(context)
        return inputs

    async def _run_node_safely(self, node_id: str, agent_def: Any, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Wrapper to handle errors and verification for a single node."""
        try:
            # Plan -> Execute -> Validate Output Schema
            artifact = await self.agent_runtime.run_agent(agent_def, inputs.get("intent", ""), inputs)
            
            # Verification (Independent Context)
            if hasattr(agent_def, 'verification_policy') and agent_def.verification_policy:
                verification_result = await self.verifier_runtime.verify(
                    artifact, 
                    agent_def.output_schema, 
                    agent_def.verification_policy
                )
                if verification_result["overall_status"] == "FAIL":
                    raise ValueError(f"VERIFICATION_FAILED: {verification_result}")
                    
            return artifact
        except Exception as e:
            raise e
