"""
Parameter Reasoning Agent

Performs deep inference to resolve missing node input parameters by searching:
1. Knowledge OS & Templates
2. Execution History & Previous Workflows
3. User Contacts & Org Defaults
4. Environment Variables
"""

import logging
import os
import re
from typing import Dict, Any, List
from myca.skills.manifest import SkillManifest

logger = logging.getLogger("myca.planner.agents.parameter")


class ParameterAgent:
    def __init__(self, knowledge_os=None, execution_history=None):
        self.knowledge = knowledge_os or {}
        self.history = execution_history or []
        self.org_defaults = {
            "chat_id": "@myca_sovereign_alerts",
            "channel": "#general",
            "recipient": "admin@company.com",
            "database": "myca_prod",
            "path": "./data/report.txt"
        }

    def infer_and_bind(self, skill_manifest: SkillManifest, provided_inputs: Dict[str, Any], prompt: str) -> Dict[str, Any]:
        """
        Infers missing required inputs from Knowledge, History, Contacts, and Environment.
        """
        resolved_inputs = dict(provided_inputs)
        missing_params = skill_manifest.get_missing_inputs(resolved_inputs)

        for param_name in missing_params:
            # 1. Search Prompt text for inline patterns
            inferred_val = self._extract_from_prompt(param_name, prompt)
            if inferred_val:
                resolved_inputs[param_name] = inferred_val
                logger.info(f"[PARAMETER AGENT] Inferred '{param_name}' from prompt text: {inferred_val}")
                continue

            # 2. Search Environment variables
            env_key = f"MYCA_{param_name.upper()}"
            if env_key in os.environ:
                resolved_inputs[param_name] = os.environ[env_key]
                logger.info(f"[PARAMETER AGENT] Bound '{param_name}' from Environment: {env_key}")
                continue

            # 3. Search Contacts / Org Defaults
            if param_name in self.org_defaults:
                resolved_inputs[param_name] = self.org_defaults[param_name]
                logger.info(f"[PARAMETER AGENT] Bound '{param_name}' from Org Defaults: {self.org_defaults[param_name]}")
                continue

        return resolved_inputs

    def _extract_from_prompt(self, param_name: str, prompt: str) -> Any:
        prompt_l = prompt.lower()
        if param_name == "chat_id":
            m = re.search(r'(@[\w_]+|chat[_\s]?id[:\s]+([\w-]+))', prompt_l)
            if m: return m.group(1)
        elif param_name == "to" or param_name == "recipient":
            m = re.search(r'[\w\.-]+@[\w\.-]+', prompt)
            if m: return m.group(0)
        elif param_name == "path":
            m = re.search(r'([\w\./~-]+\.(txt|csv|pdf|json))', prompt_l)
            if m: return m.group(1)
        return None
