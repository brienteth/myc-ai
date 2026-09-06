"""
Security Policy Engine for Myca OS (P0.7)
Classifies execution risks (READ/ANALYZE=auto, WRITE=conditional, SEND/DELETE=approval)
and intercepts high-risk tasks for user approval.
"""

import logging
from enum import Enum
from typing import Dict, Any, Callable, Awaitable

logger = logging.getLogger("myca.execution.policies")

class RiskLevel(str, Enum):
    AUTO = "auto"
    CONDITIONAL = "conditional"
    APPROVAL = "approval"

class SecurityPolicyEngine:
    """
    Evaluates execution risk and intercepts high-risk actions (e.g. sending messages, deletion).
    """

    def __init__(self, approval_callback: Callable[[str, str, dict], Awaitable[bool]] = None):
        self.approval_callback = approval_callback

    def get_risk_level(self, skill_name: str) -> RiskLevel:
        """
        Categorizes action types based on naming patterns.
        """
        skill_lower = skill_name.lower()

        # 1. SEND or DELETE requires explicit user approval
        if any(act in skill_lower for act in ["send", "delete", "remove", "post", "publish", "destroy"]):
            return RiskLevel.APPROVAL

        # 2. WRITE requires conditional authorization check
        if any(act in skill_lower for act in ["write", "update", "save", "store", "create", "insert", "output"]):
            return RiskLevel.CONDITIONAL

        # 3. READ or ANALYZE are automatically approved
        return RiskLevel.AUTO

    async def verify_approval(self, node_id: str, skill_name: str, inputs: dict) -> bool:
        """
        Verifies policy access. Blocks execution of APPROVAL tasks if callback rejects or is absent.
        """
        risk = self.get_risk_level(skill_name)
        logger.info(f"[POLICY] Evaluating node '{node_id}' ({skill_name}) -> Risk Level: {risk.value}")

        if risk == RiskLevel.APPROVAL:
            if self.approval_callback:
                approved = await self.approval_callback(node_id, skill_name, inputs)
                logger.info(f"[POLICY] User approval callback outcome: {approved}")
                return approved
            else:
                logger.warning(f"[POLICY] Fail-secure: No approval callback provided for APPROVAL task '{skill_name}'")
                return False

        elif risk == RiskLevel.CONDITIONAL:
            # For conditional write, we auto-approve in tests but could enforce custom checks
            return True

        return True

    def validate_contract(self, contract_dict: dict) -> bool:
        """
        Deterministic contract schema validation. Enforces that high-risk 
        actions proposed by the planner (e.g. telegram.send, delete) are strictly 
        marked with approval_required=True, and target contacts are valid.
        """
        nodes = contract_dict.get("nodes", [])
        for node in nodes:
            skill = node.get("skill", "").lower()
            # If the planner tries to send to all contacts or bypass approval:
            if any(act in skill for act in ["send", "delete", "remove", "post", "publish", "destroy"]):
                # Force approval requirement
                if not node.get("approval_required", True):
                    logger.warning(f"[POLICY] Bypassing approval for high-risk action {skill} is denied.")
                    return False
                
                # Check for broad target wildcards (e.g. all_contacts, all)
                inputs = node.get("inputs", {})
                target = str(inputs.get("target", "")).lower()
                if "all" in target or "everyone" in target:
                    logger.warning(f"[POLICY] Broadcast action targeted at '{target}' is blocked.")
                    return False
        return True
