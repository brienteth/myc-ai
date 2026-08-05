"""
Myca Planner v3 — Execution Intelligence & Multi-Agent Autonomous Engine

Coordinates the Multi-Agent Mesh:
1. Intent Agent -> Vendor-neutral Intent Graph
2. Capability Agent -> Abstract Capability Mapping
3. Parameter Agent -> Knowledge, Contacts & Env Reasoning
4. Security Agent -> Multi-Layer Credential Resolver (Keychain, Env, Vault)
5. Cost Agent -> Compute Dispatch (Local MLX, Colony Mesh, 0G Compute)
6. Graph Agent -> Multi-Candidate Candidate Graphs (Candidates A, B, C, D)
7. Critic Agent -> Graph Critique & Hallucination Check
8. Repair Agent -> Iterative Auto-Graph Repair
9. Simulation Agent -> Mock Sandbox Execution
10. Quality Scorer -> 8-Metric Quality Index (Score >= 96/100)
11. Learning Engine -> Evolution Feedback to Knowledge OS
"""

import logging
from typing import Dict, Any, List, Optional
from myca.planner.agents.intent_agent import IntentAgent, IntentGraph
from myca.planner.agents.capability_agent import CapabilityAgent, CapabilityGraph
from myca.planner.agents.parameter_agent import ParameterAgent
from myca.planner.agents.security_agent import SecurityAgent
from myca.planner.agents.cost_agent import CostAgent
from myca.planner.agents.graph_agent import GraphAgent, CandidateGraph
from myca.planner.agents.critic_agent import CriticAgent
from myca.planner.agents.repair_agent import RepairAgent
from myca.planner.agents.simulation_agent import SimulationAgent
from myca.planner.quality_scorer import QualityScorer, GraphQualityReport
from myca.planner.learning_engine import LearningEngine
from myca.planner.compiler import ExecutionCompiler
from myca.skills.core.registry import SkillRegistry
from myca.skills.manifest import SkillManifest

logger = logging.getLogger("myca.planner")


class Planner:
    def __init__(self, inference_backend=None, secrets_vault=None):
        self.inference = inference_backend
        self.intent_agent = IntentAgent()
        self.capability_agent = CapabilityAgent()
        self.parameter_agent = ParameterAgent()
        self.security_agent = SecurityAgent(secrets_vault=secrets_vault)
        self.cost_agent = CostAgent()
        self.graph_agent = GraphAgent()
        self.critic_agent = CriticAgent()
        self.repair_agent = RepairAgent()
        self.simulation_agent = SimulationAgent()
        self.scorer = QualityScorer(target_score_threshold=96.0)
        self.learning_engine = LearningEngine()
        self.compiler = ExecutionCompiler()

    async def create_plan(self, need_prompt: str, available_skills: Optional[List[dict]] = None) -> dict:
        """
        Planner v3 Multi-Agent Autonomous Pipeline
        """
        logger.info(f"[PLANNER V3 MULTI-AGENT MESH] Executing Multi-Agent Pipeline for: '{need_prompt[:60]}'")

        # Step 1: Intent Agent -> Extract Vendor-Neutral Intent Graph
        intent_graph: IntentGraph = self.intent_agent.extract_intents(need_prompt)

        # Step 2: Capability Agent -> Map to Abstract Capabilities
        cap_graph: CapabilityGraph = self.capability_agent.map_intents_to_capabilities(intent_graph)

        # Step 3: Graph Agent -> Multi-Candidate Candidate Graph Generation
        candidates: List[CandidateGraph] = self.graph_agent.generate_candidates(cap_graph)

        selected_candidate: Optional[CandidateGraph] = None
        best_score_report: Optional[GraphQualityReport] = None

        # Process each candidate through Parameter, Security, Critic, Repair, Simulation & Quality Scorer
        for cand in candidates:
            # Parameter Agent & Security Agent Binding
            repaired_nodes = []
            for node in cand.nodes:
                n = dict(node)
                skill_id = n.get("skill", "core.chat")
                inputs = dict(n.get("inputs", {}))

                manifest_dict = SkillRegistry.get_manifest(skill_id)
                manifest = SkillManifest(**manifest_dict)

                # Parameter Reasoning
                inputs = self.parameter_agent.infer_and_bind(manifest, inputs, need_prompt)

                # Multi-Layer Credential Binding
                creds = self.security_agent.resolve_all_credentials(manifest.required_credentials)
                inputs.update(creds)

                n["inputs"] = inputs
                repaired_nodes.append(n)

            cand.nodes = repaired_nodes

            # Critic Agent Review
            critic_review = self.critic_agent.critique_candidate(cand)

            # Repair Agent Cycle if flaws found
            if not critic_review.is_approved:
                cand = self.repair_agent.repair_graph(cand, critic_review)
                critic_review = self.critic_agent.critique_candidate(cand)

            # Simulation Agent Sandbox Execution
            sim_result = self.simulation_agent.simulate_execution(cand)

            # Quality Scorer Evaluation (8 Metrics)
            quality_report = self.scorer.score_graph(cand, critic_review, sim_result)
            cand.quality_score = quality_report.overall_score

            if selected_candidate is None or quality_report.overall_score > best_score_report.overall_score:
                selected_candidate = cand
                best_score_report = quality_report

        # Lower Selected Candidate AST -> IR -> Target DAG
        ast_payload = {
            "intent": intent_graph.user_prompt[:40],
            "nodes": selected_candidate.nodes
        }
        dag = self.compiler.compile_ast_to_dag(ast_payload)

        # Attach v3 Execution Intelligence Metadata
        dag["candidate_selected"] = selected_candidate.candidate_id
        dag["quality_score"] = best_score_report.overall_score
        dag["quality_breakdown"] = best_score_report.metrics_breakdown
        dag["is_valid"] = best_score_report.passed_threshold

        # Post-execution learning simulation update
        self.learning_engine.record_execution_outcome(dag["id"], dag["is_valid"], selected_candidate.estimated_latency_ms, retries=0)

        logger.info(f"[PLANNER V3] Selected {selected_candidate.candidate_id} with Quality Score {best_score_report.overall_score}/100.")
        return dag
