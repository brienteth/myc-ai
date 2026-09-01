/**
 * Enterprise Domain Data Service & Fallback Provider
 * Ensures all 11 Enterprise tabs are 100% functional, responsive, and data-rich
 * regardless of whether the Python backend (http://127.0.0.1:8420/enterprise) is online.
 */

// ── 1. Dashboard Mock Data ────────────────────────────────────────────
export function getDashboardMock() {
  return {
    summary: {
      company_name: 'Acme Manufacturing Enterprise',
      company_health_percent: 97,
      connected_systems_count: 13,
      last_sync: '2 sec ago',
      systems: { healthy: 11, warning: 2, offline: 0 },
      executions: { running: 18, queued: 5, failed: 1 },
      approvals: { pending: 3 },
      estimated_savings: '$128,000'
    },
    cards: {
      card_1_systems: { count: 13, preview: ['SAP S/4HANA', 'Oracle EBS', 'Salesforce CRM', 'Workday HCM', 'PostgreSQL'] },
      card_2_drivers: { count: 41, healthy_count: 39 },
      card_3_capabilities: { count: 856 },
      card_4_today_executions: { count: 3941, sparkline: [420, 680, 910, 1150, 1400, 1890, 2400, 3100, 3941] },
      card_5_money_saved: { amount: '$84,200' },
      card_6_tasks_eliminated: { count: 5118 }
    },
    active_executions: [
      { id: 'exec_fin_report_001', name: 'End-of-Month SAP Ledger Reconciliation', target_driver: 'SAP S/4HANA Driver', progress: 84, status: 'Running' },
      { id: 'exec_gdpr_pii_003', name: 'GDPR PII Scrub & Anonymization Audit', target_driver: 'PostgreSQL Engine Driver', progress: 45, status: 'Running' },
      { id: 'exec_sap_payout_002', name: 'High-Value Invoice Payout #9041 Approval', target_driver: 'Oracle EBS Driver', progress: 0, status: 'Waiting' },
      { id: 'exec_sf_leads_004', name: 'Salesforce Lead Pipeline Sync', target_driver: 'Salesforce CRM Driver', progress: 100, status: 'Completed' }
    ],
    approvals: [
      { id: 'APPR-9402', title: 'High-Value SAP Vendor Payout ($145,000)', amount: '$145,000.00', system: 'SAP S/4HANA (Finance Driver)', risk_score: 'HIGH RISK', risk_level: 'high', timestamp: '10 mins ago' },
      { id: 'APPR-9398', title: 'AWS Production Cluster Scaling (+128 EC2)', amount: '$18,400.00 / mo', system: 'AWS Cloud Driver', risk_score: 'MEDIUM RISK', risk_level: 'medium', timestamp: '32 mins ago' },
      { id: 'APPR-9391', title: 'Oracle Database Schema Migration', amount: 'N/A (Schema Change)', system: 'Oracle DB Enterprise Driver', risk_score: 'CRITICAL', risk_level: 'critical', timestamp: '1 hour ago' }
    ],
    driver_health: [
      { name: 'SAP S/4HANA Driver', category: 'ERP / Finance', status: 'Healthy', latency: '14ms', ops: '1,420 ops/s' },
      { name: 'Salesforce CRM Driver', category: 'Sales & CRM', status: 'Healthy', latency: '42ms', ops: '890 ops/s' },
      { name: 'Oracle EBS Driver', category: 'Finance & Accounting', status: 'Warning', latency: '68ms', ops: '340 ops/s' },
      { name: 'AWS Infrastructure Driver', category: 'Cloud & Mesh', status: 'Healthy', latency: '18ms', ops: '2,150 ops/s' }
    ],
    ai_recommendations: [
      { id: 'rec_01', title: 'Automate SAP Invoice Matching', impact: 'Saves 140 hrs/mo', potential_savings: '$28,500/mo', confidence: 0.96 },
      { id: 'rec_02', title: 'Consolidate Salesforce Leads to HubSpot', impact: 'Eliminates duplicate syncs', potential_savings: '$12,000/mo', confidence: 0.91 }
    ],
    timeline: [
      { time: '11:42 AM', title: 'Automated Invoice Payout Executed', desc: 'SAP Driver processed 42 invoices totaling $318,400.', type: 'success' },
      { time: '11:38 AM', title: 'Passkey Security Multi-Sig Triggered', desc: 'CFO authorization requested for transaction APPR-9402.', type: 'warning' },
      { time: '11:20 AM', title: 'Salesforce CRM Bulk Sync Completed', desc: '1,240 contact records updated across digital twin graph.', type: 'info' }
    ],
    activity_feed: [
      { id: 'act_1', actor: 'SAP ERP Driver', action: 'created invoice', detail: 'INV-9041 for payment processing', timestamp: '1 sec ago' },
      { id: 'act_2', actor: 'Salesforce CRM', action: 'synced customer deal', detail: 'Acme Manufacturing Deal v2', timestamp: '4 sec ago' },
      { id: 'act_3', actor: 'Myca OS', action: 'approved purchase order', detail: 'PO-88102 signed by CFO passkey', timestamp: '8 sec ago' },
      { id: 'act_4', actor: 'Audit Engine', action: 'scrubbed GDPR PII', detail: 'Removed database contact emails', timestamp: '12 sec ago' }
    ]
  };
}

