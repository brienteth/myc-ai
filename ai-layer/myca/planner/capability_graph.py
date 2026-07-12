"""
Capability Graph

Tracks what skills are available on the network mesh.
Nodes broadcast `@skill` names instead of generic "inference".
"""
import time
import logging
from typing import Dict, List, Set

logger = logging.getLogger("myca.planner.capability")

class CapabilityGraph:
    def __init__(self):
        # Maps skill_name -> set of node_ids that can execute it
        self.skill_map: Dict[str, Set[str]] = {}
        
    def register_node_skills(self, node_id: str, skills: List[str]):
        """When a node is discovered, it advertises its deterministic skills."""
        for skill in skills:
            if skill not in self.skill_map:
                self.skill_map[skill] = set()
            self.skill_map[skill].add(node_id)
            
    def remove_node(self, node_id: str):
        for skill, nodes in self.skill_map.items():
            if node_id in nodes:
                nodes.remove(node_id)
                
    def get_nodes_for_skill(self, skill: str) -> List[str]:
        return list(self.skill_map.get(skill, set()))
