"""
Enterprise Systems Service (Infrastructure Control Center)
Manages connected enterprise systems — health, objects, capabilities, permissions,
authentication, metrics, logs, and version information.
"""
import logging
import time
import random
from typing import Dict, Any, List, Optional

logger = logging.getLogger("myca.execution.enterprise.systems_service")

# ── Rich System Registry ───────────────────────────────────────────────────

SYSTEMS_REGISTRY: List[Dict[str, Any]] = [
    {
        "id": "sys_sap",
        "name": "SAP S/4HANA",
        "vendor": "SAP SE",
        "type": "ERP",
        "icon": "sap",
        "status": "Healthy",
        "latency_ms": 23,
        "version": "S/4HANA 2023 FPS02",
        "driver": "SAP Driver v1.4.2",
        "driver_id": "driver_sap",
        "connected_at": "2026-07-15T10:30:00Z",
        "last_seen": "2026-08-04T17:44:00Z",
        "sync_mode": "Realtime",
        "auth_type": "OAuth 2.0",
        "auth_status": "Connected",
        "objects_count": 143,
        "capabilities_count": 81,
        "availability": 99.99,
        "today_calls": 8420,
        "success_rate": 99.8,
        "errors_today": 14,
        "bandwidth_mb": 124.6,
        "cache_hit_rate": 87.2,
        "avg_payload_kb": 4.2,
        "cpu_percent": 12,
        "memory_percent": 34,
        "rate_limit_remaining": 9500,
        "rate_limit_max": 10000,
    },
    {
        "id": "sys_oracle",
        "name": "Oracle ERP Cloud",
        "vendor": "Oracle Corp",
        "type": "ERP",
        "icon": "oracle",
        "status": "Healthy",
        "latency_ms": 14,
        "version": "23c Release",
        "driver": "Oracle ERP Driver v1.8.0",
        "driver_id": "driver_oracle",
        "connected_at": "2026-07-18T08:00:00Z",
        "last_seen": "2026-08-04T17:43:00Z",
        "sync_mode": "Realtime",
        "auth_type": "Service Account",
        "auth_status": "Connected",
        "objects_count": 180,
        "capabilities_count": 96,
        "availability": 99.97,
        "today_calls": 6218,
        "success_rate": 99.9,
        "errors_today": 6,
        "bandwidth_mb": 98.3,
        "cache_hit_rate": 82.5,
        "avg_payload_kb": 5.1,
        "cpu_percent": 8,
        "memory_percent": 28,
        "rate_limit_remaining": 4800,
        "rate_limit_max": 5000,
    },
    {
        "id": "sys_salesforce",
        "name": "Salesforce CRM",
        "vendor": "Salesforce Inc",
        "type": "CRM",
        "icon": "salesforce",
        "status": "Warning",
        "latency_ms": 89,
        "version": "Spring '26",
        "driver": "Salesforce Driver v2.1.0",
        "driver_id": "driver_salesforce",
        "connected_at": "2026-07-20T14:00:00Z",
        "last_seen": "2026-08-04T17:42:00Z",
        "sync_mode": "Polling (30s)",
        "auth_type": "OAuth 2.0",
        "auth_status": "Connected",
        "objects_count": 95,
        "capabilities_count": 62,
        "availability": 99.85,
        "today_calls": 4102,
        "success_rate": 99.2,
        "errors_today": 32,
        "bandwidth_mb": 45.8,
        "cache_hit_rate": 91.0,
        "avg_payload_kb": 3.8,
        "cpu_percent": 22,
        "memory_percent": 41,
        "rate_limit_remaining": 7200,
        "rate_limit_max": 10000,
    },
    {
        "id": "sys_quickbooks",
        "name": "QuickBooks Online",
        "vendor": "Intuit",
        "type": "Finance",
        "icon": "quickbooks",
        "status": "Healthy",
        "latency_ms": 18,
        "version": "v3 API",
        "driver": "QuickBooks Online Driver v1.1.5",
        "driver_id": "driver_quickbooks",
        "connected_at": "2026-07-25T09:00:00Z",
        "last_seen": "2026-08-04T17:44:00Z",
        "sync_mode": "Webhook",
        "auth_type": "OAuth 2.0",
        "auth_status": "Connected",
        "objects_count": 42,
        "capabilities_count": 34,
        "availability": 99.95,
        "today_calls": 2450,
        "success_rate": 99.7,
        "errors_today": 7,
        "bandwidth_mb": 22.1,
        "cache_hit_rate": 78.4,
        "avg_payload_kb": 2.9,
        "cpu_percent": 5,
        "memory_percent": 18,
        "rate_limit_remaining": 450,
        "rate_limit_max": 500,
    },
    {
        "id": "sys_dynamics",
        "name": "Microsoft Dynamics 365",
        "vendor": "Microsoft",
        "type": "ERP",
        "icon": "dynamics",
        "status": "Healthy",
        "latency_ms": 31,
        "version": "Wave 2 2025",
        "driver": "Dynamics 365 Driver v1.2.0",
        "driver_id": "driver_dynamics",
        "connected_at": "2026-07-28T11:30:00Z",
        "last_seen": "2026-08-04T17:43:00Z",
        "sync_mode": "Realtime",
        "auth_type": "Azure AD",
        "auth_status": "Connected",
        "objects_count": 110,
        "capabilities_count": 58,
        "availability": 99.92,
        "today_calls": 3210,
        "success_rate": 99.6,
        "errors_today": 12,
        "bandwidth_mb": 67.4,
        "cache_hit_rate": 84.1,
        "avg_payload_kb": 4.5,
        "cpu_percent": 10,
        "memory_percent": 30,
        "rate_limit_remaining": 2800,
        "rate_limit_max": 3000,
    },
    {
        "id": "sys_hubspot",
        "name": "HubSpot",
        "vendor": "HubSpot Inc",
        "type": "CRM",
        "icon": "hubspot",
        "status": "Warning",
        "latency_ms": 112,
        "version": "v3 API",
        "driver": "HubSpot CRM Driver v2.2.1",
        "driver_id": "driver_hubspot",
        "connected_at": "2026-08-01T15:00:00Z",
        "last_seen": "2026-08-04T17:40:00Z",
        "sync_mode": "Polling (60s)",
        "auth_type": "API Key",
        "auth_status": "Connected",
        "objects_count": 38,
        "capabilities_count": 29,
        "availability": 99.70,
        "today_calls": 1840,
        "success_rate": 98.8,
        "errors_today": 22,
        "bandwidth_mb": 18.2,
        "cache_hit_rate": 72.0,
        "avg_payload_kb": 3.1,
        "cpu_percent": 18,
        "memory_percent": 35,
        "rate_limit_remaining": 800,
        "rate_limit_max": 1000,
    },
    {
        "id": "sys_google",
        "name": "Google Workspace",
        "vendor": "Google",
        "type": "Cloud",
        "icon": "google",
        "status": "Healthy",
        "latency_ms": 12,
        "version": "v1",
        "driver": "Google Workspace Driver v1.5.0",
        "driver_id": "driver_google",
        "connected_at": "2026-07-22T08:00:00Z",
        "last_seen": "2026-08-04T17:44:00Z",
        "sync_mode": "Webhook",
        "auth_type": "Service Account",
        "auth_status": "Connected",
        "objects_count": 24,
        "capabilities_count": 42,
        "availability": 99.99,
        "today_calls": 5640,
        "success_rate": 99.9,
        "errors_today": 3,
        "bandwidth_mb": 56.8,
        "cache_hit_rate": 95.2,
        "avg_payload_kb": 6.8,
        "cpu_percent": 3,
        "memory_percent": 12,
        "rate_limit_remaining": 9800,
        "rate_limit_max": 10000,
    },
    {
        "id": "sys_slack",
        "name": "Slack Enterprise",
        "vendor": "Slack / Salesforce",
        "type": "Cloud",
        "icon": "slack",
        "status": "Healthy",
        "latency_ms": 9,
        "version": "v2 Web API",
        "driver": "Slack Enterprise Driver v3.0.1",
        "driver_id": "driver_slack",
        "connected_at": "2026-08-01T10:00:00Z",
        "last_seen": "2026-08-04T17:44:00Z",
        "sync_mode": "Realtime (Socket)",
        "auth_type": "OAuth 2.0",
        "auth_status": "Connected",
        "objects_count": 28,
        "capabilities_count": 35,
        "availability": 99.98,
        "today_calls": 12800,
        "success_rate": 99.9,
        "errors_today": 4,
        "bandwidth_mb": 34.1,
        "cache_hit_rate": 88.4,
        "avg_payload_kb": 1.2,
        "cpu_percent": 2,
        "memory_percent": 8,
        "rate_limit_remaining": 28000,
        "rate_limit_max": 30000,
    },
    {
        "id": "sys_github",
        "name": "GitHub Enterprise",
        "vendor": "GitHub / Microsoft",
        "type": "Cloud",
        "icon": "github",
        "status": "Healthy",
        "latency_ms": 15,
        "version": "REST v3 + GraphQL v4",
        "driver": "GitHub Enterprise Driver v3.1.2",
        "driver_id": "driver_github",
        "connected_at": "2026-07-30T09:00:00Z",
        "last_seen": "2026-08-04T17:44:00Z",
        "sync_mode": "Webhook",
        "auth_type": "GitHub App",
        "auth_status": "Connected",
        "objects_count": 18,
        "capabilities_count": 26,
        "availability": 99.96,
        "today_calls": 3400,
        "success_rate": 99.8,
        "errors_today": 5,
        "bandwidth_mb": 12.6,
        "cache_hit_rate": 90.1,
        "avg_payload_kb": 2.4,
        "cpu_percent": 4,
        "memory_percent": 14,
        "rate_limit_remaining": 4500,
        "rate_limit_max": 5000,
    },
    {
        "id": "sys_jira",
        "name": "Jira Cloud",
        "vendor": "Atlassian",
        "type": "Cloud",
        "icon": "jira",
        "status": "Healthy",
        "latency_ms": 22,
        "version": "Cloud REST v3",
        "driver": "Jira Cloud Driver v1.9.0",
        "driver_id": "driver_jira",
        "connected_at": "2026-07-29T11:00:00Z",
        "last_seen": "2026-08-04T17:43:00Z",
        "sync_mode": "Webhook",
        "auth_type": "OAuth 2.0 (3LO)",
        "auth_status": "Connected",
        "objects_count": 32,
        "capabilities_count": 28,
        "availability": 99.91,
        "today_calls": 2100,
        "success_rate": 99.5,
        "errors_today": 10,
        "bandwidth_mb": 15.2,
        "cache_hit_rate": 86.0,
        "avg_payload_kb": 3.0,
        "cpu_percent": 6,
        "memory_percent": 20,
        "rate_limit_remaining": 900,
        "rate_limit_max": 1000,
    },
    {
        "id": "sys_stripe",
        "name": "Stripe Payments",
        "vendor": "Stripe Inc",
        "type": "Finance",
        "icon": "stripe",
        "status": "Healthy",
        "latency_ms": 11,
        "version": "2024-12-18.acacia",
        "driver": "Stripe Payments Driver v2.4.0",
        "driver_id": "driver_stripe",
        "connected_at": "2026-07-26T12:00:00Z",
        "last_seen": "2026-08-04T17:44:00Z",
        "sync_mode": "Webhook",
        "auth_type": "API Key (Restricted)",
        "auth_status": "Connected",
        "objects_count": 54,
        "capabilities_count": 45,
        "availability": 99.99,
        "today_calls": 7200,
        "success_rate": 99.9,
        "errors_today": 2,
        "bandwidth_mb": 28.4,
        "cache_hit_rate": 82.0,
        "avg_payload_kb": 1.8,
        "cpu_percent": 3,
        "memory_percent": 10,
        "rate_limit_remaining": 95,
        "rate_limit_max": 100,
    },
    {
        "id": "sys_netsuite",
        "name": "Oracle NetSuite",
        "vendor": "Oracle",
        "type": "ERP",
        "icon": "netsuite",
        "status": "Healthy",
        "latency_ms": 28,
        "version": "2026.1",
        "driver": "Oracle NetSuite Driver v1.3.0",
        "driver_id": "driver_netsuite",
        "connected_at": "2026-07-27T14:00:00Z",
        "last_seen": "2026-08-04T17:43:00Z",
        "sync_mode": "Realtime",
        "auth_type": "Token-Based Auth",
        "auth_status": "Connected",
        "objects_count": 88,
        "capabilities_count": 52,
        "availability": 99.94,
        "today_calls": 4800,
        "success_rate": 99.6,
        "errors_today": 18,
        "bandwidth_mb": 72.1,
        "cache_hit_rate": 80.0,
        "avg_payload_kb": 5.6,
        "cpu_percent": 14,
        "memory_percent": 32,
        "rate_limit_remaining": 2400,
        "rate_limit_max": 2500,
    },
    {
        "id": "sys_custom",
        "name": "Custom API Gateway",
        "vendor": "Internal",
        "type": "Custom",
        "icon": "custom",
        "status": "Healthy",
        "latency_ms": 6,
        "version": "v2.0.0",
        "driver": "Custom REST Driver v1.0.0",
        "driver_id": "driver_custom",
        "connected_at": "2026-08-02T16:00:00Z",
        "last_seen": "2026-08-04T17:44:00Z",
        "sync_mode": "Realtime",
        "auth_type": "API Key",
        "auth_status": "Connected",
        "objects_count": 12,
        "capabilities_count": 18,
        "availability": 99.99,
        "today_calls": 14200,
        "success_rate": 99.9,
        "errors_today": 1,
        "bandwidth_mb": 8.4,
        "cache_hit_rate": 96.0,
        "avg_payload_kb": 0.8,
        "cpu_percent": 1,
        "memory_percent": 6,
        "rate_limit_remaining": 50000,
        "rate_limit_max": 50000,
    }
]