// ── 2. Systems Mock Data ──────────────────────────────────────────────
export function getSystemsMock() {
  const systems = [
    { id: 'sys_sap', name: 'SAP S/4HANA ERP', vendor: 'SAP SE', type: 'ERP', status: 'Healthy', version: '2023.2 Cloud', host: 'sap-prod.internal.net', latency: '14ms', objectsCount: 142, driversCount: 8, lastSync: '10 sec ago' },
    { id: 'sys_oracle', name: 'Oracle EBS Financials', vendor: 'Oracle Corp', type: 'Finance', status: 'Warning', version: 'R12.2.11', host: 'oracle-fin.internal.net', latency: '68ms', objectsCount: 98, driversCount: 6, lastSync: '1 min ago' },
    { id: 'sys_salesforce', name: 'Salesforce CRM Enterprise', vendor: 'Salesforce', type: 'CRM', status: 'Healthy', version: 'v58.0 API', host: 'acme.my.salesforce.com', latency: '42ms', objectsCount: 64, driversCount: 5, lastSync: '3 sec ago' },
    { id: 'sys_workday', name: 'Workday HCM & Payroll', vendor: 'Workday', type: 'HR', status: 'Healthy', version: 'v39.1', host: 'impl.workday.com/acme', latency: '35ms', objectsCount: 52, driversCount: 4, lastSync: '15 sec ago' },
    { id: 'sys_postgres', name: 'PostgreSQL Enterprise DB', vendor: 'PostgreSQL', type: 'Database', status: 'Healthy', version: '15.4 Aurora', host: 'db-cluster.internal', latency: '2ms', objectsCount: 310, driversCount: 12, lastSync: 'Realtime' },
    { id: 'sys_hubspot', name: 'HubSpot Marketing Hub', vendor: 'HubSpot', type: 'CRM', status: 'Healthy', version: 'v3 REST', host: 'api.hubapi.com', latency: '85ms', objectsCount: 28, driversCount: 3, lastSync: '2 min ago' },
    { id: 'sys_snowflake', name: 'Snowflake Data Warehouse', vendor: 'Snowflake', type: 'Cloud', status: 'Healthy', version: '7.32 Enterprise', host: 'acme.snowflakecomputing.com', latency: '22ms', objectsCount: 450, driversCount: 9, lastSync: '5 sec ago' },
    { id: 'sys_stripe', name: 'Stripe Billing & Payments', vendor: 'Stripe Inc', type: 'Finance', status: 'Healthy', version: '2023-10-16', host: 'api.stripe.com', latency: '38ms', objectsCount: 34, driversCount: 4, lastSync: '1 sec ago' },
    { id: 'sys_jira', name: 'Jira Enterprise Cloud', vendor: 'Atlassian', type: 'Productivity', status: 'Warning', version: 'v3 Cloud API', host: 'acme.atlassian.net', latency: '110ms', objectsCount: 76, driversCount: 4, lastSync: '4 min ago' },
    { id: 'sys_netsuite', name: 'Oracle NetSuite ERP', vendor: 'Oracle Corp', type: 'ERP', status: 'Offline', version: '2023.1 SuiteTalk', host: 'webservices.netsuite.com', latency: '—', objectsCount: 88, driversCount: 5, lastSync: '2 hours ago' },
    { id: 'sys_aws_s3', name: 'AWS S3 Enterprise Vault', vendor: 'Amazon Web Services', type: 'Cloud', status: 'Healthy', version: 'v2 SDK', host: 's3.us-east-1.amazonaws.com', latency: '18ms', objectsCount: 1200, driversCount: 7, lastSync: 'Realtime' },
    { id: 'sys_mongodb', name: 'MongoDB Atlas Cluster', vendor: 'MongoDB Inc', type: 'Database', status: 'Healthy', version: '6.0.8 Enterprise', host: 'cluster0.mongodb.net', latency: '12ms', objectsCount: 185, driversCount: 6, lastSync: 'Realtime' },
    { id: 'sys_zendesk', name: 'Zendesk Service Desk', vendor: 'Zendesk Inc', type: 'Support', status: 'Healthy', version: 'v2 REST API', host: 'acme.zendesk.com', latency: '54ms', objectsCount: 41, driversCount: 3, lastSync: '45 sec ago' }
  ];

  return {
    systems,
    stats: { total: 13, healthy: 10, warning: 2, offline: 1 }
  };
}

