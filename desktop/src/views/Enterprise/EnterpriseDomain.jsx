import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Server, Cpu, Network, Zap, CheckSquare, ShieldCheck, PlayCircle, History, BarChart3, Key, Sparkles, Building2 } from 'lucide-react';
import './Enterprise.css';

import EnterpriseDashboard from './EnterpriseDashboard';
import EnterpriseSystems from './EnterpriseSystems';
import EnterpriseDrivers from './EnterpriseDrivers';
import EnterpriseOntology from './EnterpriseOntology';
import EnterpriseCapabilities from './EnterpriseCapabilities';
import EnterpriseApprovals from './EnterpriseApprovals';
import EnterprisePolicies from './EnterprisePolicies';
import EnterpriseExecution from './EnterpriseExecution';
import EnterpriseAudit from './EnterpriseAudit';
import EnterpriseAnalytics from './EnterpriseAnalytics';
import EnterpriseSecrets from './EnterpriseSecrets';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
  { id: 'systems', label: 'Systems', icon: <Server size={15} /> },
  { id: 'drivers', label: 'Drivers', icon: <Cpu size={15} /> },
  { id: 'ontology', label: 'Ontology', icon: <Network size={15} /> },
  { id: 'capabilities', label: 'Capabilities', icon: <Zap size={15} /> },
  { id: 'approvals', label: 'Approvals', icon: <CheckSquare size={15} /> },
  { id: 'policies', label: 'Policies', icon: <ShieldCheck size={15} /> },
  { id: 'execution', label: 'Execution', icon: <PlayCircle size={15} /> },
  { id: 'audit', label: 'Audit', icon: <History size={15} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={15} /> },
  { id: 'secrets', label: 'Secrets', icon: <Key size={15} /> }
];

const EnterpriseDomain = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8420/enterprise/dashboard')
      .then(res => res.json())
      .then(data => setDashboardData(data))
      .catch(err => console.error("Failed to load enterprise dashboard:", err));
  }, []);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard': return <EnterpriseDashboard data={dashboardData} onNavigateTab={setActiveTab} />;
      case 'systems': return <EnterpriseSystems />;
      case 'drivers': return <EnterpriseDrivers />;
      case 'ontology': return <EnterpriseOntology />;
      case 'capabilities': return <EnterpriseCapabilities />;
      case 'approvals': return <EnterpriseApprovals />;
      case 'policies': return <EnterprisePolicies />;
      case 'execution': return <EnterpriseExecution />;
      case 'audit': return <EnterpriseAudit />;
      case 'analytics': return <EnterpriseAnalytics />;
      case 'secrets': return <EnterpriseSecrets />;
      default: return <EnterpriseDashboard data={dashboardData} onNavigateTab={setActiveTab} />;
    }
  };

  return (
    <div className="enterprise-container">
      {/* Domain Top Bar */}
      <div className="enterprise-header">
        <div className="enterprise-header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={22} color="var(--e-moss)" />
            <div>
              <h1>Enterprise Execution Layer</h1>
              <p>Company Nervous System · Abstracting ERP, CRM & Billing into Background Drivers</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: 'var(--e-card-bg)', border: '1px solid var(--e-border)', padding: '6px 12px', borderRadius: 8 }}>
            <Sparkles size={14} color="var(--e-alive)" />
            <span>Digital Twin Graph: Active</span>
          </div>
        </div>

        {/* 11 Navigation Tabs */}
        <div className="enterprise-nav-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main View Area */}
      <div className="enterprise-content-scroll">
        {renderActiveView()}
      </div>
    </div>
  );
};

export default EnterpriseDomain;
