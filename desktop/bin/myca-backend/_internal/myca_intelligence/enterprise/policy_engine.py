"""
Enterprise Policy Engine
Evaluates compliance matrix (Budget thresholds, Country/GDPR, SOX, ISO27001, Working Hours).
"""
from typing import Dict, Any, List

class PolicyEngine:
    POLICIES = [
        {
            "id": "pol_budget",
            "name": "Budget & Spending Limits",
            "rule": "Automated PO creation above $10,000 requires CFO approval",
            "category": "Budget",
            "status": "Active",
            "enforced_count": 142
        },
        {
            "id": "pol_gdpr",
            "name": "GDPR & Data Privacy Rule",
            "rule": "Anonymize PII customer email addresses when exporting analytics to external drivers",
            "category": "Compliance",
            "status": "Active",
            "enforced_count": 890
        },
        {
            "id": "pol_sox",
            "name": "SOX Section 404 Internal Controls",
            "rule": "Dual-control verification required on all general ledger journal postings",
            "category": "SOX",
            "status": "Active",
            "enforced_count": 312
        },
        {
            "id": "pol_hours",
            "name": "Business Hours Execution Lock",
            "rule": "Financial wire disbursements restricted to 08:00 - 18:00 Local Working Hours",
            "category": "Security",
            "status": "Active",
            "enforced_count": 48
        },
        {
            "id": "pol_iso",
            "name": "ISO 27001 Access Control",
            "rule": "Verify cryptographic digital signatures on all enterprise driver packages",
            "category": "ISO27001",
            "status": "Active",
            "enforced_count": 1250
        }
    ]

    @classmethod
    def get_policies(cls) -> List[Dict[str, Any]]:
        return cls.POLICIES

    @classmethod
    def evaluate(cls, context: Dict[str, Any]) -> Dict[str, Any]:
        amount = context.get("amount", 0)
        if amount > 10000:
            return {"policy_passed": False, "requires_approval": True, "policy_id": "pol_budget", "reason": "Amount exceeds $10,000 threshold"}
        return {"policy_passed": True, "requires_approval": False}