export function getSystemObjectsMock(sysId) {
  return [
    { name: 'VBRK / Invoice Headers', type: 'Table', records: 142850, fieldsCount: 48, status: 'Synced' },
    { name: 'VBRP / Invoice Items', type: 'Table', records: 582100, fieldsCount: 64, status: 'Synced' },
    { name: 'KNA1 / Customer Master', type: 'Table', records: 28400, fieldsCount: 32, status: 'Synced' },
    { name: 'BSEG / Accounting Document Segment', type: 'Table', records: 1940200, fieldsCount: 82, status: 'Synced' }
  ];
}

export function getSystemCapabilitiesMock(sysId) {
  return [
    { id: 'cap_1', name: 'sap.invoice.create', description: 'Create BAPI_ACC_DOCUMENT_POST invoice entry', speed: '14ms', status: 'Active' },
    { id: 'cap_2', name: 'sap.customer.read', description: 'Fetch customer master record by ID', speed: '8ms', status: 'Active' },
    { id: 'cap_3', name: 'sap.payment.authorize', description: 'Execute multi-sig payment clearance', speed: '22ms', status: 'Active' }
  ];
}

export function getSystemPermissionsMock(sysId) {
  return [
    { name: 'Read Schema & Metadata', status: 'Granted', role: 'Myca OS Service Account' },
    { name: 'Write Transactional Ledger', status: 'Granted (Guarded)', role: 'Passkey Required' },
    { name: 'Admin DDL Execution', status: 'Restricted', role: 'DBA Passkey Required' }
  ];
}

export function getSystemLogsMock(sysId) {
  return [
    { time: '11:42:01', level: 'INFO', msg: 'Handshake connection verified. Latency: 14ms.' },
    { time: '11:40:15', level: 'INFO', msg: 'Batch sync completed: 1,420 records processed.' },
    { time: '11:32:00', level: 'WARN', msg: 'Connection pool warning: 82% utilization.' }
  ];
}

