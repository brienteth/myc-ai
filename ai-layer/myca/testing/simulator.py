class NodeSimulator:
    """
    Simulates a network node for colony testing.
    Uses an isolated namespace to mock mDNS discovery and P2P comms.
    """
    def __init__(self, node_id: str, role: str = "inference", port: int = 0):
        self.node_id = node_id
        self.role = role
        self.port = port
        self.capabilities = []

    async def start(self):
        pass

    async def stop(self):
        pass


class FakeCapabilityNode(NodeSimulator):
    """
    Simulates a specialized node (e.g. GPU, Desktop, Mobile) broadcasting specific capabilities.
    """
    def __init__(self, node_id: str, capabilities: list[str]):
        super().__init__(node_id, role="worker")
        self.capabilities = capabilities

    async def broadcast_capabilities(self):
        # Implementation for test environment capability broadcast
        pass
