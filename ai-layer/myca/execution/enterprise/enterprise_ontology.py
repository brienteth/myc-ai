"""
Enterprise Ontology Engine
Normalizes domain objects (SAP Material = Oracle Inventory Item = QuickBooks Product) into Myca Standard Enterprise Objects.
"""
from typing import Dict, Any, List

class EnterpriseOntology:
    ONTOLOGY_MAP = {
        "InventoryObject": {
            "canonical_fields": ["id", "sku", "name", "stock_quantity", "reorder_threshold", "unit_cost"],
            "system_mappings": {
                "SAP": {"sku": "MaterialNumber", "stock_quantity": "Labst", "unit_cost": "Verpr"},
                "Oracle": {"sku": "ITEM_NUMBER", "stock_quantity": "ON_HAND_QTY", "unit_cost": "ITEM_COST"},
                "QuickBooks": {"sku": "ItemRef", "stock_quantity": "QtyOnHand", "unit_cost": "PurchaseCost"}
            }
        },
        "CustomerObject": {
            "canonical_fields": ["id", "company_name", "contact_email", "status", "arr_value"],
            "system_mappings": {
                "Salesforce": {"company_name": "Account.Name", "contact_email": "Contact.Email", "arr_value": "AnnualRevenue"},
                "HubSpot": {"company_name": "company.name", "contact_email": "email", "arr_value": "total_revenue"},
                "SAP": {"company_name": "Kunnr_Name", "contact_email": "Smtp_Addr", "arr_value": "Netwr"}
            }
        },
        "InvoiceObject": {
            "canonical_fields": ["invoice_id", "customer_id", "total_amount", "currency", "due_date", "status"],
            "system_mappings": {
                "QuickBooks": {"invoice_id": "DocNumber", "total_amount": "TotalAmt", "due_date": "DueDate"},
                "Oracle": {"invoice_id": "INVOICE_NUM", "total_amount": "INVOICE_AMOUNT", "due_date": "DUE_DATE"},
                "SAP": {"invoice_id": "Vbeln", "total_amount": "Netwr", "due_date": "Zfbdt"}
            }
        }
    }

    @classmethod
    def normalize_payload(cls, object_type: str, vendor: str, raw_payload: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a vendor-specific payload into a normalized Myca Canonical Object."""
        spec = cls.ONTOLOGY_MAP.get(object_type)
        if not spec:
            return raw_payload

        v_map = spec["system_mappings"].get(vendor, {})
        normalized = {}
        for canonical_key in spec["canonical_fields"]:
            vendor_key = v_map.get(canonical_key, canonical_key)
            normalized[canonical_key] = raw_payload.get(vendor_key, raw_payload.get(canonical_key))

        normalized["_ontology_type"] = object_type
        normalized["_vendor_source"] = vendor
        return normalized