// ── 3. Drivers Mock Data ──────────────────────────────────────────────
export function getDriversMock() {
  const installed = [
    { id: 'driver_sap', name: 'SAP S/4HANA Enterprise Driver', vendor: 'SAP SE / Myca Native', version: '3.4.1', category: 'ERP', status: 'Active', health: 99.4, capabilitiesCount: 42, objectsCount: 142, throughput: '1,420 ops/sec' },
    { id: 'driver_oracle', name: 'Oracle EBS Financials Driver', vendor: 'Oracle / Myca Native', version: '2.8.0', category: 'Finance', status: 'Active', health: 95.1, capabilitiesCount: 38, objectsCount: 98, throughput: '340 ops/sec' },
    { id: 'driver_salesforce', name: 'Salesforce CRM Connector Driver', vendor: 'Salesforce Partner', version: '4.1.0', category: 'CRM', status: 'Active', health: 98.8, capabilitiesCount: 29, objectsCount: 64, throughput: '890 ops/sec' },
    { id: 'driver_postgres', name: 'PostgreSQL Enterprise Engine Driver', vendor: 'Myca Core', version: '5.0.2', category: 'Database', status: 'Active', health: 100, capabilitiesCount: 64, objectsCount: 310, throughput: '4,500 ops/sec' },
    { id: 'driver_aws', name: 'AWS Cloud Mesh Driver', vendor: 'Amazon Web Services', version: '2.1.0', category: 'Cloud', status: 'Active', health: 99.9, capabilitiesCount: 52, objectsCount: 1200, throughput: '2,150 ops/sec' },
    { id: 'driver_stripe', name: 'Stripe Billing & Payments Driver', vendor: 'Stripe Inc', version: '1.9.4', category: 'Finance', status: 'Active', health: 99.7, capabilitiesCount: 18, objectsCount: 34, throughput: '520 ops/sec' },
    { id: 'driver_workday', name: 'Workday HCM Payroll Driver', vendor: 'Workday', version: '2.3.0', category: 'HR', status: 'Active', health: 97.5, capabilitiesCount: 22, objectsCount: 52, throughput: '210 ops/sec' },
    { id: 'driver_hubspot', name: 'HubSpot Marketing Driver', vendor: 'HubSpot', version: '1.4.2', category: 'CRM', status: 'Active', health: 98.2, capabilitiesCount: 15, objectsCount: 28, throughput: '410 ops/sec' }
  ];

  const marketplace = [
    { id: 'mp_snowflake', name: 'Snowflake Data Warehouse Driver', vendor: 'Snowflake Inc', version: '3.1.0', category: 'Analytics', description: 'High-throughput SQL data lake query execution driver.', rating: 4.9, downloads: '14.2k' },
    { id: 'mp_netsuite', name: 'Oracle NetSuite SuiteTalk Driver', vendor: 'Oracle NetSuite', version: '2.0.1', category: 'ERP', description: 'Complete cloud ERP transaction & billing driver.', rating: 4.7, downloads: '9.8k' },
    { id: 'mp_zendesk', name: 'Zendesk Service Desk Driver', vendor: 'Zendesk Inc', version: '1.8.0', category: 'Support', description: 'Customer support ticket & SLA automation driver.', rating: 4.8, downloads: '11.5k' },
    { id: 'mp_servicenow', name: 'ServiceNow ITSM Driver', vendor: 'ServiceNow', version: '4.0.0', category: 'Development', description: 'Enterprise IT service management & incident workflow driver.', rating: 4.9, downloads: '18.1k' },
    { id: 'mp_dynamics', name: 'Microsoft Dynamics 365 Driver', vendor: 'Microsoft', version: '2.5.0', category: 'ERP', description: 'Dynamics 365 Business Central & CRM driver.', rating: 4.6, downloads: '8.4k' }
  ];

  return {
    installed,
    marketplace,
    stats: { installed_count: 12, updates_count: 2, health_pct: 98.4 }
  };
}

// ── 4. Ontology Mock Data ─────────────────────────────────────────────
export function getOntologyMock() {
  const objects = [
    { id: 'obj_invoice', canonical_name: 'InvoiceObject', category: 'Finance', description: 'Normalized Billing Invoice across SAP, Oracle, and Stripe', mappingsCount: 4, confidence: 99.2, status: 'Active' },
    { id: 'obj_customer', canonical_name: 'CustomerObject', category: 'CRM', description: 'Unified Customer Account Entity across Salesforce, HubSpot, and SAP', mappingsCount: 5, confidence: 98.7, status: 'Active' },
    { id: 'obj_purchase_order', canonical_name: 'PurchaseOrderObject', category: 'Procurement', description: 'Enterprise PO entity normalized from SAP ME21N and Oracle PO', mappingsCount: 3, confidence: 97.9, status: 'Active' },
    { id: 'obj_employee', canonical_name: 'EmployeeObject', category: 'HR', description: 'Human Resource Employee record from Workday and SAP HR', mappingsCount: 3, confidence: 99.5, status: 'Active' },
    { id: 'obj_inventory_item', canonical_name: 'InventoryItemObject', category: 'Warehouse', description: 'SKU & Warehouse Stock object normalized across WMS systems', mappingsCount: 4, confidence: 96.8, status: 'Active' },
    { id: 'obj_ledger_entry', canonical_name: 'LedgerEntryObject', category: 'Finance', description: 'General Ledger double-entry transaction record', mappingsCount: 3, confidence: 100, status: 'Active' }
  ];

  return {
    objects,
    stats: { total_objects: 178, total_relationships: 624, normalization_coverage: 98.4 },
    conflicts: [
      { id: 'conf_1', entity: 'CustomerObject.tax_id', vendor1: 'SAP (STCEG)', vendor2: 'Salesforce (Tax_ID__c)', issue: 'Format Mismatch: SAP uses EU VAT format, Salesforce plain string.', severity: 'Medium' }
    ],
    history: [
      { time: '10 mins ago', user: 'Auto-Mapper AI', action: 'Mapped Oracle V_AP_10 -> LedgerEntryObject', status: 'Approved' },
      { time: '2 hours ago', user: 'Admin Passkey', action: 'Created Canonical Object InvoiceObject', status: 'Approved' }
    ]
  };
}

