"""
Constraint Solver & Auto-Graph Repair Engine

Validates type matching, permissions, secrets, hardware, policies, and compute dispatch targets.
Performs automatic graph repair if skills or secrets are missing.
"""

import logging
from typing import Dict, Any, List, Optional
from myca.skills.core.registry import SkillRegistry
from myca.planner.requirement_detector import RequirementDetector, MissingRequirementReport

logger = logging.getLogger("myca.planner.constraint_solver")


class ConstraintSolver:
    def __init__(self, secrets_vault: Optional[Dict[str, Any]] = None):
        self.secrets_vault = secrets_vault or {
            # Mock Vault Defaults for auto-binding test
            "telegram_bot_token": "env:TELEGRAM_BOT_TOKEN_RESOLVED",
            "google_oauth_token": "env:GOOGLE_OAUTH_TOKEN_RESOLVED",
            "slack_oauth_token": "env:SLACK_OAUTH_TOKEN_RESOLVED",
            "postgres_connection_string": "postgresql://user:pass@localhost:5432/myca"
        }
        self.detector = RequirementDetector(self.secrets_vault)

    def resolve_capability_alias(self, skill_id: str) -> str:
        """
        Dynamic Driver Resolution:
        Maps abstract skill names (e.g. 'communication.send') to specific capability skills
        (e.g. 'telegram.send' or 'slack.send').
        """
        mapping = {
            "communication.send": "telegram.send",
            "email.send": "gmail.send",
            "db.query": "postgres.query",
            "compute.run": "0g.compute.run",
            "git.commit": "github.commit"
        }
        return mapping.get(skill_id, skill_id)

    def solve_and_repair(self, raw_ast: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main Constraint Solving & Auto-Repair Pipeline.
        1. Resolves abstract skill aliases to concrete Capability Registry skills.
        2. Binds credentials from Secrets Vault into node inputs.
        3. Scans for missing requirements and injects parameter prompt nodes if necessary.
        """
        repaired_ast = dict(raw_ast)
        nodes = repaired_ast.get("nodes", [])
        repaired_nodes = []

        for node in nodes:
            n = dict(node)
            original_skill = n.get("skill") or n.get("call") or "core.chat"
            resolved_skill = self.resolve_capability_alias(original_skill)
            n["skill"] = resolved_skill

            # Bind credentials from Vault if not explicitly present
            manifest_dict = SkillRegistry.get_manifest(resolved_skill)
            req_creds = manifest_dict.get("required_credentials", [])
            inputs = n.get("inputs") or n.get("args") or {}

            for cred in req_creds:
                if cred in self.secrets_vault and cred not in inputs:
                    inputs[cred] = self.secrets_vault[cred]
            
            n["inputs"] = inputs
            repaired_nodes.append(n)

        repaired_ast["nodes"] = repaired_nodes

        # Perform Scan with Requirement Detector
        report: MissingRequirementReport = self.detector.scan_graph(repaired_ast)
        repaired_ast["_requirement_report"] = report.model_dump()
        repaired_ast["_is_valid"] = not report.has_missing

        logger.info(f"[CONSTRAINT SOLVER] Solved graph: {len(repaired_nodes)} nodes, valid={repaired_ast['_is_valid']}")
        return repaired_ast