# ── Per-System Objects ─────────────────────────────────────────────────────

SYSTEM_OBJECTS: Dict[str, List[Dict[str, Any]]] = {
    "sys_sap": [
        {"name": "Material", "fields": ["ID", "Description", "Plant", "Price", "Currency", "Stock", "UoM", "Category"], "record_count": 48200},
        {"name": "Vendor", "fields": ["ID", "Name", "Country", "PaymentTerms", "Rating", "Status"], "record_count": 3400},
        {"name": "Purchase Order", "fields": ["PO_Number", "Vendor_ID", "Items", "Total", "Currency", "Status", "Created"], "record_count": 12800},
        {"name": "Invoice", "fields": ["Invoice_Number", "Customer_ID", "Amount", "Tax", "Status", "Due_Date"], "record_count": 31400},
        {"name": "Warehouse", "fields": ["ID", "Name", "Location", "Capacity", "Utilization", "Manager"], "record_count": 18},
        {"name": "Ledger Entry", "fields": ["Entry_ID", "Account", "Debit", "Credit", "Date", "Reference", "Period"], "record_count": 284000},
        {"name": "Cost Center", "fields": ["ID", "Name", "Manager", "Budget", "Actual", "Variance"], "record_count": 120},
        {"name": "Profit Center", "fields": ["ID", "Name", "Revenue", "Costs", "Margin"], "record_count": 45},
    ],
    "sys_oracle": [
        {"name": "General Ledger", "fields": ["Journal_ID", "Account", "Debit", "Credit", "Period", "Entity"], "record_count": 520000},
        {"name": "Accounts Payable", "fields": ["Invoice_ID", "Supplier", "Amount", "Due_Date", "Status", "Currency"], "record_count": 28400},
        {"name": "Accounts Receivable", "fields": ["Invoice_ID", "Customer", "Amount", "Due_Date", "Status"], "record_count": 42000},
        {"name": "Fixed Asset", "fields": ["Asset_ID", "Name", "Category", "Book_Value", "Depreciation", "Location"], "record_count": 8200},
        {"name": "Project", "fields": ["Project_ID", "Name", "Manager", "Budget", "Spent", "Status", "Timeline"], "record_count": 340},
        {"name": "Employee", "fields": ["EMP_ID", "Name", "Department", "Title", "Hire_Date", "Salary_Grade"], "record_count": 14200},
    ],
    "sys_salesforce": [
        {"name": "Account", "fields": ["AccountId", "Name", "Industry", "Revenue", "Owner", "Stage"], "record_count": 24800},
        {"name": "Contact", "fields": ["ContactId", "Name", "Email", "Phone", "Account", "Title"], "record_count": 86400},
        {"name": "Opportunity", "fields": ["OppId", "Name", "Amount", "Stage", "CloseDate", "Probability"], "record_count": 12400},
        {"name": "Lead", "fields": ["LeadId", "Name", "Company", "Status", "Source", "Rating"], "record_count": 34200},
        {"name": "Case", "fields": ["CaseId", "Subject", "Status", "Priority", "Account", "Owner"], "record_count": 18600},
    ],
    "sys_quickbooks": [
        {"name": "Invoice", "fields": ["InvoiceNo", "Customer", "Amount", "Status", "DueDate", "Currency"], "record_count": 8400},
        {"name": "Bill", "fields": ["BillNo", "Vendor", "Amount", "DueDate", "Status"], "record_count": 4200},
        {"name": "Customer", "fields": ["CustomerID", "Name", "Email", "Balance", "Terms"], "record_count": 2800},
        {"name": "Chart of Accounts", "fields": ["AccountID", "Name", "Type", "SubType", "Balance"], "record_count": 180},
    ],
    "sys_slack": [
        {"name": "Channel", "fields": ["ChannelID", "Name", "Type", "Members", "Created"], "record_count": 240},
        {"name": "User", "fields": ["UserID", "Name", "Email", "Status", "Role"], "record_count": 1420},
        {"name": "Message", "fields": ["MessageID", "Channel", "Author", "Text", "Timestamp"], "record_count": 2800000},
    ],
}