// ── 5. Capabilities Mock Data ─────────────────────────────────────────
export function getCapabilitiesMock() {
  const catalog = [
    { id: 'cap_invoice_create', name: 'invoice.create', category: 'Finance', description: 'Create and post financial invoice across ERP drivers', speed: '14ms', routed_drivers: ['SAP Driver', 'Oracle Driver', 'Stripe Driver'], status: 'Active' },
    { id: 'cap_invoice_pay', name: 'invoice.pay', category: 'Finance', description: 'Execute multi-sig authorized vendor payout', speed: '22ms', routed_drivers: ['Stripe Driver', 'SAP Driver'], status: 'Active' },
    { id: 'cap_customer_create', name: 'customer.create', category: 'CRM', description: 'Provision new customer master account across CRM stack', speed: '18ms', routed_drivers: ['Salesforce Driver', 'HubSpot Driver'], status: 'Active' },
    { id: 'cap_po_approve', name: 'po.approve', category: 'Procurement', description: 'Approve purchase order and commit budget reserve', speed: '10ms', routed_drivers: ['SAP Driver', 'Oracle Driver'], status: 'Active' },
    { id: 'cap_lead_sync', name: 'lead.sync', category: 'CRM', description: 'Synchronize inbound leads with scoring & deduplication', speed: '32ms', routed_drivers: ['Salesforce Driver', 'HubSpot Driver'], status: 'Active' },
    { id: 'cap_payroll_process', name: 'payroll.process', category: 'HR', description: 'Calculate and dispatch monthly payroll ledger batch', speed: '45ms', routed_drivers: ['Workday Driver'], status: 'Active' },
    { id: 'cap_inventory_deduct', name: 'inventory.deduct', category: 'Warehouse', description: 'Atomic stock decrement for order fulfillment', speed: '5ms', routed_drivers: ['SAP Driver', 'PostgreSQL Driver'], status: 'Active' },
    { id: 'cap_pii_anonymize', name: 'pii.anonymize', category: 'Compliance', description: 'Scrub customer PII under GDPR Article 17 right to erasure', speed: '12ms', routed_drivers: ['PostgreSQL Driver', 'Salesforce Driver'], status: 'Active' }
  ];

  return {
    capabilities: catalog,
    stats: { total_capabilities: 856, registered_drivers: 41, coverage_percent: 100 },
    history: [
      { time: '11:42 AM', capability: 'invoice.pay', status: 'Success', elapsed_ms: 18.4, routed: 'SAP Driver' },
      { time: '11:35 AM', capability: 'lead.sync', status: 'Success', elapsed_ms: 28.1, routed: 'Salesforce Driver' }
    ]
  };
}

