"""
Intent Automation Planner (Phase 3.0)
Converts user natural language descriptions into valid Workflow DAG graphs via local LLMs.
"""
import json
import logging
import uuid
import time
from typing import Dict, Any
from myca.skills.core.registry import SkillRegistry

logger = logging.getLogger("myca.automation.planner")

class AutomationPlanner:
    def __init__(self, inference_engine):
        self.inference = inference_engine

    async def plan_intent(self, user_prompt: str) -> dict:
        """
        Interprets natural language request to generate a structured Workflow schema JSON.
        """
        # Get all registered skills for LLM context mapping
        available_skills = SkillRegistry.get_manifests()
        
        system_prompt = f"""You are the Myca Automation Architect.
Your task is to translate a user's automation request into a strict, validated Workflow JSON DAG.
You MUST output ONLY valid JSON matching the format below. No markdown wrappers, no formatting text, no trailing comments.

Format:
{{
    "name": "Human-friendly Workflow Title",
    "description": "Short explanation",
    "trigger": {{
        "type": "interval" | "clipboard" | "folder_watch",
        "interval": 60,
        "regex": ".*",
        "path": "~/Downloads"
    }},
    "variables": {{}},
    "nodes": [
        {{
            "id": "node_id_A",
            "skill": "skill_name",
            "inputs": {{
                "param_name": "constant_value" or "{{{{variables.var_name}}}}" or "{{{{nodes.node_id_A.outputs.field}}}}"
            }},
            "depends_on": [],
            "retry": 0,
            "continue_on_error": false
        }}
    ],
    "edges": [
        {{
            "from": "node_id_A",
            "to": "node_id_B",
            "condition": null
        }}
    ],
    "permissions": ["fs", "network"]
}}

Available system skills to select from:
{json.dumps(available_skills, indent=2)}

Requirements:
1. Always resolve values using curly braces (e.g. {{{{variables.clipboard}}}} or {{{{nodes.A.response}}}}) for data pipes.
2. Select closest matching skills (like 'fs.read', 'core.chat', 'library.search').
3. Strictly format the JSON response. Do not include markdown codeblocks (e.g., ```json). Just start directly with {{.
"""

        logger.info(f"[PLANNER] Querying LLM to plan intent: {user_prompt[:60]}...")
        
        try:
            # Generate JSON via inference engine
            raw_response = await self.inference.generate(user_prompt, system_prompt=system_prompt)
            raw_response = raw_response.strip()

            # Clean markdown code block wraps if LLM outputted them anyway
            if raw_response.startswith("```"):
                lines = raw_response.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                raw_response = "\n".join(lines).strip()

            workflow_json = json.loads(raw_response)
            
            # Inject mandatory IDs
            workflow_json["id"] = f"flow-{uuid.uuid4().hex[:8]}"
            workflow_json["enabled"] = False  # Start disabled for review
            workflow_json["created_at"] = time.time()
            workflow_json["updated_at"] = time.time()
            
            return workflow_json
        except Exception as e:
            logger.error(f"[PLANNER] Fallback simulation trigger due to parsing error: {e}")
            # Dynamic heuristic fallback for testing & simulation stability
            fallback = self._generate_fallback(user_prompt)
            return fallback

    def _generate_fallback(self, prompt: str) -> dict:
        """Heuristic fallback generation if LLM fails to output strict JSON."""
        w_id = f"flow-{uuid.uuid4().hex[:8]}"
        now = time.time()

        if "clipboard" in prompt.lower() or "kopyala" in prompt.lower():
            return {
                "id": w_id,
                "name": "Auto OCR on Clipboard",
                "description": "Reads matching clipboard data and runs local AI summary.",
                "enabled": False,
                "trigger": {"type": "clipboard", "regex": ".*"},
                "variables": {},
                "nodes": [
                    {
                        "id": "A",
                        "skill": "core.chat",
                        "inputs": {"prompt": "Summarize this clipboard content: {{variables.clipboard}}"},
                        "depends_on": []
                    }
                ],
                "edges": [],
                "permissions": ["network"],
                "created_at": now,
                "updated_at": now
            }
        else:
            return {
                "id": w_id,
                "name": "Periodic Library Backup",
                "description": "Daily trigger checking library stats.",
                "enabled": False,
                "trigger": {"type": "interval", "interval": 3600},
                "variables": {},
                "nodes": [
                    {
                        "id": "A",
                        "skill": "library.history",
                        "inputs": {},
                        "depends_on": []
                    }
                ],
                "edges": [],
                "permissions": ["library"],
                "created_at": now,
                "updated_at": now
            }
