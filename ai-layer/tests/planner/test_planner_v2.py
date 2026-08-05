"""
Unit Tests for Myca Planner v2 (Capability-Driven Autonomous Planning)
"""

import unittest
import asyncio
from myca.skills.manifest import SkillManifest, InputParam
from myca.skills.core.registry import SkillRegistry
from myca.planner.requirement_detector import RequirementDetector
from myca.planner.constraint_solver import ConstraintSolver
from myca.planner.planner import Planner


class TestPlannerV2(unittest.TestCase):

    def test_skill_manifest_missing_credentials(self):
        manifest = SkillManifest(
            skill="telegram.send",
            required_credentials=["telegram_bot_token"],
            required_inputs=[InputParam(name="chat_id", required=True)]
        )
        # Vault missing token
        missing_creds = manifest.get_missing_credentials({})
        self.assertEqual(missing_creds, ["telegram_bot_token"])

        # Vault containing token
        missing_creds_resolved = manifest.get_missing_credentials({"telegram_bot_token": "token_123"})
        self.assertEqual(missing_creds_resolved, [])

    def test_requirement_detector_scan(self):
        detector = RequirementDetector(secrets_vault={})
        ast = {
            "nodes": [
                {
                    "id": "node_1",
                    "skill": "telegram.send",
                    "inputs": {"message": "Hello"}
                    # missing chat_id and telegram_bot_token
                }
            ]
        }
        report = detector.scan_graph(ast)
        self.assertTrue(report.has_missing)
        self.assertIn("telegram_bot_token", report.unresolved_credentials)
        self.assertIn("chat_id", report.unresolved_inputs["node_1"])

    def test_constraint_solver_auto_bind_vault(self):
        solver = ConstraintSolver(secrets_vault={"telegram_bot_token": "secret_vault_token"})
        raw_ast = {
            "nodes": [
                {
                    "id": "node_1",
                    "skill": "communication.send",
                    "inputs": {"chat_id": "@mychannel", "message": "Test"}
                }
            ]
        }
        solved = solver.solve_and_repair(raw_ast)
        node = solved["nodes"][0]

        # Alias resolved to telegram.send
        self.assertEqual(node["skill"], "telegram.send")
        # Vault token auto-bound
        self.assertEqual(node["inputs"]["telegram_bot_token"], "secret_vault_token")

    def test_planner_v2_compilation(self):
        planner = Planner(secrets_vault={"telegram_bot_token": "secret_vault_token"})
        loop = asyncio.get_event_loop()
        dag = loop.run_until_complete(planner.create_plan("Send Telegram notification chat_id:@mychannel Hello World"))

        self.assertIn("nodes", dag)
        self.assertGreater(len(dag["nodes"]), 0)
        # Verify node skill is concrete capability
        self.assertEqual(dag["nodes"][0]["skill"], "telegram.send")


if __name__ == "__main__":
    unittest.main()
