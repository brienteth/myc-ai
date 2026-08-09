import logging
from typing import Dict, Any, List

logger = logging.getLogger("myca.execution.intelligence.dependency_analyzer")

class DependencyAnalyzer:
    """
    Detects and removes Fake Edges from the execution graph.
    If A -> B exists, but B's input schema does not require A's output, it's a Fake Edge.
    """
    
    @staticmethod
    def analyze_and_clean(graph: Dict[str, Any], agent_definitions: Dict[str, Any]) -> Dict[str, Any]:
        """
        Takes a graph with 'nodes' and 'edges', and agent definitions.
        Returns a new graph with Fake Edges removed.
        """
        logger.info("[DEPENDENCY ANALYZER] Starting fake edge detection...")
        
        cleaned_edges = []
        removed_edges = 0
        
        edges = graph.get("edges", [])
        
        for edge in edges:
            source_id = edge.get("source")
            target_id = edge.get("target")
            
            # Simple heuristic for now: if target's required inputs do not map to source's outputs, remove.
            # In a full implementation, we need the execution contract mapping.
            source_agent = agent_definitions.get(source_id)
            target_agent = agent_definitions.get(target_id)
            
            if not source_agent or not target_agent:
                # If we don't know the agents, keep the edge to be safe
                cleaned_edges.append(edge)
                continue
                
            source_outputs = source_agent.output_schema.get("properties", {}).keys()
            target_inputs = target_agent.input_schema.get("properties", {}).keys()
            
            # Is there any overlap? If target doesn't consume any output from source, it's a fake edge.
            overlap = set(source_outputs).intersection(set(target_inputs))
            
            # Also consider explicit variable passing in edge definition (e.g. edge["data"]["mapping"])
            explicit_mapping = edge.get("data", {}).get("mapping", {})
            
            if overlap or explicit_mapping:
                cleaned_edges.append(edge)
            else:
                logger.info(f"[DEPENDENCY ANALYZER] Removing FAKE EDGE: {source_id} -> {target_id}")
                removed_edges += 1
                
        logger.info(f"[DEPENDENCY ANALYZER] Removed {removed_edges} fake edges. Graph is optimized.")
        
        new_graph = graph.copy()
        new_graph["edges"] = cleaned_edges
        return new_graph
