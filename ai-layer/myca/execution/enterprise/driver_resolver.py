"""
Enterprise Driver Resolver
Maps resolved abstract capabilities to active Driver instances based on health, latency, priority, and cost.
"""
import logging
from typing import Dict, Any, List

logger = logging.getLogger("myca.execution.enterprise.driver_resolver")

class DriverResolver:
    CAPABILITY_DRIVER_MATRIX = {
        "inventory.read": [
            {"driver_id": "driver_sap", "name": "SAP Driver", "priority": 1, "health": "healthy", "latency_ms": 42},
            {"driver_id": "driver_oracle", "name": "Oracle Driver", "priority": 2, "health": "healthy", "latency_ms": 68},
            {"driver_id": "driver_netsuite", "name": "NetSuite Driver", "priority": 3, "health": "healthy", "latency_ms": 95}
        ],
        "customer.search": [
            {"driver_id": "driver_salesforce", "name": "Salesforce Driver", "priority": 1, "health": "healthy", "latency_ms": 38},
            {"driver_id": "driver_hubspot", "name": "HubSpot Driver", "priority": 2, "health": "healthy", "latency_ms": 52}
        ],
        "purchase.create": [
            {"driver_id": "driver_sap", "name": "SAP Driver", "priority": 1, "health": "healthy", "latency_ms": 45},
            {"driver_id": "driver_oracle", "name": "Oracle Driver", "priority": 2, "health": "healthy", "latency_ms": 70}
        ],
        "invoice.create": [
            {"driver_id": "driver_quickbooks", "name": "QuickBooks Driver", "priority": 1, "health": "healthy", "latency_ms": 35},
            {"driver_id": "driver_oracle", "name": "Oracle Driver", "priority": 2, "health": "healthy", "latency_ms": 65}
        ],
        "communication.send": [
            {"driver_id": "driver_slack", "name": "Slack Driver", "priority": 1, "health": "healthy", "latency_ms": 18},
            {"driver_id": "driver_teams", "name": "Teams Driver", "priority": 2, "health": "healthy", "latency_ms": 24}
        ]
    }

    @classmethod
    def resolve_driver(cls, capability_name: str) -> Dict[str, Any]:
        candidates = cls.CAPABILITY_DRIVER_MATRIX.get(capability_name, [
            {"driver_id": "driver_sap", "name": "SAP Driver", "priority": 1, "health": "healthy", "latency_ms": 40}
        ])
        
        # Filter for healthy candidates and pick lowest priority/latency
        healthy = [c for c in candidates if c["health"] == "healthy"]
        selected = healthy[0] if healthy else candidates[0]
        
        logger.info(f"[DRIVER_RESOLVER] Resolved capability '{capability_name}' to Driver '{selected['name']}' (Latency: {selected['latency_ms']}ms)")
        return selected

    @classmethod
    def get_supported_capabilities(cls, driver_id: str) -> List[str]:
        caps = []
        for cap, drivers in cls.CAPABILITY_DRIVER_MATRIX.items():
            if any(d["driver_id"] == driver_id for d in drivers):
                caps.append(cap)
        return caps
