import logging
from typing import Dict, Any, List, Set
from collections import defaultdict, deque

logger = logging.getLogger("myca_intelligence.execution_intelligence.parallelism")

class ParallelismEngine:
    """
    Groups independent nodes into execution levels (batches) that can be run concurrently.
    """
    
    @staticmethod
    def build_execution_levels(graph: Dict[str, Any]) -> List[List[str]]:
        """
        Takes a graph (nodes and edges) and returns a list of lists of node IDs.
        Each inner list represents a batch of nodes that can be executed in parallel.
        """
        logger.info("[PARALLELISM] Building execution levels for parallel batching...")
        
        nodes = [n["id"] for n in graph.get("nodes", [])]
        edges = graph.get("edges", [])
        
        in_degree = {n: 0 for n in nodes}
        adj = defaultdict(list)
        
        for edge in edges:
            src = edge["source"]
            dst = edge["target"]
            if src in in_degree and dst in in_degree:
                adj[src].append(dst)
                in_degree[dst] += 1
                
        # Kahn's algorithm for topological sorting, grouped by levels
        queue = deque([n for n in nodes if in_degree[n] == 0])
        levels = []
        
        while queue:
            level_size = len(queue)
            current_level = []
            
            for _ in range(level_size):
                curr = queue.popleft()
                current_level.append(curr)
                
                for neighbor in adj[curr]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        queue.append(neighbor)
                        
            levels.append(current_level)
            
        logger.info(f"[PARALLELISM] Detected {len(levels)} sequential levels.")
        for i, lvl in enumerate(levels):
            logger.debug(f"Level {i+1}: {lvl} ({len(lvl)} parallel tasks)")
            
        return levels
