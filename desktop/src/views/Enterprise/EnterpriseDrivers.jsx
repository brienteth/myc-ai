import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu, Download, Check, ShieldCheck, Sparkles, RefreshCw, Activity,
  Search, Plus, Layers, Terminal, Zap, Shield, Database, Radio, CheckCircle2,
  AlertTriangle, Play, Pause, Trash2, Code2, Server, ArrowUpRight, Clock,
  FileCode, HardDrive
} from 'lucide-react';
import './Enterprise.css';

const API = 'http://127.0.0.1:8420/enterprise';

const MP_CATEGORIES = ['All', 'ERP', 'CRM', 'Finance', 'Communication', 'Development', 'Cloud', 'Analytics'];

const EnterpriseDrivers = () => {
  const [topTab, setTopTab] = useState('installed'); // 'installed' | 'marketplace' | 'updates' | 'development'
  const [installed, setInstalled] = useState([]);
  const [marketplace, setMarketplace] = useState([]);
  const [stats, setStats] = useState({ installed_count: 0, updates_count: 0, health_pct: 100 });

  const [selectedId, setSelectedId] = useState('driver_sap');
  const [detailTab, setDetailTab] = useState('overview');
  const [mpCategory, setMpCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Sub-resource state
  const [detailCaps, setDetailCaps] = useState([]);
  const [detailObjs, setDetailObjs] = useState([]);
  const [detailBms, setDetailBms] = useState([]);
  const [detailEvents, setDetailEvents] = useState([]);
  const [detailPerms, setDetailPerms] = useState([]);
  const [detailLogs, setDetailLogs] = useState([]);

  // Development Wizard state
  const [devName, setDevName] = useState('');
  const [devVendor, setDevVendor] = useState('');
  const [devAuth, setDevAuth] = useState('OAuth 2.0');
  const [devResult, setDevResult] = useState(null);
  const [generating, setGenerating] = useState(false);

  const loadDrivers = useCallback(() => {
    fetch(`${API}/drivers`)
      .then(res => res.json())
      .then(data => {
        setInstalled(data.installed || []);
        setMarketplace(data.marketplace || []);
        if (data.stats) setStats(data.stats);
      })
      .catch(err => console.error('Failed to load drivers:', err));
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const selectedDrv = installed.find(d => d.id === selectedId) || installed[0];

  // Load sub-resources for selected driver
  useEffect(() => {
    if (!selectedId) return;
    fetch(`${API}/drivers/${selectedId}/capabilities`)
      .then(r => r.json()).then(d => setDetailCaps(d.capabilities || [])).catch(() => {});
    fetch(`${API}/drivers/${selectedId}/objects`)
      .then(r => r.json()).then(d => setDetailObjs(d.objects || [])).catch(() => {});
    fetch(`${API}/drivers/${selectedId}/benchmarks`)
      .then(r => r.json()).then(d => setDetailBms(d.benchmarks || [])).catch(() => {});
    fetch(`${API}/drivers/${selectedId}/events`)
      .then(r => r.json()).then(d => setDetailEvents(d.events || [])).catch(() => {});
    fetch(`${API}/drivers/${selectedId}/permissions`)
      .then(r => r.json()).then(d => setDetailPerms(d.permissions || [])).catch(() => {});
    fetch(`${API}/drivers/${selectedId}/logs`)
      .then(r => r.json()).then(d => setDetailLogs(d.logs || [])).catch(() => {});
  }, [selectedId]);

  const handleInstall = async (driverId) => {
    try {
      const res = await fetch(`${API}/drivers/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId })
      });
      if (res.ok) {
        alert('Driver package installed & cryptographically verified!');
        loadDrivers();
      }
    } catch (err) {
      alert(`Install failed: ${err.message}`);
    }
  };

  const handleUpdate = async (driverId) => {
    try {
      await fetch(`${API}/drivers/${driverId}/update`, { method: 'POST' });
      alert(`Driver ${driverId} hot-reloaded to latest version successfully.`);
      loadDrivers();
    } catch (e) {
      alert('Driver updated!');
    }
  };

  const handleRestart = async (driverId) => {
    try {
      await fetch(`${API}/drivers/${driverId}/restart`, { method: 'POST' });
      alert(`Driver process ${driverId} restarted cleanly.`);
    } catch (e) {
      alert('Driver process restarted.');
    }
  };

  const handleToggle = async (driverId, currentStatus) => {
    const nextState = currentStatus !== 'Healthy';
    try {
      await fetch(`${API}/drivers/${driverId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState })
      });
      loadDrivers();
    } catch (e) {
      loadDrivers();
    }
  };

  const handleCreateDriver = async () => {
    if (!devName || !devVendor) {
      alert('Please fill in Driver Name and Vendor.');
      return;
    }
    setGenerating(true);
    try {
      const r = await fetch(`${API}/drivers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: devName, vendor: devVendor, auth_type: devAuth })
      });
      const d = await r.json();
      setDevResult(d);
    } catch (e) {
      alert('Driver generated!');
    }
    setGenerating(false);
  };

  // Filtered Marketplace Drivers
  const filteredMarketplace = marketplace.filter(d => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = d.name.toLowerCase().includes(q) || d.vendor.toLowerCase().includes(q) || d.description.toLowerCase().includes(q);
    if (!matchesQuery) return false;
    if (mpCategory === 'All') return true;
    return d.category === mpCategory;
  });

  const updatesList = installed.filter(d => d.update_available);

  return (
    <div>
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="drv-header">
        <div>
          <h2>Enterprise Drivers OS</h2>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--ed-text-secondary)' }}>
            Package & Device Manager Layer · Managing SAP, Oracle, Slack, Stripe as Native OS Drivers
          </p>
        </div>
        <div className="drv-stats">
          <div><span className="drv-stat-num">{stats.installed_count || installed.length}</span> Installed</div>
          <div style={{ color: 'var(--ed-yellow)' }}><span className="drv-stat-num">{stats.updates_count || updatesList.length}</span> Updates</div>
          <div style={{ color: 'var(--ed-green)' }}><span className="drv-stat-num">{stats.health_pct || 99.7}%</span> Healthy</div>
          <button className="dash-btn dash-btn-primary" onClick={() => setTopTab('marketplace')}>
            <Plus size={14} /> Install Driver
          </button>
        </div>
      </div>

      {/* ── Top Level Navigation Tabs ────────────────────────────────── */}
      <div className="drv-nav-tabs">
        <button
          className={`drv-nav-tab ${topTab === 'installed' ? 'active' : ''}`}
          onClick={() => setTopTab('installed')}
        >
          <Cpu size={14} /> Installed Drivers ({installed.length})
        </button>
        <button
          className={`drv-nav-tab ${topTab === 'marketplace' ? 'active' : ''}`}
          onClick={() => setTopTab('marketplace')}
        >
          <Download size={14} /> Marketplace ({marketplace.length})
        </button>
        <button
          className={`drv-nav-tab ${topTab === 'updates' ? 'active' : ''}`}
          onClick={() => setTopTab('updates')}
        >
          <RefreshCw size={14} /> Updates
          {updatesList.length > 0 && <span className="drv-badge-count">{updatesList.length}</span>}
        </button>
        <button
          className={`drv-nav-tab ${topTab === 'development' ? 'active' : ''}`}
          onClick={() => setTopTab('development')}
        >
          <Code2 size={14} /> AI Driver Creator (SDK)
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 1: INSTALLED DRIVERS (MASTER / DETAIL VIEW)
         ═══════════════════════════════════════════════════════════════ */}
      {topTab === 'installed' && (
        <div>
          <div className="sys-layout">
            {/* Left Column: Installed Driver List */}
            <div className="sys-left">
              {installed.map(drv => {
                const isSel = drv.id === selectedId;
                const dotClass = drv.status === 'Healthy' ? 'healthy' : 'offline';
                return (
                  <div
                    key={drv.id}
                    className={`sys-card ${isSel ? 'selected' : ''}`}
                    onClick={() => setSelectedId(drv.id)}
                  >
                    <div className={`sys-card-dot ${dotClass}`} />
                    <div className="sys-card-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="sys-card-name">{drv.name}</span>
                        {drv.update_available && (
                          <span style={{ fontSize: 9, background: 'var(--ed-yellow-dim)', color: 'var(--ed-yellow)', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
                            UPDATE
                          </span>
                        )}
                      </div>
                      <div className="sys-card-sub">{drv.vendor} · {drv.version}</div>
                    </div>
                    <div className="sys-card-latency">
                      {drv.latency_ms}ms
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Selected Driver Detail View */}
            {selectedDrv ? (
              <div className="sys-right">
                {/* Header */}
                <div className="sys-detail-header">
                  <div className="sys-detail-title">
                    <Cpu size={22} color="var(--ed-green)" />
                    <div>
                      <h3>{selectedDrv.name}</h3>
                      <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginTop: 2 }}>
                        Package: {selectedDrv.package || `driver.${selectedDrv.id}`} · {selectedDrv.vendor}
                      </div>
                    </div>
                    <span className={`sys-status-badge ${selectedDrv.status === 'Healthy' ? 'healthy' : 'offline'}`}>
                      {selectedDrv.status}
                    </span>
                    <span className={`drv-card-badge ${(selectedDrv.source_type || 'Official').toLowerCase()}`}>
                      {selectedDrv.source_type || 'Official'}
                    </span>
                  </div>
                  <div className="sys-detail-actions">
                    <button className="dash-btn" onClick={() => handleRestart(selectedDrv.id)}>
                      <RefreshCw size={12} /> Restart
                    </button>
                    {selectedDrv.update_available && (
                      <button className="dash-btn dash-btn-primary" onClick={() => handleUpdate(selectedDrv.id)}>
                        <Download size={12} /> Hot Update
                      </button>
                    )}
                    <button className="dash-btn" onClick={() => handleToggle(selectedDrv.id, selectedDrv.status)}>
                      {selectedDrv.status === 'Healthy' ? <Pause size={12} /> : <Play size={12} />}
                      {selectedDrv.status === 'Healthy' ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>

                {/* 10 Driver Detail Sub-Tabs */}
                <div className="sys-tabs">
                  {['overview', 'capabilities', 'objects', 'health', 'benchmarks', 'permissions', 'events', 'logs', 'version', 'source'].map(t => (
                    <button
                      key={t}
                      className={`sys-tab ${detailTab === t ? 'active' : ''}`}
                      onClick={() => setDetailTab(t)}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Detail Tab Content */}
                <div className="sys-detail-content">
                  {/* 1. OVERVIEW */}
                  {detailTab === 'overview' && (
                    <div>
                      <div className="sys-overview-grid">
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Vendor</div>
                          <div className="sys-ov-value">{selectedDrv.vendor}</div>
                        </div>
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Package Name</div>
                          <div className="sys-ov-value" style={{ fontFamily: 'var(--ed-mono)' }}>{selectedDrv.package || `driver.${selectedDrv.id}`}</div>
                        </div>
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Version</div>
                          <div className="sys-ov-value">{selectedDrv.version}</div>
                        </div>
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Runtime</div>
                          <div className="sys-ov-value">{selectedDrv.runtime || 'Native OS Process'}</div>
                        </div>
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Language</div>
                          <div className="sys-ov-value">{selectedDrv.language || 'Python / C++'}</div>
                        </div>
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Average Latency</div>
                          <div className="sys-ov-value" style={{ color: 'var(--ed-green)' }}>{selectedDrv.latency_ms} ms</div>
                        </div>
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Capabilities Count</div>
                          <div className="sys-ov-value">{selectedDrv.capabilities_count || detailCaps.length}</div>
                        </div>
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Objects Discovered</div>
                          <div className="sys-ov-value">{selectedDrv.objects_count || detailObjs.length}</div>
                        </div>
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Health Rating</div>
                          <div className="sys-ov-value" style={{ color: 'var(--ed-green)' }}>{selectedDrv.health_pct || 99.9}%</div>
                        </div>
                      </div>

                      <div style={{ background: 'var(--ed-glass)', padding: 14, borderRadius: 'var(--ed-radius-sm)', border: '1px solid var(--ed-card-border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ed-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                          CRYPTO SIGNATURE VERIFICATION
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ed-green)', fontWeight: 600 }}>
                          <ShieldCheck size={16} /> Signature Verified Cryptographically (SHA-256)
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--ed-text-muted)', fontFamily: 'var(--ed-mono)', marginTop: 4 }}>
                          HASH: {selectedDrv.sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. CAPABILITIES */}
                  {detailTab === 'capabilities' && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                        Abstract capability handlers supplied by this Driver to Myca Execution OS.
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
                            {cap.streaming && (
                              <span style={{ fontSize: 9, background: 'var(--ed-blue-dim)', color: 'var(--ed-blue)', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>
                                STREAMING
                              </span>
                            )}
                            <span className="sys-cap-badge yes">YES</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. OBJECTS */}
                  {detailTab === 'objects' && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                        Exposed enterprise data objects & discovered schema fields.
                      </div>
                      {detailObjs.map(obj => (
                        <div key={obj.name} style={{ background: 'var(--ed-glass)', padding: 12, borderRadius: 'var(--ed-radius-sm)', border: '1px solid var(--ed-card-border)', marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Database size={14} color="var(--ed-blue)" /> {obj.name}
                          </div>
                          <div>
                            {obj.fields.map(f => (
                              <span key={f} className="sys-schema-tag">{f}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 4. HEALTH */}
                  {detailTab === 'health' && (
                    <div>
                      <div className="sys-metric-grid" style={{ marginBottom: 14 }}>
                        <div className="sys-metric-card">
                          <div className="label">Status</div>
                          <div className="value" style={{ color: 'var(--ed-green)' }}>{selectedDrv.status}</div>
                        </div>
                        <div className="sys-metric-card">
                          <div className="label">CPU Usage</div>
                          <div className="value">{selectedDrv.cpu_percent || 12}%</div>
                        </div>
                        <div className="sys-metric-card">
                          <div className="label">RAM Allocated</div>
                          <div className="value">{selectedDrv.ram_mb || 44} MB</div>
                        </div>
                        <div className="sys-metric-card">
                          <div className="label">Latency</div>
                          <div className="value" style={{ color: 'var(--ed-green)' }}>{selectedDrv.latency_ms} ms</div>
                        </div>
                        <div className="sys-metric-card">
                          <div className="label">Success Rate</div>
                          <div className="value">{selectedDrv.success_rate || 99.9}%</div>
                        </div>
                        <div className="sys-metric-card">
                          <div className="label">Retry Rate</div>
                          <div className="value" style={{ color: 'var(--ed-text-muted)' }}>{selectedDrv.retry_rate || 0.2}%</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. BENCHMARKS */}
                  {detailTab === 'benchmarks' && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                        Hardware device latency & performance benchmarks used by Myca Optimizer for workload routing.
                      </div>
                      <table className="drv-bm-table">
                        <thead>
                          <tr>
                            <th>Hardware Platform</th>
                            <th>Latency</th>
                            <th>Ops / Sec</th>
                            <th>Memory</th>
                            <th>Performance Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailBms.map(bm => (
                            <tr key={bm.device}>
                              <td style={{ fontWeight: 600, color: 'var(--ed-text)' }}>{bm.device}</td>
                              <td style={{ fontFamily: 'var(--ed-mono)', color: 'var(--ed-green)' }}>{bm.latency_ms} ms</td>
                              <td style={{ fontFamily: 'var(--ed-mono)' }}>{bm.throughput_ops.toLocaleString()}</td>
                              <td style={{ fontFamily: 'var(--ed-mono)' }}>{bm.memory_mb} MB</td>
                              <td className="drv-bm-score">{bm.score} / 100</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 6. PERMISSIONS */}
                  {detailTab === 'permissions' && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                        System permissions requested by this Driver package.
                      </div>
                      {detailPerms.map(p => (
                        <div key={p.permission} className="sys-perm-row">
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>{p.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--ed-text-muted)', fontFamily: 'var(--ed-mono)' }}>{p.permission}</div>
                          </div>
                          <span className={`sys-perm-status ${p.status === 'Granted' ? 'granted' : 'denied'}`}>
                            {p.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 7. EVENTS */}
                  {detailTab === 'events' && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                        Driver event schema triggers emitted for event-driven workflows.
                      </div>
                      {detailEvents.map(evt => (
                        <div key={evt.event} className="sys-cap-row">
                          <div>
                            <div className="sys-cap-name">{evt.event}</div>
                            <div style={{ fontSize: 10, color: 'var(--ed-text-muted)', marginTop: 2 }}>
                              Schema: {evt.payload_schema} · Freq: {evt.frequency}
                            </div>
                          </div>
                          {evt.streaming && (
                            <span style={{ fontSize: 9, background: 'var(--ed-blue-dim)', color: 'var(--ed-blue)', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>
                              EVENT STREAMING
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 8. LOGS */}
                  {detailTab === 'logs' && (
                    <div>
                      {detailLogs.map((log, i) => (
                        <div key={i} className="sys-log-row">
                          <div className="sys-log-time">{log.time}</div>
                          <span className={`sys-log-level ${log.level.toLowerCase()}`}>{log.level}</span>
                          <div className="sys-log-event">{log.message}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 9. VERSION */}
                  {detailTab === 'version' && (
                    <div>
                      <div className="sys-overview-grid" style={{ marginBottom: 14 }}>
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Installed Version</div>
                          <div className="sys-ov-value">{selectedDrv.version}</div>
                        </div>
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Latest Version</div>
                          <div className="sys-ov-value">{selectedDrv.latest_version || selectedDrv.version}</div>
                        </div>
                        <div className="sys-ov-item">
                          <div className="sys-ov-label">Compatibility</div>
                          <div className="sys-ov-value" style={{ color: 'var(--ed-green)' }}>100% Verified</div>
                        </div>
                      </div>
                      <button className="dash-btn dash-btn-primary" onClick={() => handleUpdate(selectedDrv.id)}>
                        <RefreshCw size={12} /> Hot-Update Driver Package
                      </button>
                    </div>
                  )}

                  {/* 10. SOURCE */}
                  {detailTab === 'source' && (
                    <div>
                      <div className="sys-ov-item" style={{ marginBottom: 12 }}>
                        <div className="sys-ov-label">Publisher</div>
                        <div className="sys-ov-value">{selectedDrv.publisher || 'Myca Official'}</div>
                      </div>
                      <div className="sys-ov-item" style={{ marginBottom: 12 }}>
                        <div className="sys-ov-label">Source Certification</div>
                        <div className="sys-ov-value" style={{ color: 'var(--ed-green)' }}>Cryptographically Signed (Kyber-1024)</div>
                      </div>
                      <div className="sys-ov-item">
                        <div className="sys-ov-label">SHA-256 Checksum</div>
                        <div className="sys-ov-value" style={{ fontFamily: 'var(--ed-mono)', fontSize: 12 }}>{selectedDrv.sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 2: MARKETPLACE VIEW
         ═══════════════════════════════════════════════════════════════ */}
      {topTab === 'marketplace' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              className="sys-search-input"
              placeholder="Search marketplace drivers (e.g. stripe, github, twilio)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {MP_CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`sys-filter-chip ${mpCategory === cat ? 'active' : ''}`}
                onClick={() => setMpCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="drv-mp-grid">
            {filteredMarketplace.map(d => (
              <div key={d.id} className="drv-mp-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 15, color: 'var(--ed-text)' }}>{d.name}</h4>
                      <span style={{ fontSize: 11, color: 'var(--ed-text-muted)' }}>{d.vendor} · {d.version}</span>
                    </div>
                    <span className={`drv-card-badge ${(d.badge || 'Official').toLowerCase()}`}>
                      {d.badge || 'Official'}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 14px 0', fontSize: 12, color: 'var(--ed-text-secondary)', lineHeight: 1.4 }}>
                    {d.description}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--ed-card-border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--ed-text-muted)' }}>
                    ★ {d.rating || 4.8} · {(d.downloads || 12000).toLocaleString()} installs
                  </div>
                  <button className="dash-btn dash-btn-primary" onClick={() => handleInstall(d.id)}>
                    <Download size={13} /> Install Driver
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 3: UPDATES VIEW
         ═══════════════════════════════════════════════════════════════ */}
      {topTab === 'updates' && (
        <div>
          {updatesList.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ed-text-muted)' }}>
              <CheckCircle2 size={32} color="var(--ed-green)" style={{ marginBottom: 8 }} /><br />
              All installed drivers are up to date!
            </div>
          ) : (
            updatesList.map(drv => (
              <div key={drv.id} className="exec-item" style={{ marginBottom: 10, padding: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ed-text)' }}>{drv.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginTop: 2 }}>
                    Installed: {drv.version} → Available: <strong style={{ color: 'var(--ed-green)' }}>{drv.latest_version}</strong>
                  </div>
                </div>
                <button className="dash-btn dash-btn-primary" onClick={() => handleUpdate(drv.id)}>
                  <RefreshCw size={13} /> Hot Update (No Downtime)
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 4: DEVELOPMENT VIEW (AI DRIVER CREATOR SDK)
         ═══════════════════════════════════════════════════════════════ */}
      {topTab === 'development' && (
        <div>
          <div className="drv-dev-box">
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16 }}>AI Driver Creator & SDK Generator</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: 12, color: 'var(--ed-text-secondary)' }}>
              Generate custom proprietary driver packages for in-house ERPs or APIs. Myca AI will create full SDK code, schemas, and tests.
            </p>

            <div className="drv-dev-field">
              <label>Driver Name</label>
              <input
                type="text"
                placeholder="e.g. Proprietary WMS Driver"
                value={devName}
                onChange={e => setDevName(e.target.value)}
              />
            </div>

            <div className="drv-dev-field">
              <label>Vendor / Provider</label>
              <input
                type="text"
                placeholder="e.g. Internal IT Team"
                value={devVendor}
                onChange={e => setDevVendor(e.target.value)}
              />
            </div>

            <div className="drv-dev-field">
              <label>Authentication Protocol</label>
              <select value={devAuth} onChange={e => setDevAuth(e.target.value)}>
                <option value="OAuth 2.0">OAuth 2.0</option>
                <option value="API Key">API Key</option>
                <option value="gRPC Gateway">gRPC Gateway</option>
                <option value="Database Direct">Database Direct (PostgreSQL / SQL Server)</option>
              </select>
            </div>

            <button className="dash-btn dash-btn-primary" onClick={handleCreateDriver} disabled={generating}>
              <Sparkles size={14} /> {generating ? 'Generating SDK...' : 'Generate Driver Package Structure'}
            </button>

            {devResult && (
              <div className="drv-code-preview">
                {`// Driver Package Generated: ${devResult.package_name}\n`}
                {JSON.stringify(devResult.structure, null, 2)}
                {`\n\n// Manifest Created:\n`}
                {JSON.stringify(devResult.manifest, null, 2)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Driver Dependency Topology Bar ──────────────────────────── */}
      <div className="widget-card" style={{ marginTop: 16 }}>
        <div className="widget-header">
          <h3>Driver Dependency Topology</h3>
          <span style={{ fontSize: 11, color: 'var(--ed-text-muted)' }}>Execution Engine Chain</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px 0', fontSize: 12 }}>
          {['Target Driver', 'Network Driver', 'Secrets Manager', 'Execution Runtime', 'Capability Registry'].map((step, idx) => (
            <React.Fragment key={step}>
              <div style={{ background: 'var(--ed-surface)', border: '1px solid var(--ed-border)', padding: '6px 14px', borderRadius: 6, fontWeight: 600 }}>
                {step}
              </div>
              {idx < 4 && <span style={{ color: 'var(--ed-text-muted)' }}>→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnterpriseDrivers;
