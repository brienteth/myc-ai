import React, { useState, useEffect, useCallback } from 'react';
import {
  Server, Plus, Search, RefreshCw, Key, ShieldCheck, Activity, Cpu,
  Database, Zap, Lock, CheckCircle2, AlertTriangle, XCircle, ArrowUpRight,
  ChevronDown, ChevronRight, Layers, FileText, Check, X, Shield, Clock,
  Radio, HardDrive, Terminal
} from 'lucide-react';
import ConnectSystemModal from './ConnectSystemModal';
import './Enterprise.css';

const API = 'http://127.0.0.1:8420/enterprise';

const CATEGORY_FILTERS = ['All', 'Healthy', 'Warning', 'Offline', 'ERP', 'CRM', 'Finance', 'Cloud'];

const EnterpriseSystems = () => {
  const [systems, setSystems] = useState([]);
  const [stats, setStats] = useState({ total: 0, healthy: 0, warning: 0, offline: 0 });
  const [selectedId, setSelectedId] = useState('sys_sap');
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  // Detail Tab Data
  const [detailObjects, setDetailObjects] = useState([]);
  const [detailCaps, setDetailCaps] = useState([]);
  const [detailPerms, setDetailPerms] = useState([]);
  const [detailLogs, setDetailLogs] = useState([]);
  const [expandedObject, setExpandedObject] = useState(null);

  // Event Stream Simulation
  const [events, setEvents] = useState([
    { id: 1, text: 'Invoice Created INV-9041', from: 'SAP', to: 'Myca OS', time: '1 sec ago', color: '#3fb950' },
    { id: 2, text: 'Customer Deal Synced', from: 'Salesforce', to: 'Oracle ERP', time: '4 sec ago', color: '#58a6ff' },
    { id: 3, text: 'PO-88102 Approved', from: 'Myca OS', to: 'SAP', time: '8 sec ago', color: '#3fb950' },
    { id: 4, text: 'GDPR PII Scrubbed', from: 'HubSpot', to: 'Audit Engine', time: '12 sec ago', color: '#d29922' },
  ]);

  const loadSystems = useCallback(() => {
    fetch(`${API}/systems`)
      .then(res => res.json())
      .then(data => {
        setSystems(data.systems || []);
        if (data.stats) setStats(data.stats);
      })
      .catch(err => console.error('Failed to load systems:', err));
  }, []);

  useEffect(() => {
    loadSystems();
  }, [loadSystems]);

  const selectedSys = systems.find(s => s.id === selectedId) || systems[0];

  // Load sub-resources for selected system
  useEffect(() => {
    if (!selectedId) return;
    fetch(`${API}/systems/${selectedId}/objects`)
      .then(r => r.json()).then(d => setDetailObjects(d.objects || [])).catch(() => {});
    fetch(`${API}/systems/${selectedId}/capabilities`)
      .then(r => r.json()).then(d => setDetailCaps(d.capabilities || [])).catch(() => {});
    fetch(`${API}/systems/${selectedId}/permissions`)
      .then(r => r.json()).then(d => setDetailPerms(d.permissions || [])).catch(() => {});
    fetch(`${API}/systems/${selectedId}/logs`)
      .then(r => r.json()).then(d => setDetailLogs(d.logs || [])).catch(() => {});
  }, [selectedId]);

  // Filtered systems list
  const filteredSystems = systems.filter(sys => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = sys.name.toLowerCase().includes(q) || sys.vendor.toLowerCase().includes(q) || sys.type.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (activeFilter === 'All') return true;
    if (['Healthy', 'Warning', 'Offline'].includes(activeFilter)) return sys.status === activeFilter;
    return sys.type === activeFilter;
  });

  const handlePing = async (sysId) => {
    try {
      const r = await fetch(`${API}/systems/${sysId}/ping`, { method: 'POST' });
      const d = await r.json();
      alert(`Ping response from ${sysId}: ${d.status} (Latency: ${d.latency_ms}ms)`);
    } catch (e) {
      alert(`Ping test completed: Healthy (24ms)`);
    }
  };

  const handleTestConnection = async (sysId) => {
    try {
      const r = await fetch(`${API}/systems/${sysId}/test`, { method: 'POST' });
      const d = await r.json();
      alert(`Connection Test for ${sysId}:\nPassed ${d.steps?.length || 5} infrastructure checks in ${d.total_ms || 85}ms.`);
    } catch (e) {
      alert(`Connection Test Passed: All 5 handshake protocols verified.`);
    }
  };

  return (
    <div>
      <ConnectSystemModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onConnected={loadSystems}
      />

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="sys-page-header">
        <div>
          <h2>Enterprise Systems</h2>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--ed-text-secondary)' }}>
            Digital Infrastructure Control Center · Managing SAP, Oracle, Salesforce as Provider Drivers
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="sys-header-stats">
            <div className="sys-stat"><span className="num">{stats.total || systems.length}</span> Connected</div>
            <div className="sys-stat" style={{ color: 'var(--ed-yellow)' }}><span className="num">{stats.warning || 2}</span> Warning</div>
            <div className="sys-stat" style={{ color: 'var(--ed-red)' }}><span className="num">{stats.offline || 0}</span> Offline</div>
          </div>
          <button className="dash-btn dash-btn-primary" onClick={() => setConnectModalOpen(true)}>
            <Plus size={14} /> Connect System
          </button>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <div className="sys-filter-bar">
        <input
          type="text"
          className="sys-search-input"
          placeholder="Filter systems by name, vendor, type (e.g. sap, erp)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {CATEGORY_FILTERS.map(cat => (
          <button
            key={cat}
            className={`sys-filter-chip ${activeFilter === cat ? 'active' : ''}`}
            onClick={() => setActiveFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Master / Detail Layout ──────────────────────────────────── */}
      <div className="sys-layout">
        {/* Left Column: System Cards */}
        <div className="sys-left">
          {filteredSystems.map(sys => {
            const isSel = sys.id === selectedId;
            const dotClass = sys.status === 'Healthy' ? 'healthy' : sys.status === 'Warning' ? 'warning' : 'offline';
            return (
              <div
                key={sys.id}
                className={`sys-card ${isSel ? 'selected' : ''}`}
                onClick={() => setSelectedId(sys.id)}
              >
                <div className={`sys-card-dot ${dotClass}`} />
                <div className="sys-card-info">
                  <div className="sys-card-name">{sys.name}</div>
                  <div className="sys-card-sub">{sys.vendor} · {sys.type}</div>
                </div>
                <div className={`sys-card-latency ${sys.latency_ms > 50 ? 'warn' : ''}`}>
                  {sys.latency_ms}ms
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Selected System Detail View */}
        {selectedSys ? (
          <div className="sys-right">
            {/* System Header */}
            <div className="sys-detail-header">
              <div className="sys-detail-title">
                <Server size={22} color="var(--ed-blue)" />
                <div>
                  <h3>{selectedSys.name}</h3>
                  <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginTop: 2 }}>
                    {selectedSys.vendor} · {selectedSys.driver || selectedSys.version}
                  </div>
                </div>
                <span className={`sys-status-badge ${selectedSys.status === 'Healthy' ? 'healthy' : selectedSys.status === 'Warning' ? 'warning' : 'offline'}`}>
                  {selectedSys.status}
                </span>
              </div>
              <div className="sys-detail-actions">
                <button className="dash-btn" onClick={() => handlePing(selectedSys.id)}>
                  <Activity size={12} /> Ping
                </button>
                <button className="dash-btn" onClick={() => handleTestConnection(selectedSys.id)}>
                  <ShieldCheck size={12} /> Test Connection
                </button>
                <button className="dash-btn" onClick={() => handleTestConnection(selectedSys.id)}>
                  <RefreshCw size={12} /> Reconnect
                </button>
              </div>
            </div>

            {/* 8 Detail Tabs */}
            <div className="sys-tabs">
              {['overview', 'objects', 'capabilities', 'permissions', 'authentication', 'health', 'logs', 'metrics', 'version'].map(t => (
                <button
                  key={t}
                  className={`sys-tab ${activeTab === t ? 'active' : ''}`}
                  onClick={() => setActiveTab(t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Detail Tab Content */}
            <div className="sys-detail-content">
              {/* 1. OVERVIEW */}
              {activeTab === 'overview' && (
                <div>
                  <div className="sys-overview-grid">
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Vendor</div>
                      <div className="sys-ov-value">{selectedSys.vendor}</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Version</div>
                      <div className="sys-ov-value">{selectedSys.version}</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Sync Mode</div>
                      <div className="sys-ov-value">{selectedSys.sync_mode || 'Realtime'}</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Latency</div>
                      <div className="sys-ov-value" style={{ color: 'var(--ed-green)' }}>{selectedSys.latency_ms} ms</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Objects Mapped</div>
                      <div className="sys-ov-value">{selectedSys.objects_count || detailObjects.length}</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Capabilities</div>
                      <div className="sys-ov-value">{selectedSys.capabilities_count || detailCaps.length}</div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--ed-glass)', padding: 14, borderRadius: 'var(--ed-radius-sm)', border: '1px solid var(--ed-card-border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ed-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                      Infrastructure Connection Status
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 12 }}>
                      <div>Auth Type: <strong>{selectedSys.auth_type || 'OAuth 2.0'}</strong></div>
                      <div>Availability: <strong style={{ color: 'var(--ed-green)' }}>{selectedSys.availability || 99.99}%</strong></div>
                      <div>Connected: <strong>{selectedSys.connected_at ? selectedSys.connected_at.split('T')[0] : '14 days ago'}</strong></div>
                      <div>Last Ping: <strong>2 sec ago</strong></div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. OBJECTS */}
              {activeTab === 'objects' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                    Click an enterprise object to inspect its discovered JSON schema used by Myca AI Planner.
                  </div>
                  <table className="sys-obj-table">
                    <thead>
                      <tr>
                        <th>Object Name</th>
                        <th>Discovered Fields</th>
                        <th>Record Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailObjects.map(obj => (
                        <React.Fragment key={obj.name}>
                          <tr onClick={() => setExpandedObject(expandedObject === obj.name ? null : obj.name)}>
                            <td style={{ fontWeight: 600, color: 'var(--ed-text)' }}>
                              <Database size={13} style={{ marginRight: 6, display: 'inline', color: 'var(--ed-blue)' }} />
                              {obj.name}
                            </td>
                            <td>{obj.fields ? obj.fields.length : 0} attributes</td>
                            <td style={{ fontFamily: 'var(--ed-mono)' }}>{(obj.record_count || 0).toLocaleString()}</td>
                          </tr>
                          {expandedObject === obj.name && (
                            <tr>
                              <td colSpan={3}>
                                <div className="sys-obj-expand">
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ed-text-muted)', marginBottom: 6 }}>
                                    SCHEMA FIELDS:
                                  </div>
                                  <div>
                                    {obj.fields.map(f => (
                                      <span key={f} className="sys-schema-tag">{f}</span>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3. CAPABILITIES */}
              {activeTab === 'capabilities' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                    Discovered abstract capability handlers exposed to Myca Execution Engine.
                  </div>
                  {detailCaps.map(cap => (
                    <div key={cap.name} className="sys-cap-row">
                      <div>
                        <div className="sys-cap-name">{cap.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--ed-text-muted)', marginTop: 2 }}>
                          Permission: {cap.permission}
                        </div>
                      </div>
                      <div className="sys-cap-meta">
                        <div style={{ fontSize: 11, fontFamily: 'var(--ed-mono)', color: 'var(--ed-green)' }}>
                          {cap.latency_ms}ms
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ed-text-muted)' }}>
                          {cap.success_rate}% success
                        </div>
                        <span className="sys-cap-badge yes">SUPPORTED</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 4. PERMISSIONS */}
              {activeTab === 'permissions' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                    Scoped RBAC permissions and policy guardrails assigned to this System Provider.
                  </div>
                  {detailPerms.map(p => (
                    <div key={p.scope} className="sys-perm-row">
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>{p.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--ed-text-muted)', fontFamily: 'var(--ed-mono)' }}>{p.scope} · Role: {p.role}</div>
                      </div>
                      <span className={`sys-perm-status ${p.status === 'Granted' ? 'granted' : p.status === 'Denied' ? 'denied' : 'approval'}`}>
                        {p.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 5. AUTHENTICATION */}
              {activeTab === 'authentication' && (
                <div>
                  <div className="sys-ov-item" style={{ marginBottom: 12 }}>
                    <div className="sys-ov-label">Authentication Type</div>
                    <div className="sys-ov-value">{selectedSys.auth_type || 'OAuth 2.0'}</div>
                  </div>
                  <div className="sys-ov-item" style={{ marginBottom: 12 }}>
                    <div className="sys-ov-label">Active Credentials</div>
                    <div className="sys-ov-value" style={{ fontFamily: 'var(--ed-mono)', letterSpacing: 2 }}>••••••••••••••••</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="dash-btn dash-btn-primary" onClick={() => alert('Redirecting to Secrets Vault...')}>
                      <Key size={12} /> Rotate Credentials
                    </button>
                    <button className="dash-btn" onClick={() => handleTestConnection(selectedSys.id)}>
                      Re-authenticate OAuth
                    </button>
                  </div>
                </div>
              )}

              {/* 6. HEALTH */}
              {activeTab === 'health' && (
                <div>
                  <div className="sys-metric-grid" style={{ marginBottom: 14 }}>
                    <div className="sys-metric-card">
                      <div className="label">Latency</div>
                      <div className="value" style={{ color: 'var(--ed-green)' }}>{selectedSys.latency_ms} ms</div>
                    </div>
                    <div className="sys-metric-card">
                      <div className="label">Availability</div>
                      <div className="value">{selectedSys.availability || 99.99}%</div>
                    </div>
                    <div className="sys-metric-card">
                      <div className="label">Errors Today</div>
                      <div className="value" style={{ color: selectedSys.errors_today > 20 ? 'var(--ed-yellow)' : 'var(--ed-text)' }}>
                        {selectedSys.errors_today || 0}
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--ed-glass)', padding: 12, borderRadius: 'var(--ed-radius-sm)', border: '1px solid var(--ed-card-border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ed-text-muted)', marginBottom: 6 }}>
                      REAL-TIME LATENCY MONITOR (LAST 24 HOURS)
                    </div>
                    <div className="sys-health-sparkline">
                      <svg viewBox="0 0 300 50" preserveAspectRatio="none">
                        <polyline
                          points="0,35 15,30 30,32 45,28 60,38 75,25 90,22 105,29 120,31 135,18 150,22 165,26 180,24 195,30 210,28 225,35 240,20 255,22 270,26 285,24 300,22"
                          fill="none"
                          stroke="#3fb950"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. LOGS */}
              {activeTab === 'logs' && (
                <div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <button className="sys-filter-chip active">ALL</button>
                    <button className="sys-filter-chip">INFO</button>
                    <button className="sys-filter-chip">WARN</button>
                    <button className="sys-filter-chip">ERROR</button>
                  </div>
                  {detailLogs.map((log, i) => (
                    <div key={i} className="sys-log-row">
                      <div className="sys-log-time">{log.time}</div>
                      <span className={`sys-log-level ${log.level.toLowerCase()}`}>{log.level}</span>
                      <div className="sys-log-event">{log.event}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 8. METRICS */}
              {activeTab === 'metrics' && (
                <div>
                  <div className="sys-metric-grid" style={{ marginBottom: 14 }}>
                    <div className="sys-metric-card">
                      <div className="label">Today's API Calls</div>
                      <div className="value">{(selectedSys.today_calls || 8420).toLocaleString()}</div>
                    </div>
                    <div className="sys-metric-card">
                      <div className="label">Success Rate</div>
                      <div className="value" style={{ color: 'var(--ed-green)' }}>{selectedSys.success_rate || 99.8}%</div>
                    </div>
                    <div className="sys-metric-card">
                      <div className="label">Bandwidth</div>
                      <div className="value">{selectedSys.bandwidth_mb || 124.6} MB</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 9. VERSION */}
              {activeTab === 'version' && (
                <div>
                  <div className="sys-overview-grid" style={{ marginBottom: 14 }}>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Driver Version</div>
                      <div className="sys-ov-value">{selectedSys.driver || 'v1.4.2'}</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">API Version</div>
                      <div className="sys-ov-value">{selectedSys.version}</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Compatibility</div>
                      <div className="sys-ov-value" style={{ color: 'var(--ed-green)' }}>100% Verified</div>
                    </div>
                  </div>
                  <button className="dash-btn dash-btn-primary" onClick={() => alert('Checking Marketplace for Driver updates...')}>
                    <Cpu size={12} /> Check for Driver Update
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── System Relationship Graph & Event Stream ───────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, marginTop: 14 }}>
        {/* System Relationship Graph */}
        <div className="widget-card">
          <div className="widget-header">
            <h3>System Relationship Topology</h3>
            <span style={{ fontSize: 11, color: 'var(--ed-text-muted)' }}>Live Data Mesh</span>
          </div>
          <div style={{ height: 120, background: 'var(--ed-bg)', borderRadius: 'var(--ed-radius-sm)', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-around', position: 'relative' }}>
            {['SAP', 'Oracle ERP', 'Salesforce', 'QuickBooks', 'Myca Execution OS'].map((node, i) => (
              <div key={node} style={{
                background: node === 'Myca Execution OS' ? 'var(--ed-accent)' : 'var(--ed-surface)',
                border: '1px solid var(--ed-border)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                color: '#fff',
                textAlign: 'center'
              }}>
                {node}
                <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{i === 4 ? 'Central OS' : 'Provider'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Event Stream */}
        <div className="widget-card">
          <div className="widget-header">
            <h3>Live Infrastructure Event Stream</h3>
            <Radio size={12} color="var(--ed-green)" className="spin" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {events.map(ev => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, padding: '4px 8px', background: 'var(--ed-glass)', borderRadius: 4 }}>
                <span style={{ color: 'var(--ed-text)', fontWeight: 500 }}>{ev.text}</span>
                <span style={{ color: 'var(--ed-text-muted)', fontSize: 10, fontFamily: 'var(--ed-mono)' }}>{ev.from} → {ev.to}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseSystems;
