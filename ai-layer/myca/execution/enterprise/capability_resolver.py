"""
Enterprise Capability Resolver
Resolves abstract business capabilities (e.g. inventory.read, customer.search) to target Ontology Specs.
"""
from typing import Dict, Any

class CapabilityResolver:
    CAPABILITY_CATALOG = {
        "inventory.read": {
            "title": "Read Stock & Inventory",
            "ontology_object": "InventoryObject",
            "description": "Fetch inventory items, stock levels, and warehouse locations",
            "default_permission": "enterprise.inventory.read"
        },
        "inventory.update": {
            "title": "Update Inventory Levels",
            "ontology_object": "InventoryObject",
            "description": "Adjust stock counts, warehouse assignments, and reorder alerts",
            "default_permission": "enterprise.inventory.write"
        },
        "customer.search": {
            "title": "Search Customers & Leads",
            "ontology_object": "CustomerObject",
            "description": "Query CRM records, accounts, and contact emails",
            "default_permission": "enterprise.crm.read"
        },
        "purchase.create": {
            "title": "Create Purchase Order",
            "ontology_object": "PurchaseOrderObject",
            "description": "Issue purchase order to vendors and ERP systems",
            "default_permission": "enterprise.procurement.create"
        },
        "invoice.create": {
            "title": "Create Invoice",
            "ontology_object": "InvoiceObject",
            "description": "Post new customer invoice to billing and ledger systems",
            "default_permission": "enterprise.finance.write"
        },
        "payment.approve": {
            "title": "Approve Payment Disbursement",
            "ontology_object": "PaymentObject",
            "description": "Approve accounts payable payment disbursement",
            "default_permission": "enterprise.finance.approve",
            "requires_approval": True
        }
    }

    @classmethod
    def resolve_capability(cls, capability_name: str) -> Dict[str, Any]:
        info = cls.CAPABILITY_CATALOG.get(capability_name, {
            "title": capability_name.capitalize(),
            "ontology_object": "GenericObject",
            "description": f"Execute enterprise capability {capability_name}",
            "default_permission": "enterprise.general"
        })
        info["capability_name"] = capability_name
        return info
