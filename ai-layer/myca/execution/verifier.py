"""
Myca Execution Verifier (Post-Execution)

IMPORTANT DISTINCTION:
  Validator = PRE-execution (Type, Permission, Policy, Capability checks)
  Verifier  = POST-execution (Output valid? JSON bozuk? PDF oluştu? Mail gitti?)

Pipeline position:
  Validator → Runtime → Verifier

The Verifier inspects actual outputs AFTER a node finishes.
If verification fails, the node is marked FAILED and the error is recorded.
"""

import os
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("myca.execution.verifier")


class VerificationResult:
    def __init__(self, passed: bool, checks: List[Dict[str, Any]] = None):
        self.passed = passed
        self.checks = checks or []

    def to_dict(self) -> dict:
        return {"passed": self.passed, "checks": self.checks}


class ExecutionVerifier:
    """
    Post-execution output verifier.
    Runs after each node completes and validates its outputs.
    """

    def verify(self, skill_id: str, inputs: dict, outputs: dict) -> VerificationResult:
        """
        Run all applicable verification checks for a given skill execution.
        Returns VerificationResult with pass/fail and details.
        """
        checks = []

        # 1. Output existence check
        if outputs is None:
            checks.append({"check": "output_exists", "passed": False, "reason": "Output is None"})
            return VerificationResult(passed=False, checks=checks)
        checks.append({"check": "output_exists", "passed": True})

        # 2. Error field check
        if isinstance(outputs, dict) and outputs.get("error"):
            checks.append({"check": "no_error_field", "passed": False, "reason": f"Error in output: {outputs['error']}"})
            return VerificationResult(passed=False, checks=checks)
        checks.append({"check": "no_error_field", "passed": True})

        # 3. Skill-specific verifications
        if skill_id.startswith("fs.write") or skill_id == "table.write":
            checks.extend(self._verify_file_write(inputs, outputs))

        elif skill_id == "communication.send":
            checks.extend(self._verify_communication(inputs, outputs))

        elif "json" in skill_id or (isinstance(outputs, dict) and "json" in str(outputs.get("type", ""))):
            checks.extend(self._verify_json_output(outputs))

        elif skill_id.startswith("document") or skill_id.startswith("pdf"):
            checks.extend(self._verify_document_output(inputs, outputs))

        # Overall pass
        all_passed = all(c.get("passed", True) for c in checks)
        return VerificationResult(passed=all_passed, checks=checks)

    # ── Skill-specific verifiers ──────────────────────────────

    def _verify_file_write(self, inputs: dict, outputs: dict) -> List[dict]:
        """Verify that a file was actually written to disk."""
        checks = []
        path = inputs.get("path") or outputs.get("path", "")
        if path:
            exists = os.path.exists(os.path.expanduser(path))
            checks.append({
                "check": "file_exists_on_disk",
                "passed": exists,
                "reason": f"File {'exists' if exists else 'NOT FOUND'} at {path}",
            })
            if exists:
                size = os.path.getsize(os.path.expanduser(path))
                checks.append({
                    "check": "file_not_empty",
                    "passed": size > 0,
                    "reason": f"File size: {size} bytes",
                })
        return checks

    def _verify_communication(self, inputs: dict, outputs: dict) -> List[dict]:
        """Verify that a communication dispatch has a valid status."""
        checks = []
        status = outputs.get("status", "")
        sent = status.lower() in ("sent", "delivered", "ok", "success", "queued")
        checks.append({
            "check": "dispatch_status",
            "passed": sent,
            "reason": f"Dispatch status: {status}",
        })
        return checks

    def _verify_json_output(self, outputs: dict) -> List[dict]:
        """Verify JSON output is well-formed."""
        checks = []
        content = outputs.get("content") or outputs.get("data") or outputs.get("result")
        if content and isinstance(content, str):
            try:
                json.loads(content)
                checks.append({"check": "json_valid", "passed": True})
            except (json.JSONDecodeError, TypeError):
                checks.append({"check": "json_valid", "passed": False, "reason": "Malformed JSON in output"})
        else:
            checks.append({"check": "json_valid", "passed": True, "reason": "Content is already parsed"})
        return checks

    def _verify_document_output(self, inputs: dict, outputs: dict) -> List[dict]:
        """Verify document generation produced a real file."""
        checks = []
        path = outputs.get("path", "")
        if path:
            exists = os.path.exists(os.path.expanduser(path))
            checks.append({
                "check": "document_created",
                "passed": exists,
                "reason": f"Document {'created' if exists else 'NOT FOUND'} at {path}",
            })
        else:
            content = outputs.get("content", "")
            checks.append({
                "check": "document_content",
                "passed": bool(content),
                "reason": f"Document content length: {len(content) if content else 0}",
            })
        return checks
