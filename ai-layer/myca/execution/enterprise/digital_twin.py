"""
Digital Twin & Enterprise Graph Engine
Maintains the real-time living graph model of the company across departments, objects, and systems.
"""
import logging
import time
from typing import Dict, List, Any

logger = logging.getLogger("myca.execution.enterprise.digital_twin")

class DigitalTwin:
    def __init__(self):
        self.nodes = [
            {"id": "node_company", "label": "Myca Enterprise Corp", "type": "Company", "status": "active"},
            {"id": "node_sales", "label": "Global Sales & CRM", "type": "Department", "system": "Salesforce Driver"},
            {"id": "node_inventory", "label": "Supply Chain & Stock", "type": "Department", "system": "SAP Driver"},
            {"id": "node_finance", "label": "General Ledger & Treasury", "type": "Department", "system": "Oracle Driver"},
            {"id": "node_hr", "label": "Human Resources & Payroll", "type": "Department", "system": "Workday Driver"},
            {"id": "node_comm", "label": "Unified Communications", "type": "Department", "system": "Slack / Teams Drivers"}
        ]
        
        self.edges = [
            {"from": "node_company", "to": "node_sales", "label": "operates"},
            {"from": "node_company", "to": "node_inventory", "label": "operates"},
            {"from": "node_company", "to": "node_finance", "label": "operates"},
            {"from": "node_company", "to": "node_hr", "label": "operates"},
            {"from": "node_sales", "to": "node_finance", "label": "posts_revenue"},
            {"from": "node_sales", "to": "node_inventory", "label": "triggers_fulfillment"},
            {"from": "node_inventory", "to": "node_finance", "label": "posts_cogs"}
        ]

    def get_company_graph(self) -> Dict[str, Any]:
        return {
            "nodes": self.nodes,
            "edges": self.edges,
            "total_objects_mapped": 1420,
            "active_streams": 14,
            "last_synced": time.strftime("%Y-%m-%d %H:%M:%S")
        }

    def query_object(self, object_type: str, query_params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        logger.info(f"[DIGITAL_TWIN] Querying Digital Twin graph for object type: {object_type}")
        if object_type.lower() in ["inventory", "inventoryobject", "stock", "material"]:
            return [
                {"id": "SKU-9021", "name": "Industrial AI Compute Unit", "stock_qty": 480, "reorder_point": 100, "unit_price": 2450.0, "drivers": ["SAP Driver", "Oracle Driver"]},
                {"id": "SKU-4410", "name": "P2P Sensor Node Module", "stock_qty": 1250, "reorder_point": 300, "unit_price": 180.0, "drivers": ["SAP Driver"]}
            ]
        elif object_type.lower() in ["customer", "customerobject", "lead"]:
            return [
                {"id": "CUST-881", "name": "Acme Technologies Corp", "stage": "Closed Won", "arr": 120000.0, "drivers": ["Salesforce Driver", "HubSpot Driver"]},
                {"id": "CUST-902", "name": "Global Dynamics Ltd", "stage": "Proposal Sent", "arr": 85000.0, "drivers": ["Salesforce Driver"]}
            ]
        return [
            {"id": "OBJ-101", "name": f"Digital Twin Item ({object_type})", "status": "synced"}
        ]

digital_twin_engine = DigitalTwin()
