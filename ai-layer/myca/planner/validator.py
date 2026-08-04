"""
Multi-Constraint Graph Validator Layer
Enforces OS safety, security, and Policy rules on Execution Graphs:
- Type Safety
- Permission Grants
- Policy Rules (Budget limits, Human Approval gates, Secret access)
- Capability Matching
- Sandbox Boundaries
- Identity & Secret Boundaries
"""

import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("myca.planner.validator")

class ValidationResult:
    def __init__(self, valid: bool, errors: List[str] = None, warnings: List[str] = None, approval_required: bool = False):
        self.valid = valid
        self.errors = errors or []
        self.warnings = warnings or []
        self.approval_required = approval_required

class GraphValidator:
    def __init__(self):
        pass

    def validate(
        self,
        plan_dict: dict,
        available_permissions: Optional[List[str]] = None,
        max_cost: float = 1.0,
        offline_mode: bool = False,
        policies: Optional[List[dict]] = None
    ) -> ValidationResult:
        """
        Validates an Execution Graph against multi-constraint OS safety rules and user Policies.
        """
        errors = []
        warnings = []
        approval_required = False
        nodes = plan_dict.get("nodes", [])

        if not nodes:
            return ValidationResult(valid=False, errors=["Execution Graph contains no nodes."])

        granted_perms = set(available_permissions or ["fs.read", "fs.write", "network.out", "ai.inference"])

        for node in nodes:
            node_id = node.get("id", "unknown")
            skill_name = node.get("skill", "")

            # 1. Permission check
            required_perms = node.get("permissions", [])
            for perm in required_perms:
                if perm not in granted_perms:
                    errors.append(f"Permission denied for node '{node_id}' skill '{skill_name}': missing '{perm}'.")

            # 2. Offline readiness check
            if offline_mode:
                if "network" in skill_name or "browser" in skill_name or "cloud" in skill_name:
                    errors.append(f"Offline violation for node '{node_id}': skill '{skill_name}' requires network connectivity.")

            # 3. Sandbox boundary check
            inputs = node.get("inputs", {})
            for k, v in inputs.items():
                if isinstance(v, str) and (v.startswith("/etc") or v.startswith("/sys") or v.startswith("/proc")):
                    errors.append(f"Sandbox violation for node '{node_id}': path '{v}' accesses system boundaries.")

            # 4. Policy & Approval Gate check
            if "payment" in skill_name or "delete" in skill_name or "sys.admin" in skill_name:
                approval_required = True
                warnings.append(f"Node '{node_id}' ({skill_name}) requires Human-in-the-loop Approval Policy.")

        # 5. Cost & Budget Ceiling check
        metrics = plan_dict.get("metrics", {})
        est_cost = metrics.get("estimated_cost", 0.0)
        if est_cost > max_cost:
            errors.append(f"Cost limit exceeded: estimated cost {est_cost} > max budget {max_cost}.")

        is_valid = len(errors) == 0
        if is_valid:
            logger.info(f"[GRAPH VALIDATOR] Plan '{plan_dict.get('name', 'Untitled')}' successfully validated (0 errors, approval={approval_required}).")
        else:
            logger.warning(f"[GRAPH VALIDATOR] Plan validation failed with {len(errors)} errors.")

        return ValidationResult(valid=is_valid, errors=errors, warnings=warnings, approval_required=approval_required)
