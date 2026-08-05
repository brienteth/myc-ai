"""
Missing Requirement Detector Subsystem

Scans execution graph nodes against registered SkillManifest contracts.
Detects missing credentials (e.g. telegram_bot_token, google_oauth_token)
and missing required input parameters before graph execution.
"""

import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from myca.skills.core.registry import SkillRegistry
from myca.skills.manifest import SkillManifest

logger = logging.getLogger("myca.planner.requirement_detector")


class NodeRequirementResult(BaseModel):
    node_id: str
    skill: str
    missing_credentials: List[str] = Field(default_factory=list)
    missing_inputs: List[str] = Field(default_factory=list)
    is_satisfied: bool = True


class MissingRequirementReport(BaseModel):
    has_missing: bool = False
    unresolved_credentials: List[str] = Field(default_factory=list)
    unresolved_inputs: Dict[str, List[str]] = Field(default_factory=dict)
    node_reports: List[NodeRequirementResult] = Field(default_factory=list)


class RequirementDetector:
    def __init__(self, secrets_vault: Optional[Dict[str, Any]] = None):
        self.secrets_vault = secrets_vault or {}

    def scan_graph(self, ast_graph: Dict[str, Any]) -> MissingRequirementReport:
        """
        Scans all nodes in the AST execution graph.
        Cross-references node skills with registered SkillManifests.
        """
        nodes = ast_graph.get("nodes", [])
        report = MissingRequirementReport()

        for node in nodes:
            node_id = node.get("id", "unknown")
            skill_id = node.get("skill") or node.get("call") or "core.chat"
            inputs = node.get("inputs") or node.get("args") or {}

            manifest_dict = SkillRegistry.get_manifest(skill_id)
            manifest = SkillManifest(**manifest_dict)

            # Check credentials in Secrets Vault
            missing_creds = manifest.get_missing_credentials(self.secrets_vault)
            
            # Check inputs
            missing_in = manifest.get_missing_inputs(inputs)

            node_res = NodeRequirementResult(
                node_id=node_id,
                skill=skill_id,
                missing_credentials=missing_creds,
                missing_inputs=missing_in,
                is_satisfied=(len(missing_creds) == 0 and len(missing_in) == 0)
            )

            if not node_res.is_satisfied:
                report.has_missing = True
                for cred in missing_creds:
                    if cred not in report.unresolved_credentials:
                        report.unresolved_credentials.append(cred)
                if missing_in:
                    report.unresolved_inputs[node_id] = missing_in

            report.node_reports.append(node_res)

        logger.info(f"[REQUIREMENT DETECTOR] Scan complete. Has missing: {report.has_missing} (Missing creds: {len(report.unresolved_credentials)})")
        return report
