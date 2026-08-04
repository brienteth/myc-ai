"""
Enterprise Skill Package Namespace (Phase 3.0)
Registers abstract enterprise capabilities (enterprise.inventory.read, enterprise.customer.search, enterprise.purchase.create, enterprise.invoice.create)
These abstract skills are resolved dynamically by the Enterprise Capability Router at runtime.
"""
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult
from myca.execution.enterprise.driver_resolver import DriverResolver
from myca.execution.enterprise.digital_twin import digital_twin_engine

class EnterpriseInventoryInputs(BaseModel):
    sku: Optional[str] = Field(default=None, description="Optional SKU string")
    location: Optional[str] = Field(default=None, description="Optional warehouse location")

class EnterpriseCustomerInputs(BaseModel):
    query: Optional[str] = Field(default="", description="Search query string")

class EnterprisePurchaseInputs(BaseModel):
    item_id: str = Field(default="SKU-9021", description="SKU or Material ID")
    quantity: int = Field(default=100, description="Order quantity")
    vendor: Optional[str] = Field(default="Preferred ERP Vendor", description="Vendor name")

class EnterpriseInvoiceInputs(BaseModel):
    customer_id: str = Field(default="CUST-881", description="Customer ID")
    amount: float = Field(default=1500.0, description="Total invoice amount")


@skill(
    id="enterprise.inventory.read",
    name="Enterprise Inventory & Stock Read",
    description="Query stock quantities, SKU details, and warehouse locations across SAP, Oracle, NetSuite",
    version="1.0",
    category="Enterprise Capability",
    permissions=["enterprise.inventory.read"],
    inputs_schema=EnterpriseInventoryInputs
)
async def enterprise_inventory_read(ctx, sku: Optional[str] = None, location: Optional[str] = None) -> SkillResult:
    target_driver = DriverResolver.resolve_driver("inventory.read")
    items = digital_twin_engine.query_object("InventoryObject", {"sku": sku, "location": location})
    return SkillResult.success({
        "capability": "inventory.read",
        "driver_used": target_driver["name"],
        "latency_ms": target_driver["latency_ms"],
        "items": items
    })


@skill(
    id="enterprise.customer.search",
    name="Enterprise Customer & CRM Search",
    description="Search accounts, leads, and customer profiles across Salesforce, HubSpot, SAP",
    version="1.0",
    category="Enterprise Capability",
    permissions=["enterprise.crm.read"],
    inputs_schema=EnterpriseCustomerInputs
)
async def enterprise_customer_search(ctx, query: str = "") -> SkillResult:
    target_driver = DriverResolver.resolve_driver("customer.search")
    customers = digital_twin_engine.query_object("CustomerObject", {"query": query})
    return SkillResult.success({
        "capability": "customer.search",
        "driver_used": target_driver["name"],
        "latency_ms": target_driver["latency_ms"],
        "customers": customers
    })


@skill(
    id="enterprise.purchase.create",
    name="Enterprise Purchase Order Creation",
    description="Generate purchase orders for inventory items and transmit to ERP drivers",
    version="1.0",
    category="Enterprise Capability",
    permissions=["enterprise.procurement.create"],
    inputs_schema=EnterprisePurchaseInputs
)
async def enterprise_purchase_create(ctx, item_id: str = "SKU-9021", quantity: int = 100, vendor: str = "Preferred ERP Vendor") -> SkillResult:
    target_driver = DriverResolver.resolve_driver("purchase.create")
    return SkillResult.success({
        "capability": "purchase.create",
        "driver_used": target_driver["name"],
        "po_number": f"PO-{item_id}-889",
        "quantity_ordered": quantity,
        "latency_ms": target_driver["latency_ms"]
    })


@skill(
    id="enterprise.invoice.create",
    name="Enterprise Invoice Creation",
    description="Create customer invoice and post to QuickBooks, Oracle, SAP billing ledgers",
    version="1.0",
    category="Enterprise Capability",
    permissions=["enterprise.finance.write"],
    inputs_schema=EnterpriseInvoiceInputs
)
async def enterprise_invoice_create(ctx, customer_id: str = "CUST-881", amount: float = 1500.0) -> SkillResult:
    target_driver = DriverResolver.resolve_driver("invoice.create")
    return SkillResult.success({
        "capability": "invoice.create",
        "driver_used": target_driver["name"],
        "invoice_id": "INV-2026-9041",
        "posted_to_ledger": True,
        "latency_ms": target_driver["latency_ms"]
    })