# ── Per-System Capabilities ────────────────────────────────────────────────

SYSTEM_CAPABILITIES: Dict[str, List[Dict[str, Any]]] = {
    "sys_sap": [
        {"name": "inventory.read", "supported": True, "permission": "enterprise.inventory.read", "latency_ms": 19, "success_rate": 99.8},
        {"name": "inventory.update", "supported": True, "permission": "enterprise.inventory.write", "latency_ms": 34, "success_rate": 99.5},
        {"name": "purchase.create", "supported": True, "permission": "enterprise.procurement.create", "latency_ms": 42, "success_rate": 99.2},
        {"name": "invoice.read", "supported": True, "permission": "enterprise.finance.read", "latency_ms": 15, "success_rate": 99.9},
        {"name": "invoice.create", "supported": True, "permission": "enterprise.finance.write", "latency_ms": 38, "success_rate": 99.4},
        {"name": "ledger.read", "supported": True, "permission": "enterprise.finance.read", "latency_ms": 12, "success_rate": 99.9},
        {"name": "material.search", "supported": True, "permission": "enterprise.inventory.read", "latency_ms": 22, "success_rate": 99.7},
        {"name": "vendor.search", "supported": True, "permission": "enterprise.procurement.read", "latency_ms": 18, "success_rate": 99.8},
    ],
    "sys_oracle": [
        {"name": "ledger.read", "supported": True, "permission": "enterprise.finance.read", "latency_ms": 11, "success_rate": 99.9},
        {"name": "ledger.post", "supported": True, "permission": "enterprise.finance.write", "latency_ms": 28, "success_rate": 99.6},
        {"name": "invoice.create", "supported": True, "permission": "enterprise.finance.write", "latency_ms": 32, "success_rate": 99.5},
        {"name": "payment.approve", "supported": True, "permission": "enterprise.finance.approve", "latency_ms": 45, "success_rate": 99.1},
        {"name": "asset.read", "supported": True, "permission": "enterprise.asset.read", "latency_ms": 14, "success_rate": 99.8},
        {"name": "employee.search", "supported": True, "permission": "enterprise.hr.read", "latency_ms": 16, "success_rate": 99.7},
    ],
    "sys_salesforce": [
        {"name": "customer.search", "supported": True, "permission": "enterprise.crm.read", "latency_ms": 28, "success_rate": 99.2},
        {"name": "customer.create", "supported": True, "permission": "enterprise.crm.write", "latency_ms": 42, "success_rate": 98.8},
        {"name": "opportunity.read", "supported": True, "permission": "enterprise.crm.read", "latency_ms": 22, "success_rate": 99.4},
        {"name": "lead.create", "supported": True, "permission": "enterprise.crm.write", "latency_ms": 35, "success_rate": 99.0},
        {"name": "case.read", "supported": True, "permission": "enterprise.support.read", "latency_ms": 18, "success_rate": 99.5},
    ],
}