// ── 6. Executions Mock Data ───────────────────────────────────────────
export function getExecutionsMock() {
  const executions = [
    { id: 'exec_fin_report_001', name: 'End-of-Month SAP Ledger Reconciliation', need: 'Automate month-end GL reconciliation across SAP & Oracle', priority: 'High', status: 'running', progress: 84, duration_ms: 18420, stepsCompleted: 5, stepsTotal: 6, created_at: '10 mins ago', triggered_by: 'Cron Schedule (Monthly)' },
    { id: 'exec_sap_payout_002', name: 'High-Value Invoice Payout #9041 Approval', need: 'Execute vendor payout exceeding $50k threshold', priority: 'High', status: 'waiting', progress: 0, duration_ms: 0, stepsCompleted: 2, stepsTotal: 4, created_at: '18 mins ago', triggered_by: 'Passkey Multi-Sig Queue' },
    { id: 'exec_gdpr_pii_003', name: 'GDPR PII Scrub & Anonymization Audit', need: 'Scrub expired PII from marketing databases', priority: 'Medium', status: 'running', progress: 45, duration_ms: 8200, stepsCompleted: 3, stepsTotal: 7, created_at: '25 mins ago', triggered_by: 'Compliance Policy POL-102' },
    { id: 'exec_sf_leads_004', name: 'Salesforce Lead Pipeline Sync', need: 'Batch sync top-funnel leads to HubSpot & SAP CRM', priority: 'Normal', status: 'completed', progress: 100, duration_ms: 3410, stepsCompleted: 4, stepsTotal: 4, created_at: '42 mins ago', triggered_by: 'Webhook Event' },
    { id: 'exec_aws_scale_005', name: 'AWS Cluster Auto-Scale Provisioning', need: 'Spin up 64 worker EC2 nodes for ML training job', priority: 'High', status: 'completed', progress: 100, duration_ms: 14200, stepsCompleted: 5, stepsTotal: 5, created_at: '1 hour ago', triggered_by: 'Auto-Scaler Agent' }
  ];

  return {
    executions,
    counts: { all: 5, running: 2, waiting: 1, completed: 2, failed: 0 }
  };
}

export function getExecutionDetailMock(execId) {
  return {
    id: execId,
    name: 'End-of-Month SAP Ledger Reconciliation',
    need: 'Automate month-end GL reconciliation across SAP & Oracle',
    priority: 'High',
    status: 'running',
    progress: 84,
    environment: 'Production',
    policy: 'SOX Financial Governance',
    duration_ms: 18420,
    nodes: [
      { id: 'n1', type: 'executionNode', data: { label: 'Fetch SAP General Ledger', type: 'system', status: 'completed', duration_ms: 420, driver: 'SAP Driver' } },
      { id: 'n2', type: 'executionNode', data: { label: 'Fetch Oracle EBS Balance', type: 'system', status: 'completed', duration_ms: 680, driver: 'Oracle Driver' } },
      { id: 'n3', type: 'executionNode', data: { label: 'Canonical Object Mapping (LedgerEntryObject)', type: 'primitive', status: 'completed', duration_ms: 140, driver: 'Ontology Engine' } },
      { id: 'n4', type: 'executionNode', data: { label: 'Reconcile Discrepancies & Audit', type: 'primitive', status: 'running', duration_ms: 1200, driver: 'AI Audit Agent' } },
      { id: 'n5', type: 'executionNode', data: { label: 'Generate Compliance Artifact PDF', type: 'system', status: 'idle', duration_ms: null, driver: 'PDF Writer' } }
    ]
  };
}

// ── 7. Audit Forensics Mock Data ──────────────────────────────────────
export function getAuditMock() {
  const executions = [
    { id: 'AUD-8801', name: 'End-of-Month SAP Ledger Reconciliation', user: 'Autonomous Agent #4', status: 'completed', timestamp: '2026-08-06 11:42:00', duration_ms: 18420, drivers_involved: ['SAP Driver', 'Oracle Driver'], policy_checks: 14, passkey_auth: 'Verified' },
    { id: 'AUD-8802', name: 'High-Value Invoice Payout #9041', user: 'CFO Passkey (J. Doe)', status: 'completed', timestamp: '2026-08-06 11:38:12', duration_ms: 1240, drivers_involved: ['SAP Driver', 'Stripe Driver'], policy_checks: 8, passkey_auth: 'Verified (YubiKey)' },
    { id: 'AUD-8803', name: 'GDPR PII Scrub & Anonymization Audit', user: 'Policy Engine (POL-102)', status: 'completed', timestamp: '2026-08-06 11:20:05', duration_ms: 8200, drivers_involved: ['PostgreSQL Driver'], policy_checks: 24, passkey_auth: 'System Auto' }
  ];

  return {
    total_audit_entries: 142850,
    verified_chains: '100%',
    compliance_score: 99.8,
    tamper_proof: true,
    executions
  };
}

