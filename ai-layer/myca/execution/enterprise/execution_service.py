"""
Enterprise Execution Service (Phase 3.0 — Runtime Control Center)
Full execution lifecycle engine: create, start, pause, resume, cancel, retry, replay.
Manages execution DAG graphs, node states, artifacts, variables, logs, metrics & events.
"""
import logging
import time
import random
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger("myca.execution.enterprise.execution_service")

# ── Execution State Machine ───────────────────────────────────────────

EXEC_STATES = ["running", "waiting", "paused", "completed", "failed", "cancelled"]
NODE_TYPES = ["planner", "compiler", "validator", "driver", "approval", "policy", "artifact", "ai", "merge", "email", "done"]

# ── Mock Execution Database ───────────────────────────────────────────

EXECUTIONS_DB: List[Dict[str, Any]] = [
    {
        "id": "exec_fin_report_001",
        "name": "Monthly Financial Report",
        "description": "Generate consolidated financial report across SAP, Oracle & QuickBooks",
        "status": "running",
        "need": "Generate monthly financial report, approve invoices, send to CFO",
        "priority": "High",
        "policy": "SOX Compliant",
        "environment": "Production",
        "owner": "CFO Office",
        "started_at": "Today, 12:10 PM",
        "elapsed": "00:02:14",
        "progress": {"completed": 12, "total": 31},
        "driver_count": 4,
    },
    {
        "id": "exec_inv_sync_002",
        "name": "Inventory Sync — All Warehouses",
        "description": "Real-time stock level synchronization across 8 regional warehouses",
        "status": "running",
        "need": "Sync all warehouse inventory levels and update reorder thresholds",
        "priority": "Critical",
        "policy": "Standard",
        "environment": "Production",
        "owner": "Supply Chain Ops",
        "started_at": "Today, 12:08 PM",
        "elapsed": "00:04:31",
        "progress": {"completed": 28, "total": 43},
        "driver_count": 3,
    },
    {
        "id": "exec_cust_onboard_003",
        "name": "Enterprise Customer Onboarding",
        "description": "Full lifecycle customer account creation across CRM, ERP & Billing",
        "status": "waiting",
        "need": "Onboard new enterprise customer: TechCorp Inc.",
        "priority": "High",
        "policy": "GDPR Required",
        "environment": "Production",
        "owner": "Sales Operations",
        "started_at": "Today, 12:12 PM",
        "elapsed": "00:00:42",
        "progress": {"completed": 5, "total": 18},
        "driver_count": 5,
    },
    {
        "id": "exec_payroll_004",
        "name": "Quarterly Payroll Processing",
        "description": "Calculate and disburse Q3 payroll for 2,400 employees",
        "status": "paused",
        "need": "Process quarterly payroll with tax calculations and direct deposit",
        "priority": "High",
        "policy": "SOX + Approval Required",
        "environment": "Production",
        "owner": "HR Department",
        "started_at": "Today, 11:45 AM",
        "elapsed": "00:14:20",
        "progress": {"completed": 22, "total": 38},
        "driver_count": 3,
    },
    {
        "id": "exec_email_camp_005",
        "name": "Q3 Marketing Campaign Dispatch",
        "description": "Send personalized email campaign to 48,000 contacts via Salesforce",
        "status": "completed",
        "need": "Dispatch segmented Q3 marketing emails with tracking pixels",
        "priority": "Medium",
        "policy": "GDPR Required",
        "environment": "Production",
        "owner": "Marketing Team",
        "started_at": "Today, 10:00 AM",
        "elapsed": "00:18:44",
        "progress": {"completed": 26, "total": 26},
        "driver_count": 2,
    },
    {
        "id": "exec_tax_calc_006",
        "name": "Annual Tax Computation",
        "description": "Multi-jurisdiction corporate tax calculation & filing preparation",
        "status": "failed",
        "need": "Calculate annual corporate taxes across US, EU, and APAC jurisdictions",
        "priority": "Critical",
        "policy": "SOX + Audit Trail",
        "environment": "Production",
        "owner": "Tax Department",
        "started_at": "Yesterday, 4:30 PM",
        "elapsed": "00:08:12",
        "progress": {"completed": 14, "total": 35},
        "driver_count": 4,
        "error": "Oracle Driver timeout on tax_rates.lookup (jurisdiction: DE-BW)",
    },
    {
        "id": "exec_vendor_audit_007",
        "name": "Vendor Compliance Audit",
        "description": "Automated vendor compliance audit across all active suppliers",
        "status": "cancelled",
        "need": "Run compliance verification for 340 active vendors",
        "priority": "Low",
        "policy": "Standard",
        "environment": "Staging",
        "owner": "Procurement",
        "started_at": "Yesterday, 2:00 PM",
        "elapsed": "00:03:22",
        "progress": {"completed": 8, "total": 42},
        "driver_count": 2,
    },
]