# ── Per-System Permissions ─────────────────────────────────────────────────

SYSTEM_PERMISSIONS: Dict[str, List[Dict[str, Any]]] = {
    "sys_sap": [
        {"scope": "enterprise.inventory.read", "label": "Read Inventory", "status": "Granted", "role": "Finance Admin"},
        {"scope": "enterprise.inventory.write", "label": "Write Inventory", "status": "Granted", "role": "Warehouse Manager"},
        {"scope": "enterprise.finance.read", "label": "Read Finance", "status": "Granted", "role": "Finance Admin"},
        {"scope": "enterprise.finance.write", "label": "Write Finance", "status": "Granted", "role": "Finance Admin"},
        {"scope": "enterprise.procurement.create", "label": "Create Purchase Orders", "status": "Granted", "role": "Procurement Manager"},
        {"scope": "enterprise.vendor.delete", "label": "Delete Vendor", "status": "Denied", "role": "System Admin"},
        {"scope": "enterprise.ledger.write", "label": "Write Ledger", "status": "Approval Required", "role": "CFO"},
    ],
    "sys_oracle": [
        {"scope": "enterprise.finance.read", "label": "Read Finance", "status": "Granted", "role": "Finance Admin"},
        {"scope": "enterprise.finance.write", "label": "Write Finance", "status": "Granted", "role": "Finance Admin"},
        {"scope": "enterprise.finance.approve", "label": "Approve Payments", "status": "Approval Required", "role": "CFO"},
        {"scope": "enterprise.asset.read", "label": "Read Assets", "status": "Granted", "role": "Asset Manager"},
        {"scope": "enterprise.hr.read", "label": "Read HR Data", "status": "Granted", "role": "HR Manager"},
    ],
    "sys_salesforce": [
        {"scope": "enterprise.crm.read", "label": "Read CRM", "status": "Granted", "role": "Sales Manager"},
        {"scope": "enterprise.crm.write", "label": "Write CRM", "status": "Granted", "role": "Sales Manager"},
        {"scope": "enterprise.support.read", "label": "Read Support Cases", "status": "Granted", "role": "Support Team"},
        {"scope": "enterprise.crm.delete", "label": "Delete CRM Records", "status": "Denied", "role": "System Admin"},
    ],
}

