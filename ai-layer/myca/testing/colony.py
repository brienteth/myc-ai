import asyncio
from typing import List
from myca.testing.simulator import NodeSimulator, FakeCapabilityNode

class SimulatedColony:
    """
    Simulates a network of Myca nodes.
    Used for local testing of distributed execution, planner routing, and capability graphs.
    """
    def __init__(self):
        self.nodes: List[NodeSimulator] = []

    def add_node(self, node: NodeSimulator):
        self.nodes.append(node)

    async def start_all(self):
        for node in self.nodes:
            await node.start()

    async def stop_all(self):
        for node in self.nodes:
            await node.stop()

    def get_node(self, node_id: str):
        for node in self.nodes:
            if node.node_id == node_id:
                return node
        return None