# ── Execution Graph (DAG) ────────────────────────────────────────────

EXECUTION_GRAPHS: Dict[str, Dict[str, Any]] = {
    "exec_fin_report_001": {
        "nodes": [
            {"id": "n1", "type": "planner", "label": "Planner", "status": "completed", "duration_ms": 120, "driver": None, "x": 350, "y": 0},
            {"id": "n2", "type": "compiler", "label": "Compiler", "status": "completed", "duration_ms": 45, "driver": None, "x": 350, "y": 80},
            {"id": "n3", "type": "validator", "label": "Validator", "status": "completed", "duration_ms": 18, "driver": None, "x": 350, "y": 160},
            {"id": "n4", "type": "driver", "label": "Read SAP\nGL Entries", "status": "completed", "duration_ms": 34, "driver": "SAP Driver", "x": 150, "y": 260},
            {"id": "n5", "type": "driver", "label": "Read Oracle\nAP Invoices", "status": "completed", "duration_ms": 41, "driver": "Oracle Driver", "x": 350, "y": 260},
            {"id": "n6", "type": "driver", "label": "Read Salesforce\nRevenue", "status": "completed", "duration_ms": 27, "driver": "Salesforce Driver", "x": 550, "y": 260},
            {"id": "n7", "type": "driver", "label": "Read QuickBooks\nExpenses", "status": "completed", "duration_ms": 22, "driver": "QuickBooks Driver", "x": 750, "y": 260},
            {"id": "n8", "type": "merge", "label": "Merge\nFinancial Data", "status": "completed", "duration_ms": 88, "driver": None, "x": 350, "y": 370},
            {"id": "n9", "type": "ai", "label": "AI Analysis\n& Insights", "status": "completed", "duration_ms": 340, "driver": None, "x": 350, "y": 460},
            {"id": "n10", "type": "artifact", "label": "Generate\nReport PDF", "status": "completed", "duration_ms": 210, "driver": None, "x": 200, "y": 550},
            {"id": "n11", "type": "artifact", "label": "Generate\nExcel Summary", "status": "completed", "duration_ms": 180, "driver": None, "x": 500, "y": 550},
            {"id": "n12", "type": "approval", "label": "CFO Approval", "status": "running", "duration_ms": None, "driver": None, "x": 350, "y": 650},
            {"id": "n13", "type": "email", "label": "Email to\nStakeholders", "status": "waiting", "duration_ms": None, "driver": None, "x": 350, "y": 750},
            {"id": "n14", "type": "done", "label": "Done", "status": "waiting", "duration_ms": None, "driver": None, "x": 350, "y": 830},
        ],
        "edges": [
            {"source": "n1", "target": "n2"},
            {"source": "n2", "target": "n3"},
            {"source": "n3", "target": "n4"},
            {"source": "n3", "target": "n5"},
            {"source": "n3", "target": "n6"},
            {"source": "n3", "target": "n7"},
            {"source": "n4", "target": "n8"},
            {"source": "n5", "target": "n8"},
            {"source": "n6", "target": "n8"},
            {"source": "n7", "target": "n8"},
            {"source": "n8", "target": "n9"},
            {"source": "n9", "target": "n10"},
            {"source": "n9", "target": "n11"},
            {"source": "n10", "target": "n12"},
            {"source": "n11", "target": "n12"},
            {"source": "n12", "target": "n13"},
            {"source": "n13", "target": "n14"},
        ],
    }
}

# ── Node Inspector Data ──────────────────────────────────────────────