// ── 8. Analytics Mock Data ────────────────────────────────────────────
export function getAnalyticsMock() {
  return {
    overview: {
      monthly_roi: { value: '$184,500', pct: '24%', trend: 'up' },
      hours_saved: { value: '3,840 hrs', pct: '18%', trend: 'up' },
      automated_tasks: { value: '142,900', pct: '31%', trend: 'up' },
      avg_runtime: { value: '18.4 ms', pct: '12%', trend: 'up' }
    },
    score: {
      overall: 94,
      breakdown: [
        { metric: 'Driver Coverage', score: '98/100' },
        { metric: 'Ontology Normalization', score: '96/100' },
        { metric: 'Policy Compliance (SOX/GDPR)', score: '100/100' },
        { metric: 'Execution Latency Optimization', score: '92/100' }
      ]
    },
    roi: {
      net_savings: '$184,500 / month',
      payback_period: '1.2 months',
      hours_saved: '3,840 hrs',
      this_month: {
        total_enterprise_value: '$184,500',
        estimated_salary_savings: '$142,000',
        software_licenses_reduced: '$42,500',
        manual_hours_eliminated: '3,840'
      }
    },
    workflows: [
      { name: 'SAP Invoice Reconciliation', department: 'Finance', savings: '$42,000/mo', hours: '850 hrs/mo', status: 'Active', runs: 1420, success: '99.8%', time_saved: '850 hrs', money_saved: '$42,000/mo' },
      { name: 'Salesforce Lead Routing', department: 'Sales', savings: '$28,000/mo', hours: '620 hrs/mo', status: 'Active', runs: 890, success: '100%', time_saved: '620 hrs', money_saved: '$28,000/mo' },
      { name: 'Workday Onboarding Provisioning', department: 'HR', savings: '$18,500/mo', hours: '410 hrs/mo', status: 'Active', runs: 210, success: '98.5%', time_saved: '410 hrs', money_saved: '$18,500/mo' }
    ],
    departments: [
      { department: 'Finance & Accounting', dept: 'Finance & Accounting', savings: '$84,500/mo', automated_pct: '92%', automated: 92 },
      { department: 'Sales & CRM Operations', dept: 'Sales & CRM Operations', savings: '$48,000/mo', automated_pct: '88%', automated: 88 },
      { department: 'IT & Infrastructure', dept: 'IT & Infrastructure', savings: '$32,000/mo', automated_pct: '95%', automated: 95 },
      { department: 'HR & People Operations', dept: 'HR & People Operations', savings: '$20,000/mo', automated_pct: '84%', automated: 84 }
    ],
    intelligence: {
      summary: 'Company execution speed increased by 3.2x this month. SAP and Postgres drivers account for 78% of all atomic operations with 99.9% uptime.',
      planner_stats: {
        generated: 412,
        accepted: 398
      },
      optimizations: [
        { action: 'Combine SAP & Oracle ledger queries into parallel mesh pipeline', target: 'Execution Studio' },
        { action: 'Enable automatic PII scrubbing on Salesforce lead ingestion', target: 'Compliance Engine' },
        { action: 'Cache frequent BAPI document queries in local vector memory', target: 'Driver Memory' }
      ],
      bottlenecks: [
        { node: 'Oracle EBS TNS DB Connection', time: '68ms', is_bottleneck: true },
        { node: 'SAP S/4HANA BAPI Post', time: '14ms', is_bottleneck: false },
        { node: 'PostgreSQL Aurora Query', time: '2ms', is_bottleneck: false }
      ]
    },
    energy_cost: {
      monthly_kwh: '420 kWh',
      carbon_neutral: true,
      compute_efficiency: '0.002 Wh per execution'
    },
    live: {
      ops_per_sec: 2840,
      active_threads: 42,
      latency_p99: '24ms'
    }
  };
}

