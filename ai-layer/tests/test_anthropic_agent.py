"""
Unit tests for Anthropic Agent architecture skill package in MYCA.
"""
import unittest
import asyncio
from myca.skills.core.registry import SkillRegistry
from myca.skills.packages.anthropic_agent import (
    run_anthropic_agent,
    run_orchestrator_worker,
    run_evaluator_optimizer
)

class TestAnthropicAgentSkills(unittest.TestCase):

    def setUp(self):
        SkillRegistry._ensure_loaded()

    def test_skills_registration(self):
        """Verify registration of all 3 Anthropic Agent skills."""
        registered_ids = SkillRegistry._skills.keys()
        self.assertIn("anthropic.agent", registered_ids)
        self.assertIn("anthropic.orchestrator_worker", registered_ids)
        self.assertIn("anthropic.evaluator_optimizer", registered_ids)

    def test_autonomous_agent(self):
        """Test Thought-Action-Observation loop execution."""
        async def run_test():
            res = await run_anthropic_agent(None, task_prompt="Analyze open source LLM benchmarks", max_steps=3)
            self.assertTrue(res.success)
            self.assertIn("final_output", res.outputs)
            self.assertGreater(res.outputs["steps_executed"], 0)
            self.assertIsInstance(res.outputs["execution_trace"], list)
        
        asyncio.run(run_test())

    def test_orchestrator_worker(self):
        """Test Orchestrator-Worker multi-agent decomposition."""
        async def run_test():
            res = await run_orchestrator_worker(None, goal="Prepare quarterly AI report", worker_types=["researcher", "writer"])
            self.assertTrue(res.success)
            self.assertIn("consolidated_response", res.outputs)
            self.assertEqual(len(res.outputs["subtasks"]), 2)

        asyncio.run(run_test())

    def test_evaluator_optimizer(self):
        """Test Evaluator-Optimizer quality refinement loop."""
        async def run_test():
            res = await run_evaluator_optimizer(None, task="Draft executive summary", quality_criteria="High clarity and accuracy", max_refinements=3)
            self.assertTrue(res.success)
            self.assertTrue(res.outputs["passed"])
            self.assertGreaterEqual(res.outputs["evaluation_score"], 0.9)

        asyncio.run(run_test())

if __name__ == "__main__":
    unittest.main()