NODE_DETAILS: Dict[str, Dict[str, Any]] = {
    "n4": {
        "id": "n4",
        "label": "Read SAP GL Entries",
        "type": "driver",
        "status": "completed",
        "duration_ms": 34,
        "input": {"warehouse_id": "WH-TR01", "fiscal_year": 2026, "period": "Q3"},
        "output": {"file": "gl_entries.json", "records": 14820, "size_kb": 2410},
        "driver": "SAP Driver",
        "capability": "enterprise.ledger.read",
        "policy": "SOX Section 404",
        "permission": "enterprise.finance.ledger.read",
        "retry_count": 0,
        "cost_usd": 0.004,
    },
    "n12": {
        "id": "n12",
        "label": "CFO Approval",
        "type": "approval",
        "status": "running",
        "duration_ms": None,
        "input": {"report_id": "FIN-2026-Q3", "total_amount": 4200000.00},
        "output": None,
        "driver": None,
        "capability": "enterprise.approval.request",
        "policy": "Executive Approval Required",
        "permission": "enterprise.finance.approve",
        "retry_count": 0,
        "cost_usd": 0.0,
        "approval_required_from": "CFO",
    },
}

# ── Execution Timeline ──────────────────────────────────────────────

EXECUTION_TIMELINES: Dict[str, List[Dict[str, Any]]] = {
    "exec_fin_report_001": [
        {"time": "12:10:00", "event": "ExecutionCreated", "detail": "Monthly Financial Report execution created", "icon": "play"},
        {"time": "12:10:01", "event": "PlannerStarted", "detail": "Planner decomposing intent into execution DAG", "icon": "brain"},
        {"time": "12:10:01", "event": "PlannerFinished", "detail": "14-node DAG generated (4 parallel driver reads)", "icon": "check"},
        {"time": "12:10:02", "event": "CompilerStarted", "detail": "Compiling DAG to intermediate representation", "icon": "code"},
        {"time": "12:10:02", "event": "CompilerFinished", "detail": "IR compiled: 14 nodes, 17 edges, 4 parallel branches", "icon": "check"},
        {"time": "12:10:02", "event": "ValidatorStarted", "detail": "Policy & permission validation pass", "icon": "shield"},
        {"time": "12:10:02", "event": "ValidatorFinished", "detail": "SOX compliance verified, all permissions granted", "icon": "check"},
        {"time": "12:10:03", "event": "DriverSelected", "detail": "SAP Driver selected for ledger.read (Priority 1, 18ms avg)", "icon": "server"},
        {"time": "12:10:03", "event": "DriverSelected", "detail": "Oracle Driver selected for invoice.read (Priority 1, 24ms avg)", "icon": "server"},
        {"time": "12:10:03", "event": "DriverSelected", "detail": "Salesforce Driver selected for revenue.read (Priority 1, 27ms avg)", "icon": "server"},
        {"time": "12:10:03", "event": "DriverSelected", "detail": "QuickBooks Driver selected for expense.read (Priority 1, 11ms avg)", "icon": "server"},
        {"time": "12:10:03", "event": "NodeStarted", "detail": "Parallel execution: 4 driver read nodes dispatched", "icon": "zap"},
        {"time": "12:10:04", "event": "NodeCompleted", "detail": "QuickBooks expenses retrieved (22ms, 3,210 records)", "icon": "check"},
        {"time": "12:10:04", "event": "NodeCompleted", "detail": "Salesforce revenue retrieved (27ms, 8,440 records)", "icon": "check"},
        {"time": "12:10:04", "event": "NodeCompleted", "detail": "SAP GL entries retrieved (34ms, 14,820 records)", "icon": "check"},
        {"time": "12:10:04", "event": "NodeCompleted", "detail": "Oracle AP invoices retrieved (41ms, 6,280 records)", "icon": "check"},
        {"time": "12:10:05", "event": "NodeStarted", "detail": "Merge Financial Data node started", "icon": "merge"},
        {"time": "12:10:05", "event": "NodeCompleted", "detail": "Financial data merged (88ms, 32,750 total records)", "icon": "check"},
        {"time": "12:10:06", "event": "NodeStarted", "detail": "AI Analysis & Insights engine started", "icon": "brain"},
        {"time": "12:10:06", "event": "NodeCompleted", "detail": "AI generated 12 insights, 3 anomaly flags", "icon": "sparkles"},
        {"time": "12:10:07", "event": "ArtifactCreated", "detail": "report.pdf generated (2.4MB, 48 pages)", "icon": "file"},
        {"time": "12:10:07", "event": "ArtifactCreated", "detail": "summary.xlsx generated (1.1MB, 12 sheets)", "icon": "file"},
        {"time": "12:10:08", "event": "ApprovalRequested", "detail": "CFO approval requested for Financial Report FIN-2026-Q3", "icon": "clock"},
    ],
}

