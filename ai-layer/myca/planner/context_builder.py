"""
Myca Context Builder

Mediates between User Need, Execution Registry, Experience Memory, and the Planner.
The Planner NEVER queries anything directly; ContextBuilder prepares a complete,
deterministic, structured execution context for the LLM.

Context Assembly:
  Need Prompt
      │
  ContextBuilder
      ├── ExecutionRegistry (Skills, ABIs, Hardware, Policies)
      ├── ExperienceMemory (Past successful plans & DOM selectors)
      └── System Metrics (CPU/RAM/GPU status)
      │
  Structured Prompt Package ──► Planner (LLM)
"""

import json
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

from myca.execution.registry import ExecutionRegistry, KnowledgeBundle
from myca.experience.memory import ExperienceMemory

logger = logging.getLogger("myca.planner.context_builder")


@dataclass
class PlannerContext:
    """Complete, structured context package prepared for the Planner."""
    need_prompt: str
    knowledge_bundle: KnowledgeBundle
    past_experiences: List[Dict[str, Any]]
    system_capabilities: Dict[str, Any]

    def build_system_prompt(self, available_skills: List[dict]) -> str:
        """Renders a deterministic, fully enriched system prompt for the Planner LLM."""
        return f"""You are the Myca Execution OS Planner.
You translate user Needs into a deterministic Execution Graph (DAG).
Output ONLY valid JSON. No conversational text.

Available OS Skills:
{json.dumps(available_skills, indent=2)}

Execution Registry Knowledge Bundle (Versioned ABIs, Hardware, Policies):
{json.dumps(self.knowledge_bundle.to_dict(), indent=2)}

Historical Success Patterns (Experience Memory):
{json.dumps(self.past_experiences, indent=2)}

Output Format:
{{
    "nodes": [
        {{"id": "A", "skill": "skill.name", "inputs": {{"param": "val"}}, "deps": []}}
    ]
}}
"""


class ContextBuilder:
    """
    Context assembly engine. Prepares all registry, memory, and telemetry data for Planning.
    """

    def __init__(self, registry: Optional[ExecutionRegistry] = None, memory: Optional[ExperienceMemory] = None):
        self.registry = registry or ExecutionRegistry()
        self.memory = memory or ExperienceMemory()

    def build_context(self, need_prompt: str, available_skills: List[dict]) -> PlannerContext:
        """Assembles a full PlannerContext object for the given prompt."""
        logger.info(f"[CONTEXT BUILDER] Assembling context for prompt: '{need_prompt[:40]}...'")

        # 1. Fetch Knowledge Bundle from OS Execution Registry
        bundle = self.registry.get_bundle_for_intent(need_prompt)

        # 2. Fetch Past Experiences from Experience Memory
        past_exps = []
        try:
            matched_dag, confidence = self.memory.rank_candidate_dags(need_prompt, [])
            if matched_dag:
                past_exps.append({"dag": matched_dag, "confidence": confidence})
        except Exception:
            pass

        # 3. System capabilities
        capabilities = {"offline_ready": True, "sandbox_mode": "isolated"}

        return PlannerContext(
            need_prompt=need_prompt,
            knowledge_bundle=bundle,
            past_experiences=past_exps,
            system_capabilities=capabilities,
        )