// ── 9. Secrets Vault Mock Data ────────────────────────────────────────
export function getSecretsMock() {
  return {
    overview: {
      total_secrets: 48,
      healthy: 46,
      expiring_soon: 2,
      compromised: 0,
      encryption: 'AES-256-GCM (Hardware TPM / macOS Keychain)'
    },
    vault: [
      { id: 'sec_1', name: 'SAP_PRODUCTION_BAPI_TOKEN', type: 'API Key / Token', env: 'Production', environment: 'Production', owner: 'Finance Ops', status: 'Healthy', expires: 'In 84 days', rotation_policy: '30-Day Auto Rotate', usage: 'Used 1,420 times / day by SAP Driver', permissions: ['fs.read', 'fs.write', 'network.out'] },
      { id: 'sec_2', name: 'ORACLE_EBS_DB_SECRET', type: 'DB Password', env: 'Production', environment: 'Production', owner: 'DBA Team', status: 'Expiring Soon', expires: 'In 4 days', rotation_policy: 'Manual Passkey Approval', usage: 'Used 340 times / day by Oracle Driver', permissions: ['db.connect', 'db.execute'] },
      { id: 'sec_3', name: 'SALESFORCE_OAUTH_CLIENT_SECRET', type: 'OAuth Secret', env: 'Production', environment: 'Production', owner: 'Salesforce Admin', status: 'Healthy', expires: 'In 180 days', rotation_policy: '90-Day Auto Rotate', usage: 'Used 890 times / day by Salesforce Driver', permissions: ['crm.read', 'crm.write'] },
      { id: 'sec_4', name: 'AWS_KMS_MASTER_KEY', type: 'Encryption Key', env: 'Production', environment: 'Production', owner: 'DevOps Team', status: 'Healthy', expires: 'Never (Auto-Rotate)', rotation_policy: 'KMS Hardware Managed', usage: 'Used 2,150 times / day by AWS Mesh Driver', permissions: ['kms.decrypt', 'kms.encrypt'] },
      { id: 'sec_5', name: 'TELEGRAM_BOT_NOTIF_TOKEN', type: 'Bot Token', env: 'Production', environment: 'Production', owner: 'Automation Studio', status: 'Healthy', expires: 'In 365 days', rotation_policy: 'Annual Rotate', usage: 'Used 420 times / day by Notification Engine', permissions: ['telegram.send'] }
    ],
    connections: [
      { name: 'SAP S/4HANA Connection', desc: 'Enterprise ERP BAPI Interface over TLS', host: 'sap-prod.internal.net:8443', protocol: 'RFC / HTTPS', status: 'Connected' },
      { name: 'Oracle EBS TNS Listener', desc: 'Database Financials TNS Listener', host: 'oracle-fin.internal.net:1521', protocol: 'TNS / TLS', status: 'Connected' },
      { name: 'PostgreSQL Aurora Primary', desc: 'Aurora Relational Database Cluster', host: 'db-cluster.internal:5432', protocol: 'Postgres SSL', status: 'Connected' }
    ],
    certificates: [
      { name: 'internal-mesh-ca.crt', domain: '*.internal.net', type: 'mTLS CA Certificate', issuer: 'Myca Sovereign CA', expires: '2028-12-31', status: 'Healthy' },
      { name: 'saml-sso-idp.pem', domain: 'sso.acme.com', type: 'SAML IdP X.509 Certificate', issuer: 'Okta CA', expires: '2027-06-15', status: 'Healthy' }
    ],
    ssh: [
      { name: 'id_ed25519_deploy_key', type: 'Ed25519', permissions: 'Read/Write Repo Deploy', fingerprint: 'SHA256:x98F...m2A', used: '2 mins ago', status: 'Active' }
    ],
    wallets: [
      { name: 'Enterprise Treasury Web3 Wallet', address: '0x71C...84F1', chain: '0G Compute Network / Ethereum', balance: '42,500 0G / 14.2 ETH', policy: '2-of-3 Multi-Sig', signers: 'CFO, CTO, Security Lead', status: 'Active' }
    ],
    rotation: [
      { name: 'Oracle DB Password Rotation', type: 'DB Credential', frequency: 'Every 30 days', due: 'In 4 days', next_rotation: 'In 4 days', auto_trigger: 'Enabled' },
      { name: 'AWS IAM Secret Rotation', type: 'IAM Key', frequency: 'Every 90 days', due: 'In 42 days', next_rotation: 'In 42 days', auto_trigger: 'Enabled' }
    ],
    audit: [
      { time: '11:42 AM', user: 'SAP Driver', action: 'Decrypted BAPI Token', target: 'SAP_PRODUCTION_BAPI_TOKEN', status: 'Success' },
      { time: '11:38 AM', user: 'Oracle Driver', action: 'Decrypted DB Password', target: 'ORACLE_EBS_DB_SECRET', status: 'Success' }
    ],
    live: {
      vault: 'Locked & Protected',
      connections: 13,
      auth_failures: 0,
      requests_per_sec: 2840,
      encryptions_count: 14280
    }
  };
}