# ── Execution Logs ───────────────────────────────────────────────────

EXECUTION_LOGS: Dict[str, List[Dict[str, Any]]] = {
    "exec_fin_report_001": [
        {"level": "INFO", "source": "Planner", "time": "12:10:01.102", "message": "Intent decomposition started for 'Monthly Financial Report'"},
        {"level": "INFO", "source": "Planner", "time": "12:10:01.224", "message": "DAG topology: 14 nodes, 17 edges, depth=7, parallelism=4"},
        {"level": "INFO", "source": "Compiler", "time": "12:10:02.001", "message": "Compiling DAG → IR (intermediate representation)"},
        {"level": "INFO", "source": "Compiler", "time": "12:10:02.046", "message": "IR optimization pass: merged 2 redundant nodes"},
        {"level": "INFO", "source": "Validator", "time": "12:10:02.100", "message": "Policy check: SOX Section 404 → PASS"},
        {"level": "INFO", "source": "Validator", "time": "12:10:02.118", "message": "Permission check: enterprise.finance.* → GRANTED"},
        {"level": "INFO", "source": "Runtime", "time": "12:10:03.001", "message": "Enterprise Router selecting drivers for 4 parallel reads"},
        {"level": "DEBUG", "source": "Driver", "time": "12:10:03.010", "message": "SAP Driver v18.2 selected (latency=18ms, health=99.9%)"},
        {"level": "DEBUG", "source": "Driver", "time": "12:10:03.012", "message": "Oracle Driver v12.4 selected (latency=24ms, health=99.8%)"},
        {"level": "DEBUG", "source": "Driver", "time": "12:10:03.014", "message": "Salesforce Driver v8.1 selected (latency=27ms, health=99.7%)"},
        {"level": "DEBUG", "source": "Driver", "time": "12:10:03.016", "message": "QuickBooks Driver v6.3 selected (latency=11ms, health=99.9%)"},
        {"level": "INFO", "source": "Runtime", "time": "12:10:03.020", "message": "Dispatching 4 parallel driver execution tasks"},
        {"level": "INFO", "source": "Runtime", "time": "12:10:04.042", "message": "QuickBooks read completed: 3,210 expense records (22ms)"},
        {"level": "INFO", "source": "Runtime", "time": "12:10:04.069", "message": "Salesforce read completed: 8,440 revenue records (27ms)"},
        {"level": "INFO", "source": "Runtime", "time": "12:10:04.076", "message": "SAP read completed: 14,820 GL entries (34ms)"},
        {"level": "INFO", "source": "Runtime", "time": "12:10:04.083", "message": "Oracle read completed: 6,280 AP invoices (41ms)"},
        {"level": "INFO", "source": "Runtime", "time": "12:10:05.171", "message": "Merge node aggregated 32,750 records across 4 sources"},
        {"level": "INFO", "source": "Runtime", "time": "12:10:06.511", "message": "AI Insights engine generated 12 observations, flagged 3 anomalies"},
        {"level": "INFO", "source": "Artifact", "time": "12:10:07.010", "message": "report.pdf rendered (48 pages, 2.4MB)"},
        {"level": "INFO", "source": "Artifact", "time": "12:10:07.190", "message": "summary.xlsx generated (12 sheets, 1.1MB)"},
        {"level": "WARN", "source": "Approval", "time": "12:10:08.001", "message": "Execution BLOCKED: Awaiting CFO approval for FIN-2026-Q3"},
    ],
}

# ── Execution Artifacts ──────────────────────────────────────────────

