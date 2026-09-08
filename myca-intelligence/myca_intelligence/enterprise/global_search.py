"""
Enterprise Global Search Service (⌘K)
Searches across all company entities: Invoices, Customers, Workflows, Drivers, Employees, Policies, Approvals, Secrets.
"""
from typing import List, Dict, Any

class GlobalSearchService:
    def __init__(self):
        self._index = [
            # Invoices
            {"id": "inv_9041", "type": "Invoice", "title": "INV-2026-9041 (Oracle ERP)", "subtitle": "$42,000 · Acme Steel Corp", "target_tab": "execution", "payload": {"amount": 42000}},
            {"id": "inv_9042", "type": "Invoice", "title": "INV-2026-9042 (QuickBooks)", "subtitle": "$18,500 · TechSupplies LLC", "target_tab": "execution", "payload": {"amount": 18500}},

            # Customers
            {"id": "cust_881", "type": "Customer", "title": "Acme Manufacturing (Salesforce)", "subtitle": "Enterprise Account · $1.4M ARR", "target_tab": "ontology"},
            {"id": "cust_882", "type": "Customer", "title": "Global Logistics Inc (HubSpot)", "subtitle": "Active Lead · 480 Seats", "target_tab": "ontology"},

            # Workflows
            {"id": "wf_101", "type": "Workflow", "title": "Purchase Order Automation DAG", "subtitle": "42% Progress · SAP -> Oracle -> Teams", "target_tab": "execution"},
            {"id": "wf_102", "type": "Workflow", "title": "Monthly General Ledger Reconciliation", "subtitle": "Scheduled Daily @ 02:00 UTC", "target_tab": "execution"},

            # Drivers
            {"id": "drv_sap", "type": "Driver", "title": "SAP Driver v1.4.2", "subtitle": "Healthy · 41ms Latency", "target_tab": "drivers"},
            {"id": "drv_oracle", "type": "Driver", "title": "Oracle ERP Driver v1.8.0", "subtitle": "Warning · High Queue Depth", "target_tab": "systems"},
            {"id": "drv_sf", "type": "Driver", "title": "Salesforce Driver v2.1.0", "subtitle": "Healthy · 38ms Latency", "target_tab": "drivers"},

            # Employees
            {"id": "emp_01", "type": "Employee", "title": "Jane Doe (CFO)", "subtitle": "Financial Passkey Approver", "target_tab": "approvals"},
            {"id": "emp_02", "type": "Employee", "title": "Alex Smith (Lead Ops)", "subtitle": "Workflow Studio Administrator", "target_tab": "audit"},

            # Policies
            {"id": "pol_bud", "type": "Policy", "title": "Purchase Approval Threshold ($10k)", "subtitle": "Budget Policy · 1,420 Checks", "target_tab": "policies"},
            {"id": "pol_gdpr", "type": "Policy", "title": "EU/GDPR Data Residency Rule", "subtitle": "Compliance · Enforced", "target_tab": "policies"},

            # Approvals
            {"id": "appr_101", "type": "Approval", "title": "High-Value Invoice Approval ($42,000)", "subtitle": "Pending CFO Authorization", "target_tab": "approvals"},

            # Secrets
            {"id": "sec_01", "type": "Secret", "title": "SAP_PROD_OAUTH_TOKEN", "subtitle": "macOS Keychain · Rotated 2d ago", "target_tab": "secrets"}
        ]

    def search(self, query: str) -> List[Dict[str, Any]]:
        if not query or not query.strip():
            return self._index[:6]

        q = query.lower().strip()
        results = []
        for item in self._index:
            if q in item["title"].lower() or q in item["subtitle"].lower() or q in item["type"].lower():
                results.append(item)
        return results

global_search_service = GlobalSearchService()
