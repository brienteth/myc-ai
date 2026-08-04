"""
Graph Optimizer Layer (Graph Engineering)
Optimizes candidate Execution Graphs (DAGs):
- Merges redundant nodes
- Analyzes Diamond Topologies & Fan-out / Fan-in parallel branches
- Auto-inserts Edge Verifier Nodes before critical side-effects (fs.write, communication.send)
- Estimates predicted cost and latency
"""

import logging
from typing import Dict, Any, List

logger = logging.getLogger("myca.planner.optimizer")

# Skills that produce critical external side-effects requiring edge verification
CRITICAL_SIDE_EFFECT_SKILLS = {"fs.write", "table.write", "communication.send", "fs.delete"}

class GraphOptimizer:
    def __init__(self):
        pass

    def optimize(self, plan_dict: dict) -> dict:
        """
        Takes a raw candidate DAG plan dictionary and optimizes it using Graph Engineering principles.
        Returns optimized plan dictionary.
        """
        workflow_name = plan_dict.get('name', 'Untitled')
        logger.info(f"[GRAPH OPTIMIZER] Optimizing DAG for workflow '{workflow_name}'")
        
        nodes = plan_dict.get("nodes", [])
        edges = list(plan_dict.get("edges", []))
        
        # Step 1: Remove redundant identical nodes (e.g. repeated fs.read on same path)
        optimized_nodes = []
        seen_skills = {}
        merged_map = {}

        for node in nodes:
            skill = node.get("skill")
            inputs = node.get("inputs", {})
            key = f"{skill}:{str(inputs)}"
            if key in seen_skills:
                prev_id = seen_skills[key]
                merged_map[node["id"]] = prev_id
                logger.info(f"[OPTIMIZER] Merging duplicate node '{node['id']}' into '{prev_id}'")
                continue
            seen_skills[key] = node["id"]
            
            # Fix dependencies if pointing to merged nodes
            deps = node.get("depends_on", node.get("deps", []))
            updated_deps = [merged_map.get(d, d) for d in deps]
            node["depends_on"] = updated_deps
            optimized_nodes.append(node)

        # Step 2: Auto-insert Edge Verifier Nodes for Critical Side-Effects
        final_nodes = []
        final_edges = []
        verifier_count = 0

        for node in optimized_nodes:
            skill = node.get("skill")
            
            if skill in CRITICAL_SIDE_EFFECT_SKILLS:
                # Auto-insert lightweight verifier node ahead of side-effect
                verifier_id = f"verify_{node['id']}"
                verifier_count += 1
                
                verifier_node = {
                    "id": verifier_id,
                    "skill": "core.verify",
                    "inputs": {
                        "target_node": node["id"],
                        "target_skill": skill,
                        "payload": node.get("inputs", {})
                    },
                    "depends_on": list(node.get("depends_on", [])),
                    "is_verifier": True
                }
                final_nodes.append(verifier_node)
                
                # Make the critical node depend on its verifier
                node["depends_on"] = [verifier_id]
                final_nodes.append(node)
                
                final_edges.append({"from": verifier_id, "to": node["id"]})
            else:
                final_nodes.append(node)

        # Re-build edges list from node dependencies
        for node in final_nodes:
            for dep in node.get("depends_on", []):
                edge_pair = {"from": dep, "to": node["id"]}
                if edge_pair not in final_edges:
                    final_edges.append(edge_pair)

        # Step 3: Analyze Diamond Topologies & Fan-out / Fan-in Parallel Branches
        independent_branches = 0
        for n in final_nodes:
            if len(n.get("depends_on", [])) == 0:
                independent_branches += 1

        # Step 4: Cost and Latency Estimation (Using Execution Registry Benchmarks)
        from myca.execution.registry import ExecutionRegistry
        registry = ExecutionRegistry()

        total_bench_ms = 0.0
        for n in final_nodes:
            bench = registry.get_benchmark(n.get("skill", ""))
            total_bench_ms += bench.get("avg_latency_ms", 15.0)

        if independent_branches > 1:
            estimated_latency = total_bench_ms / independent_branches
        else:
            estimated_latency = total_bench_ms

        estimated_cost = len(final_nodes) * 0.001

        result_plan = dict(plan_dict)
        result_plan["nodes"] = final_nodes
        result_plan["edges"] = final_edges
        result_plan["metrics"] = {
            "estimated_cost": round(estimated_cost, 4),
            "estimated_latency_ms": round(estimated_latency, 2),
            "parallel_branches": independent_branches,
            "verifiers_inserted": verifier_count,
            "optimized": True
        }
        return result_plan