EXECUTION_ARTIFACTS: Dict[str, List[Dict[str, Any]]] = {
    "exec_fin_report_001": [
        {"name": "report.pdf", "mime": "application/pdf", "size": "2.4 MB", "hash": "sha256:a8f2e1...", "owner": "System", "preview": True},
        {"name": "summary.xlsx", "mime": "application/vnd.ms-excel", "size": "1.1 MB", "hash": "sha256:c4d9b3...", "owner": "System", "preview": True},
        {"name": "gl_entries.json", "mime": "application/json", "size": "4.8 MB", "hash": "sha256:e7f1a2...", "owner": "SAP Driver", "preview": False},
        {"name": "ap_invoices.json", "mime": "application/json", "size": "2.1 MB", "hash": "sha256:b2c4d6...", "owner": "Oracle Driver", "preview": False},
        {"name": "revenue_data.json", "mime": "application/json", "size": "3.2 MB", "hash": "sha256:f8e3c1...", "owner": "Salesforce Driver", "preview": False},
        {"name": "insights.md", "mime": "text/markdown", "size": "48 KB", "hash": "sha256:d1a9f4...", "owner": "AI Engine", "preview": True},
        {"name": "execution_graph.json", "mime": "application/json", "size": "12 KB", "hash": "sha256:91b2c3...", "owner": "Runtime", "preview": False},
    ],
}

# ── Execution Variables ──────────────────────────────────────────────

EXECUTION_VARIABLES: Dict[str, List[Dict[str, Any]]] = {
    "exec_fin_report_001": [
        {"key": "fiscal_year", "value": "2026", "type": "integer", "immutable": True},
        {"key": "fiscal_period", "value": "Q3", "type": "string", "immutable": True},
        {"key": "currency", "value": "USD", "type": "string", "immutable": True},
        {"key": "total_records", "value": "32,750", "type": "integer", "immutable": True},
        {"key": "warehouse_count", "value": "8", "type": "integer", "immutable": True},
        {"key": "budget_limit", "value": "$4,200,000.00", "type": "currency", "immutable": True},
        {"key": "anomaly_count", "value": "3", "type": "integer", "immutable": True},
        {"key": "report_pages", "value": "48", "type": "integer", "immutable": True},
    ],
}

# ── Execution Drivers ───────────────────────────────────────────────

EXECUTION_DRIVERS: Dict[str, List[Dict[str, Any]]] = {
    "exec_fin_report_001": [
        {"name": "SAP Driver", "version": "v18.2", "status": "Healthy", "latency_ms": 34, "nodes_executed": 1, "data_transferred": "4.8 MB"},
        {"name": "Oracle Driver", "version": "v12.4", "status": "Healthy", "latency_ms": 41, "nodes_executed": 1, "data_transferred": "2.1 MB"},
        {"name": "Salesforce Driver", "version": "v8.1", "status": "Healthy", "latency_ms": 27, "nodes_executed": 1, "data_transferred": "3.2 MB"},
        {"name": "QuickBooks Driver", "version": "v6.3", "status": "Healthy", "latency_ms": 22, "nodes_executed": 1, "data_transferred": "1.4 MB"},
    ],
}

# ── Execution Metrics ───────────────────────────────────────────────

EXECUTION_METRICS: Dict[str, Dict[str, Any]] = {
    "exec_fin_report_001": {
        "total_nodes": 14,
        "completed_nodes": 12,
        "running_nodes": 1,
        "waiting_nodes": 1,
        "failed_nodes": 0,
        "cpu_percent": 4.2,
        "memory_mb": 128,
        "avg_latency_ms": 42,
        "network_kb": 11520,
        "estimated_cost_usd": 0.24,
        "actual_cost_usd": 0.18,
        "total_records_processed": 32750,
    },
}

# ── Live Event Stream ────────────────────────────────────────────────

