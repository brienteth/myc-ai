"""
Unit Tests for Myca Planner v3 (Execution Intelligence & Multi-Agent Planning Engine)
"""

import unittest
import asyncio
from myca.planner.agents.intent_agent import IntentAgent
from myca.planner.agents.capability_agent import CapabilityAgent
from myca.planner.agents.parameter_agent import ParameterAgent
from myca.planner.agents.security_agent import SecurityAgent
from myca.planner.agents.cost_agent import CostAgent
from myca.planner.agents.graph_agent import GraphAgent
from myca.planner.agents.critic_agent import CriticAgent
from myca.planner.agents.repair_agent import RepairAgent
from myca.planner.agents.simulation_agent import SimulationAgent
from myca.planner.quality_scorer import QualityScorer
from myca.planner.learning_engine import LearningEngine
from myca.planner.planner import Planner


class TestPlannerV3(unittest.TestCase):

    def test_intent_agent_extraction(self):
        agent = IntentAgent()
        intent_graph = agent.extract_intents("Send Telegram notification and query Postgres database")
        self.assertEqual(len(intent_graph.intents), 2)
        action_types = [i.action_type for i in intent_graph.intents]
        self.assertIn("NOTIFY_USER", action_types)
        self.assertIn("QUERY_DATA", action_types)

    def test_security_agent_multi_layer_resolver(self):
        sec = SecurityAgent(secrets_vault={"telegram_bot_token": "vault_token_123"})
        val = sec.resolve_credential("telegram_bot_token")
        self.assertEqual(val, "vault_token_123")

    def test_cost_agent_dispatch(self):
        cost_agent = CostAgent()
        decision = cost_agent.evaluate_dispatch("Compute.Run", {"privacy_policy": "strict"})
        self.assertEqual(decision.target, "local")

    def test_critic_and_repair_agent(self):
        graph_agent = GraphAgent()
        critic = CriticAgent()
        repair = RepairAgent()

        intent_agent = IntentAgent()
        cap_agent = CapabilityAgent()

        intents = intent_agent.extract_intents("Send Telegram message")
        caps = cap_agent.map_intents_to_capabilities(intents)
        candidates = graph_agent.generate_candidates(caps)

        cand = candidates[0]
        review = critic.critique_candidate(cand)
        # Should detect missing chat_id
        self.assertFalse(review.is_approved)

        repaired_cand = repair.repair_graph(cand, review)
        review_after = critic.critique_candidate(repaired_cand)
        self.assertTrue(review_after.is_approved)

    def test_simulation_and_quality_scorer(self):
        sim = SimulationAgent()
        scorer = QualityScorer(target_score_threshold=80.0)

        graph_agent = GraphAgent()
        intent_agent = IntentAgent()
        cap_agent = CapabilityAgent()
        critic = CriticAgent()

        intents = intent_agent.extract_intents("Read file data.txt")
        caps = cap_agent.map_intents_to_capabilities(intents)
        cand = graph_agent.generate_candidates(caps)[0]

        review = critic.critique_candidate(cand)
        sim_res = sim.simulate_execution(cand)
        score_report = scorer.score_graph(cand, review, sim_res)

        self.assertGreaterEqual(score_report.overall_score, 80.0)
        self.assertTrue(score_report.passed_threshold)

    def test_full_planner_v3_pipeline(self):
        planner = Planner(secrets_vault={"telegram_bot_token": "token_999"})
        loop = asyncio.get_event_loop()
        dag = loop.run_until_complete(planner.create_plan("Send Telegram alert @mychannel Hello World"))

        self.assertIn("quality_score", dag)
        self.assertGreaterEqual(dag["quality_score"], 90.0)
        self.assertIn("candidate_selected", dag)


if __name__ == "__main__":
    unittest.main()