# ── Per-System Logs ────────────────────────────────────────────────────────

def _generate_logs(system_id: str) -> List[Dict[str, Any]]:
    """Generate realistic log entries for a system."""
    templates = {
        "sys_sap": [
            {"time": "09:21 AM", "event": "Connected to SAP S/4HANA", "level": "INFO"},
            {"time": "09:25 AM", "event": "Read Invoice INV-2026-9041 ($42,000)", "level": "INFO"},
            {"time": "09:28 AM", "event": "Sync Material Master — 48,200 records", "level": "INFO"},
            {"time": "09:31 AM", "event": "Purchase Order PO-88102 created", "level": "INFO"},
            {"time": "09:35 AM", "event": "Vendor V-4420 updated payment terms", "level": "INFO"},
            {"time": "09:38 AM", "event": "Rate limit warning: 92% consumed", "level": "WARN"},
            {"time": "09:40 AM", "event": "Warehouse W-003 stock adjustment", "level": "INFO"},
            {"time": "09:42 AM", "event": "Cost Center budget variance alert", "level": "WARN"},
            {"time": "09:44 AM", "event": "Ledger Entry LE-284001 posted", "level": "INFO"},
            {"time": "09:45 AM", "event": "Health check: Healthy (23ms)", "level": "INFO"},
        ],
        "sys_oracle": [
            {"time": "09:20 AM", "event": "Connected to Oracle ERP Cloud", "level": "INFO"},
            {"time": "09:22 AM", "event": "General Ledger sync completed", "level": "INFO"},
            {"time": "09:26 AM", "event": "AP Invoice #28401 posted", "level": "INFO"},
            {"time": "09:30 AM", "event": "Fixed Asset depreciation batch run", "level": "INFO"},
            {"time": "09:34 AM", "event": "Employee directory refresh (14,200 records)", "level": "INFO"},
            {"time": "09:38 AM", "event": "Project P-341 budget exceeded threshold", "level": "WARN"},
            {"time": "09:41 AM", "event": "AR collection reminder sent", "level": "INFO"},
            {"time": "09:43 AM", "event": "Health check: Healthy (14ms)", "level": "INFO"},
        ],
        "sys_salesforce": [
            {"time": "09:18 AM", "event": "Connected to Salesforce CRM", "level": "INFO"},
            {"time": "09:22 AM", "event": "Opportunity OPP-12401 stage updated to Closed Won", "level": "INFO"},
            {"time": "09:28 AM", "event": "Lead conversion rate sync", "level": "INFO"},
            {"time": "09:32 AM", "event": "API throttle warning: 300 calls/min exceeded", "level": "WARN"},
            {"time": "09:35 AM", "event": "Account ACC-24801 revenue updated", "level": "INFO"},
            {"time": "09:40 AM", "event": "Case CS-18601 escalated to Priority 1", "level": "WARN"},
            {"time": "09:42 AM", "event": "Contact sync: 86,400 records", "level": "INFO"},
            {"time": "09:44 AM", "event": "Health check: Warning (89ms — above threshold)", "level": "WARN"},
        ],
    }
    return templates.get(system_id, [
        {"time": "09:20 AM", "event": f"Connected to {system_id}", "level": "INFO"},
        {"time": "09:30 AM", "event": "Data sync completed", "level": "INFO"},
        {"time": "09:40 AM", "event": "Health check: Healthy", "level": "INFO"},
    ])