LIVE_EVENTS: List[Dict[str, Any]] = [
    {"time": "12:12:14", "type": "ApprovalRequested", "exec": "Monthly Financial Report", "detail": "CFO Approval pending for FIN-2026-Q3", "color": "orange"},
    {"time": "12:12:10", "type": "ArtifactCreated", "exec": "Monthly Financial Report", "detail": "summary.xlsx generated (1.1MB)", "color": "green"},
    {"time": "12:12:08", "type": "ArtifactCreated", "exec": "Monthly Financial Report", "detail": "report.pdf generated (2.4MB, 48 pages)", "color": "green"},
    {"time": "12:11:44", "type": "NodeCompleted", "exec": "Inventory Sync", "detail": "Warehouse WH-EU04 sync completed (SAP Driver, 38ms)", "color": "green"},
    {"time": "12:11:42", "type": "NodeCompleted", "exec": "Inventory Sync", "detail": "Warehouse WH-US02 sync completed (Oracle Driver, 44ms)", "color": "green"},
    {"time": "12:11:30", "type": "ExecutionPaused", "exec": "Quarterly Payroll", "detail": "Paused by HR Department — awaiting tax rate update", "color": "orange"},
    {"time": "12:10:08", "type": "DriverSelected", "exec": "Monthly Financial Report", "detail": "SAP, Oracle, Salesforce, QuickBooks drivers selected", "color": "blue"},
    {"time": "12:10:02", "type": "ValidatorFinished", "exec": "Monthly Financial Report", "detail": "SOX compliance verified, all permissions granted", "color": "green"},
    {"time": "12:10:01", "type": "PlannerFinished", "exec": "Monthly Financial Report", "detail": "14-node DAG generated (4 parallel branches)", "color": "purple"},
    {"time": "12:08:00", "type": "ExecutionCreated", "exec": "Inventory Sync", "detail": "43-node execution started across 8 warehouses", "color": "blue"},
]


