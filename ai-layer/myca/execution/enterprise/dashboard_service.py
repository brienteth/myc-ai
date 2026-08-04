"""
DashboardService Layer
Aggregates Digital Twin, Driver Manager, Approval Engine, Opportunity Engine, and Telemetry
into clean DTO payloads for the Enterprise Dashboard control center.
"""
import time
from typing import Dict, Any, List

from .digital_twin import digital_twin_engine
from .driver_manager import DriverManager
from .approval_engine import ApprovalEngine
from .opportunity_engine import opportunity_engine
from .analytics import EnterpriseAnalytics

class DashboardService:
    def get_systems(self):
        return DriverManager.get_installed_drivers()

    def get_summary(self):
        systems = self.get_systems()
        healthy_sys = sum(1 for s in systems if s["status"] == "Healthy")
        warning_sys = sum(1 for s in systems if s["status"] == "Warning")
        offline_sys = sum(1 for s in systems if s["status"] == "Offline")

        return {
            "company_name": "Acme Manufacturing",
            "connected_systems_count": len(systems),
            "company_health_percent": 97,
            "status": "Healthy",
            "systems": {
                "healthy": healthy_sys,
                "warning": warning_sys,
                "offline": offline_sys
            },
            "executions": {
                "running": 18,
                "queued": 5,
                "failed": 1
            },
            "approvals": {
                "pending": len(ApprovalEngine.get_pending_approvals())
            },
            "estimated_savings": "$128,000 / month",
            "last_sync": "2 sec ago"
        }

    def get_cards(self) -> Dict[str, Any]:
        return {
            "card_1_systems": {
                "count": 13,
                "label": "Connected Systems",
                "preview": ["SAP", "Oracle", "Salesforce", "QuickBooks", "Slack", "NetSuite"],
                "target_tab": "systems"
            },
            "card_2_drivers": {
                "count": 41,
                "healthy_count": 39,
                "label": "Drivers",
                "target_tab": "drivers"
            },
            "card_3_capabilities": {
                "count": 856,
                "label": "Capabilities Available",
                "target_tab": "capabilities"
            },
            "card_4_today_executions": {
                "count": 3941,
                "label": "Today's Executions",
                "sparkline": [420, 680, 910, 1150, 1400, 1890, 2400, 3100, 3941],
                "target_tab": "execution"
            },
            "card_5_money_saved": {
                "amount": "$84,200",
                "subtitle": "Money Saved Today",
                "target_tab": "analytics"
            },
            "card_6_tasks_eliminated": {
                "count": 5118,
                "label": "Manual Tasks Eliminated",
                "target_tab": "analytics"
            }
        }

    def get_timeline(self) -> List[Dict[str, Any]]:
        return [
            {"time": "09:44 AM", "event": "Slack Message Sent", "type": "communication", "status": "Completed"},
            {"time": "09:43 AM", "event": "Purchase PO DAG Workflow Finished", "type": "execution", "status": "Completed"},
            {"time": "09:42 AM", "event": "Passkey Approval Granted ($42,000)", "type": "approval", "status": "Granted"},
            {"time": "09:41 AM", "event": "Invoice Created (Oracle ERP)", "type": "finance", "status": "Completed"},
            {"time": "09:38 AM", "event": "SAP Driver Health Check Verified", "type": "system", "status": "Healthy"}
        ]

    def get_activity_feed(self) -> List[Dict[str, Any]]:
        return [
            {"id": "act_1", "actor": "Jane Doe (CFO)", "action": "approved payment", "detail": "$42,000 PO-SKU-9021", "timestamp": "2 mins ago"},
            {"id": "act_2", "actor": "System", "action": "updated driver", "detail": "SAP Driver -> v1.4.2", "timestamp": "12 mins ago"},
            {"id": "act_3", "actor": "Policy Engine", "action": "evaluated rule", "detail": "pol_sox_01 PASSED", "timestamp": "18 mins ago"},
            {"id": "act_4", "actor": "Alex Smith", "action": "deployed workflow", "detail": "Procurement DAG v2", "timestamp": "25 mins ago"},
            {"id": "act_5", "actor": "Salesforce Driver", "action": "synced CRM deals", "detail": "48 Deals Synced", "timestamp": "34 mins ago"}
        ]

    def get_active_executions(self) -> List[Dict[str, Any]]:
        return [
            {"id": "exec_101", "name": "Purchase Approval DAG", "progress": 42, "status": "Running", "target_driver": "SAP Driver"},
            {"id": "exec_102", "name": "Invoice Ledger Sync", "progress": 88, "status": "Running", "target_driver": "Oracle Driver"},
            {"id": "exec_103", "name": "Inventory Replenishment Analysis", "progress": 0, "status": "Waiting", "target_driver": "NetSuite Driver"}
        ]

    def get_full_dashboard(self) -> Dict[str, Any]:
        return {
            "summary": self.get_summary(),
            "cards": self.get_cards(),
            "graph": digital_twin_engine.get_company_graph(),
            "active_executions": self.get_active_executions(),
            "approvals": ApprovalEngine.get_pending_approvals(),
            "driver_health": self.get_systems(),
            "ai_recommendations": opportunity_engine.get_recommendations(),
            "timeline": self.get_timeline(),
            "activity_feed": self.get_activity_feed()
        }

dashboard_service = DashboardService()