# ── Health History (sparkline data) ────────────────────────────────────────

def _get_health_history(system_id: str) -> Dict[str, Any]:
    base_latency = next((s["latency_ms"] for s in SYSTEMS_REGISTRY if s["id"] == system_id), 30)
    sparkline_24h = [max(5, base_latency + random.randint(-8, 15)) for _ in range(24)]
    return {
        "latency_sparkline_24h": sparkline_24h,
        "availability_7d": [99.99, 99.98, 99.99, 99.95, 99.99, 99.97, 99.99],
        "errors_7d": [random.randint(0, 20) for _ in range(7)],
    }


class SystemsService:
    """Enterprise Systems Infrastructure Service."""

    @classmethod
    def get_all_systems(cls) -> List[Dict[str, Any]]:
        return SYSTEMS_REGISTRY

    @classmethod
    def get_system(cls, system_id: str) -> Optional[Dict[str, Any]]:
        return next((s for s in SYSTEMS_REGISTRY if s["id"] == system_id), None)

    @classmethod
    def get_system_objects(cls, system_id: str) -> List[Dict[str, Any]]:
        return SYSTEM_OBJECTS.get(system_id, [
            {"name": "GenericObject", "fields": ["ID", "Name", "Status", "Created"], "record_count": 100}
        ])

    @classmethod
    def get_system_capabilities(cls, system_id: str) -> List[Dict[str, Any]]:
        return SYSTEM_CAPABILITIES.get(system_id, [
            {"name": "data.read", "supported": True, "permission": "enterprise.general.read", "latency_ms": 20, "success_rate": 99.5}
        ])

    @classmethod
    def get_system_permissions(cls, system_id: str) -> List[Dict[str, Any]]:
        return SYSTEM_PERMISSIONS.get(system_id, [
            {"scope": "enterprise.general.read", "label": "Read Access", "status": "Granted", "role": "General"}
        ])

    @classmethod
    def get_system_logs(cls, system_id: str) -> List[Dict[str, Any]]:
        return _generate_logs(system_id)

    @classmethod
    def get_system_health(cls, system_id: str) -> Dict[str, Any]:
        sys = cls.get_system(system_id)
        if not sys:
            return {}
        history = _get_health_history(system_id)
        return {
            "latency_ms": sys["latency_ms"],
            "cpu_percent": sys["cpu_percent"],
            "memory_percent": sys["memory_percent"],
            "rate_limit_remaining": sys["rate_limit_remaining"],
            "rate_limit_max": sys["rate_limit_max"],
            "errors_today": sys["errors_today"],
            "availability": sys["availability"],
            **history,
        }

    @classmethod
    def get_system_metrics(cls, system_id: str) -> Dict[str, Any]:
        sys = cls.get_system(system_id)
        if not sys:
            return {}
        return {
            "today_calls": sys["today_calls"],
            "success_rate": sys["success_rate"],
            "errors_today": sys["errors_today"],
            "bandwidth_mb": sys["bandwidth_mb"],
            "cache_hit_rate": sys["cache_hit_rate"],
            "avg_payload_kb": sys["avg_payload_kb"],
            "calls_sparkline": [random.randint(200, 1200) for _ in range(24)],
        }

    @classmethod
    def get_system_version(cls, system_id: str) -> Dict[str, Any]:
        sys = cls.get_system(system_id)
        if not sys:
            return {}
        return {
            "driver": sys["driver"],
            "api_version": sys["version"],
            "connector_version": "1.0",
            "last_update": "Yesterday",
            "compatibility": "100%",
            "update_available": system_id in ["sys_hubspot", "sys_salesforce"],
        }

    @classmethod
    def get_system_auth(cls, system_id: str) -> Dict[str, Any]:
        sys = cls.get_system(system_id)
        if not sys:
            return {}
        return {
            "auth_type": sys["auth_type"],
            "status": sys["auth_status"],
            "credential_masked": "••••••••••••••••",
            "expires_in": "28 days",
            "last_rotated": "2026-07-20",
        }

    @classmethod
    def connect_system(cls, system_type: str) -> Dict[str, Any]:
        """Simulate connecting a new system."""
        logger.info(f"[SYSTEMS] Connecting new system: {system_type}")
        return {
            "status": "connected",
            "steps": [
                {"step": "Driver Installation", "status": "completed"},
                {"step": "Authentication", "status": "completed"},
                {"step": "Health Check", "status": "completed"},
                {"step": "Capability Discovery", "status": "completed"},
                {"step": "Schema Discovery", "status": "completed"},
            ],
            "message": f"{system_type} connected successfully"
        }

    @classmethod
    def ping_system(cls, system_id: str) -> Dict[str, Any]:
        sys = cls.get_system(system_id)
        if not sys:
            return {"status": "error", "message": "System not found"}
        return {
            "system_id": system_id,
            "status": sys["status"],
            "latency_ms": sys["latency_ms"],
            "timestamp": time.time()
        }

    @classmethod
    def test_connection(cls, system_id: str) -> Dict[str, Any]:
        return {
            "system_id": system_id,
            "steps": [
                {"test": "DNS Resolution", "status": "passed", "latency_ms": 2},
                {"test": "TLS Handshake", "status": "passed", "latency_ms": 8},
                {"test": "Authentication", "status": "passed", "latency_ms": 12},
                {"test": "API Health Endpoint", "status": "passed", "latency_ms": 18},
                {"test": "Schema Validation", "status": "passed", "latency_ms": 45},
            ],
            "overall": "passed",
            "total_ms": 85,
        }

    @classmethod
    def get_header_stats(cls) -> Dict[str, Any]:
        systems = cls.get_all_systems()
        return {
            "total": len(systems),
            "healthy": sum(1 for s in systems if s["status"] == "Healthy"),
            "warning": sum(1 for s in systems if s["status"] == "Warning"),
            "offline": sum(1 for s in systems if s["status"] == "Offline"),
        }


systems_service = SystemsService()
