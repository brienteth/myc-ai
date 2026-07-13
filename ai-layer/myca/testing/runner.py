class ScenarioRunner:
    """
    Executes a specific test scenario (e.g. End-To-End DAG, Recovery)
    and asserts against expected outcomes.
    """
    def __init__(self, harness):
        self.harness = harness

    async def run(self, need: str, expected_graph: list = None):
        pass