class ExecutionService:
    """Enterprise Execution OS — Runtime Control Center Engine."""

    @classmethod
    def get_queue(cls, status_filter: Optional[str] = None) -> Dict[str, Any]:
        execs = EXECUTIONS_DB
        if status_filter and status_filter != "all":
            execs = [e for e in execs if e["status"] == status_filter]

        counts = {}
        for s in EXEC_STATES:
            counts[s] = len([e for e in EXECUTIONS_DB if e["status"] == s])

        return {
            "executions": execs,
            "counts": counts,
            "total": len(EXECUTIONS_DB),
        }

    @classmethod
    def get_execution(cls, exec_id: str) -> Optional[Dict[str, Any]]:
        return next((e for e in EXECUTIONS_DB if e["id"] == exec_id), None)

    @classmethod
    def get_graph(cls, exec_id: str) -> Optional[Dict[str, Any]]:
        graph = EXECUTION_GRAPHS.get(exec_id)
        if not graph:
            # Generate a default graph for executions without custom graph
            exec_data = cls.get_execution(exec_id)
            if not exec_data:
                return None
            return {
                "nodes": [
                    {"id": "n1", "type": "planner", "label": "Planner", "status": "completed", "duration_ms": 110, "driver": None, "x": 350, "y": 0},
                    {"id": "n2", "type": "compiler", "label": "Compiler", "status": "completed", "duration_ms": 42, "driver": None, "x": 350, "y": 80},
                    {"id": "n3", "type": "validator", "label": "Validator", "status": "completed", "duration_ms": 15, "driver": None, "x": 350, "y": 160},
                    {"id": "n4", "type": "driver", "label": "Driver\nExecution", "status": exec_data["status"], "duration_ms": 38, "driver": "SAP Driver", "x": 350, "y": 260},
                    {"id": "n5", "type": "done", "label": "Done", "status": "waiting", "duration_ms": None, "driver": None, "x": 350, "y": 350},
                ],
                "edges": [
                    {"source": "n1", "target": "n2"},
                    {"source": "n2", "target": "n3"},
                    {"source": "n3", "target": "n4"},
                    {"source": "n4", "target": "n5"},
                ],
            }
        return graph

    @classmethod
    def get_node_detail(cls, exec_id: str, node_id: str) -> Optional[Dict[str, Any]]:
        detail = NODE_DETAILS.get(node_id)
        if detail:
            return detail
        # Fallback from graph node
        graph = cls.get_graph(exec_id)
        if graph:
            node = next((n for n in graph["nodes"] if n["id"] == node_id), None)
            if node:
                return {
                    "id": node["id"],
                    "label": node["label"].replace("\n", " "),
                    "type": node["type"],
                    "status": node["status"],
                    "duration_ms": node.get("duration_ms"),
                    "input": {},
                    "output": {},
                    "driver": node.get("driver"),
                    "capability": f"enterprise.{node['type']}.execute",
                    "policy": "Standard",
                    "permission": f"enterprise.{node['type']}.execute",
                    "retry_count": 0,
                    "cost_usd": 0.0,
                }
        return None

    @classmethod
    def get_timeline(cls, exec_id: str) -> List[Dict[str, Any]]:
        return EXECUTION_TIMELINES.get(exec_id, [])

    @classmethod
    def get_logs(cls, exec_id: str, source_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        logs = EXECUTION_LOGS.get(exec_id, [])
        if source_filter:
            logs = [l for l in logs if l["source"].lower() == source_filter.lower()]
        return logs

    @classmethod
    def get_artifacts(cls, exec_id: str) -> List[Dict[str, Any]]:
        return EXECUTION_ARTIFACTS.get(exec_id, [])

    @classmethod
    def get_variables(cls, exec_id: str) -> List[Dict[str, Any]]:
        return EXECUTION_VARIABLES.get(exec_id, [])

    @classmethod
    def get_drivers(cls, exec_id: str) -> List[Dict[str, Any]]:
        return EXECUTION_DRIVERS.get(exec_id, [])

    @classmethod
    def get_metrics(cls, exec_id: str) -> Optional[Dict[str, Any]]:
        return EXECUTION_METRICS.get(exec_id, {
            "total_nodes": 14, "completed_nodes": 10, "running_nodes": 2, "waiting_nodes": 2,
            "failed_nodes": 0, "cpu_percent": 3.1, "memory_mb": 96, "avg_latency_ms": 38,
            "network_kb": 8400, "estimated_cost_usd": 0.18, "actual_cost_usd": 0.14,
        })

    @classmethod
    def get_live_events(cls) -> List[Dict[str, Any]]:
        return LIVE_EVENTS

    # ── Lifecycle Actions ────────────────────────────────────────────

    @classmethod
    def create_execution(cls, name: str, description: str, need: str, priority: str, policy: str, environment: str) -> Dict[str, Any]:
        exec_id = f"exec_{uuid.uuid4().hex[:8]}"
        new_exec = {
            "id": exec_id,
            "name": name,
            "description": description,
            "status": "running",
            "need": need,
            "priority": priority,
            "policy": policy,
            "environment": environment,
            "owner": "Current User",
            "started_at": datetime.now().strftime("Today, %I:%M %p"),
            "elapsed": "00:00:00",
            "progress": {"completed": 0, "total": random.randint(12, 40)},
            "driver_count": random.randint(2, 6),
        }
        EXECUTIONS_DB.insert(0, new_exec)
        logger.info(f"[EXECUTION_OS] Created execution '{name}' (ID: {exec_id})")
        return new_exec

    @classmethod
    def pause_execution(cls, exec_id: str) -> Dict[str, Any]:
        ex = cls.get_execution(exec_id)
        if not ex:
            return {"status": "error", "message": "Execution not found"}
        ex["status"] = "paused"
        return {"status": "success", "message": f"Execution '{ex['name']}' paused", "execution": ex}

    @classmethod
    def resume_execution(cls, exec_id: str) -> Dict[str, Any]:
        ex = cls.get_execution(exec_id)
        if not ex:
            return {"status": "error", "message": "Execution not found"}
        ex["status"] = "running"
        return {"status": "success", "message": f"Execution '{ex['name']}' resumed", "execution": ex}

    @classmethod
    def cancel_execution(cls, exec_id: str) -> Dict[str, Any]:
        ex = cls.get_execution(exec_id)
        if not ex:
            return {"status": "error", "message": "Execution not found"}
        ex["status"] = "cancelled"
        return {"status": "success", "message": f"Execution '{ex['name']}' cancelled", "execution": ex}

    @classmethod
    def retry_execution(cls, exec_id: str) -> Dict[str, Any]:
        ex = cls.get_execution(exec_id)
        if not ex:
            return {"status": "error", "message": "Execution not found"}
        ex["status"] = "running"
        ex["progress"]["completed"] = max(0, ex["progress"]["completed"] - 1)
        return {"status": "success", "message": f"Execution '{ex['name']}' retrying from last failed node", "execution": ex}

    @classmethod
    def replay_execution(cls, exec_id: str, with_changes: bool = False) -> Dict[str, Any]:
        ex = cls.get_execution(exec_id)
        if not ex:
            return {"status": "error", "message": "Execution not found"}
        new_exec = cls.create_execution(
            name=f"{ex['name']} (Replay)",
            description=ex["description"],
            need=ex["need"],
            priority=ex["priority"],
            policy=ex["policy"],
            environment=ex["environment"],
        )
        return {"status": "success", "message": f"Replay started as '{new_exec['name']}'", "execution": new_exec}


execution_service = ExecutionService()
