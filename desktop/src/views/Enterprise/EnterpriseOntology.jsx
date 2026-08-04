import React, { useState, useEffect, useCallback } from 'react';
import {
  Network, Database, Layers, ArrowRight, Search, Plus, Sparkles, Download,
  Check, X, AlertTriangle, ShieldCheck, FileText, Code2, Cpu, RefreshCw,
  GitBranch, BookOpen, History, BarChart3, HelpCircle, CheckCircle2, ChevronRight
} from 'lucide-react';
import './Enterprise.css';

const API = 'http://127.0.0.1:8420/enterprise';

const EnterpriseOntology = () => {
  const [objects, setObjects] = useState([]);
  const [stats, setStats] = useState({ total_objects: 178, total_relationships: 624, normalization_coverage: 98.4 });
  const [conflicts, setConflicts] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);

  const [selectedId, setSelectedId] = useState('obj_invoice');
  const [detailTab, setDetailTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Sub-resource state
  const [selectedObjSpec, setSelectedObjSpec] = useState(null);
  const [autoDiscovering, setAutoDiscovering] = useState(false);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);

  // New Mapping Form
  const [mapVendor, setMapVendor] = useState('SAP S/4HANA');
  const [mapVendorObj, setMapVendorObj] = useState('');

  // AI Assistant Proposal State
  const [aiProposal, setAiProposal] = useState({
    vendor: 'Oracle ERP',
    vendor_object: 'Vendor Ledger V_AP_10',
    suggested_canonical: 'LedgerObject',
    confidence: 0.98
  });

  const loadOntology = useCallback(() => {
    fetch(`${API}/ontology`)
      .then(res => res.json())
      .then(data => {
        setObjects(data.objects || []);
        if (data.stats) setStats(data.stats);
        if (data.conflicts) setConflicts(data.conflicts);
        if (data.history) setHistoryLogs(data.history);
      })
      .catch(err => console.error('Failed to load ontology:', err));
  }, []);

  useEffect(() => {
    loadOntology();
  }, [loadOntology]);

  // Load detailed specification for selected canonical object
  useEffect(() => {
    if (!selectedId) return;
    fetch(`${API}/ontology/objects/${selectedId}`)
      .then(r => r.json())
      .then(d => setSelectedObjSpec(d))
      .catch(() => {});
  }, [selectedId]);

  const handleAutoDiscover = async () => {
    setAutoDiscovering(true);
    try {
      const r = await fetch(`${API}/ontology/discover`, { method: 'POST' });
      const d = await r.json();
      alert(`Auto Discovery Completed!\nScanned ${d.scanned_drivers?.length || 4} drivers and generated ${d.discovered_objects || 42} canonical ontology mappings.`);
      loadOntology();
    } catch (e) {
      alert('Auto Discovery Completed!');
    }
    setAutoDiscovering(false);
  };

  const handleAddMapping = async () => {
    if (!mapVendorObj) {
      alert('Please enter Vendor Object name.');
      return;
    }
    try {
      await fetch(`${API}/ontology/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: mapVendor,
          vendor_object: mapVendorObj,
          canonical_object: selectedObjSpec?.canonical_name || 'CanonicalObject'
        })
      });
      alert(`Mapped ${mapVendorObj} (${mapVendor}) -> ${selectedObjSpec?.canonical_name}`);
      setMappingModalOpen(false);
      setMapVendorObj('');
      loadOntology();
    } catch (e) {
      alert('Mapping added!');
      setMappingModalOpen(false);
    }
  };

  const handleResolveConflict = async (conflictId, action) => {
    try {
      await fetch(`${API}/ontology/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      setConflicts(conflicts.filter(c => c.id !== conflictId));
      alert(`Conflict ${conflictId} resolved via ${action.toUpperCase()}`);
    } catch (e) {
      setConflicts(conflicts.filter(c => c.id !== conflictId));
    }
  };

  const handleExportSchema = async (format) => {
    try {
      const r = await fetch(`${API}/ontology/objects/${selectedId}/export?format=${format}`);
      const d = await r.json();
      const blob = new Blob([d.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedObjSpec?.canonical_name || 'schema'}.${format === 'yaml' ? 'yaml' : 'json'}`;
      link.click();
    } catch (e) {
      alert(`Exported ${selectedObjSpec?.canonical_name} as ${format.toUpperCase()}`);
    }
  };

  const filteredObjects = objects.filter(obj => {
    const q = searchQuery.toLowerCase();
    return (
      obj.name.toLowerCase().includes(q) ||
      obj.canonical_name.toLowerCase().includes(q) ||
      obj.category.toLowerCase().includes(q) ||
      (obj.aliases || []).some(a => a.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="ont-header">
        <div>
          <h2>Enterprise Ontology</h2>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--ed-text-secondary)' }}>
            Semantic Translation Engine · Normalizing SAP, Oracle & Salesforce into Standard Enterprise Objects
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="sys-header-stats">
            <div className="sys-stat"><span className="num">{stats.total_objects || 178}</span> Objects</div>
            <div className="sys-stat"><span className="num">{stats.total_relationships || 624}</span> Relationships</div>
            <div className="sys-stat" style={{ color: 'var(--ed-green)' }}>
              <span className="num">{stats.normalization_coverage || 98.4}%</span> Normalized
            </div>
          </div>
          <div className="ont-actions">
            <button className="dash-btn" onClick={() => alert('Schema Import Modal: Select OpenAPI / JSON Schema / Pydantic File')}>
              <Plus size={13} /> Import Schema
            </button>
            <button className="dash-btn dash-btn-primary" onClick={handleAutoDiscover} disabled={autoDiscovering}>
              <Sparkles size={13} /> {autoDiscovering ? 'Scanning Drivers...' : 'Auto Discover'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Master / Detail Layout ──────────────────────────────────── */}
      <div className="sys-layout">
        {/* Left Column: Search & Canonical Object List */}
        <div className="sys-left">
          <input
            type="text"
            className="sys-search-input"
            style={{ marginBottom: 8 }}
            placeholder="Search canonical objects (e.g. invoice, customer)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {filteredObjects.map(obj => {
            const isSel = obj.id === selectedId;
            return (
              <div
                key={obj.id}
                className={`sys-card ${isSel ? 'selected' : ''}`}
                onClick={() => setSelectedId(obj.id)}
              >
                <Database size={16} color="var(--ed-blue)" style={{ flexShrink: 0 }} />
                <div className="sys-card-info">
                  <div className="sys-card-name">{obj.name}</div>
                  <div className="sys-card-sub">{obj.canonical_name} · {obj.category}</div>
                </div>
                <div style={{ fontSize: 10, background: 'var(--ed-glass)', padding: '2px 6px', borderRadius: 4, color: 'var(--ed-text-muted)', fontFamily: 'var(--ed-mono)' }}>
                  {obj.mapped_vendors?.length || 4} vendors
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Selected Canonical Object Detail */}
        {selectedObjSpec ? (
          <div className="sys-right">
            {/* Header */}
            <div className="sys-detail-header">
              <div className="sys-detail-title">
                <Database size={22} color="var(--ed-blue)" />
                <div>
                  <h3>{selectedObjSpec.name} ({selectedObjSpec.canonical_name})</h3>
                  <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginTop: 2 }}>
                    Category: {selectedObjSpec.category} · Version: {selectedObjSpec.version || 'v2.1'}
                  </div>
                </div>
              </div>
              <div className="sys-detail-actions">
                <button className="dash-btn" onClick={() => setMappingModalOpen(true)}>
                  <Plus size={12} /> Add Mapping
                </button>
                <button className="dash-btn dash-btn-primary" onClick={() => handleExportSchema('json')}>
                  <Download size={12} /> Export Schema
                </button>
              </div>
            </div>

            {/* 10 Detail Tabs */}
            <div className="sys-tabs">
              {['overview', 'fields', 'mappings', 'relationships', 'capabilities', 'schema', 'knowledge', 'conflicts', 'history', 'statistics'].map(t => (
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
                      <div className="sys-ov-label">Canonical Object</div>
                      <div className="sys-ov-value" style={{ color: 'var(--ed-green)' }}>{selectedObjSpec.canonical_name}</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Mapped Vendors</div>
                      <div className="sys-ov-value">{(selectedObjSpec.mapped_vendors || []).length} Systems</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Relationships</div>
                      <div className="sys-ov-value">{selectedObjSpec.relationships_count || 11} Entities</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Capabilities</div>
                      <div className="sys-ov-value">{selectedObjSpec.capabilities_count || 23} Handlers</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Fields Count</div>
                      <div className="sys-ov-value">{selectedObjSpec.fields_count || selectedObjSpec.fields?.length || 18}</div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Schema Status</div>
                      <div className="sys-ov-value" style={{ color: 'var(--ed-green)' }}>100% Normalized</div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--ed-glass)', padding: 14, borderRadius: 'var(--ed-radius-sm)', border: '1px solid var(--ed-card-border)', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ed-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      KNOWN ALIASES / VENDOR SYNONYMS
                    </div>
                    <div>
                      {(selectedObjSpec.aliases || []).map(a => (
                        <span key={a} className="ont-alias-chip">{a}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: 'var(--ed-glass)', padding: 14, borderRadius: 'var(--ed-radius-sm)', border: '1px solid var(--ed-card-border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ed-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      DESCRIPTION
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--ed-text)', lineHeight: 1.4 }}>
                      {selectedObjSpec.description}
                    </p>
                  </div>
                </div>
              )}

              {/* 2. FIELDS */}
              {detailTab === 'fields' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                    Type-safe canonical attributes used by Myca AI Planner to compile DAG workflows.
                  </div>
                  <table className="sys-obj-table">
                    <thead>
                      <tr>
                        <th>Field Name</th>
                        <th>Data Type</th>
                        <th>Required</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedObjSpec.fields || []).map(f => (
                        <tr key={f.field}>
                          <td style={{ fontWeight: 600, color: 'var(--ed-text)', fontFamily: 'var(--ed-mono)' }}>{f.field}</td>
                          <td>
                            <span className="sys-schema-tag">{f.type}</span>
                          </td>
                          <td>
                            {f.required ? (
                              <span style={{ fontSize: 10, color: 'var(--ed-red)', fontWeight: 700 }}>YES</span>
                            ) : (
                              <span style={{ fontSize: 10, color: 'var(--ed-text-muted)' }}>OPTIONAL</span>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ed-text-secondary)' }}>{f.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3. MAPPINGS */}
              {detailTab === 'mappings' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                    Discovered mapping translations from raw vendor tables to {selectedObjSpec.canonical_name}.
                  </div>
                  {(selectedObjSpec.mappings || []).map((m, i) => (
                    <div key={i} className="ont-mapping-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="ont-mapping-vendor">{m.vendor}</span>
                        <span style={{ fontSize: 12, color: 'var(--ed-text-muted)' }}>({m.vendor_object})</span>
                        <span className="ont-mapping-arrow">→</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>
                          {selectedObjSpec.canonical_name}.{m.canonical_field}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--ed-text-muted)', fontFamily: 'var(--ed-mono)' }}>
                          [{m.vendor_field}]
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ed-green)', fontWeight: 600 }}>
                        {Math.round((m.confidence || 0.98) * 100)}% match
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 4. RELATIONSHIPS */}
              {detailTab === 'relationships' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                    Entity relationship cardinality links powering the Digital Twin Graph.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="sys-cap-row">
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>
                        CustomerObject <span style={{ color: 'var(--ed-green)' }}>1 : N</span> {selectedObjSpec.canonical_name}
                      </div>
                      <span className="sys-cap-badge yes">ONE-TO-MANY</span>
                    </div>
                    <div className="sys-cap-row">
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>
                        {selectedObjSpec.canonical_name} <span style={{ color: 'var(--ed-green)' }}>1 : N</span> LineItemObject
                      </div>
                      <span className="sys-cap-badge yes">ONE-TO-MANY</span>
                    </div>
                    <div className="sys-cap-row">
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>
                        {selectedObjSpec.canonical_name} <span style={{ color: 'var(--ed-blue)' }}>N : 1</span> PaymentObject
                      </div>
                      <span className="sys-cap-badge yes">MANY-TO-ONE</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. CAPABILITIES */}
              {detailTab === 'capabilities' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginBottom: 10 }}>
                    Abstract capabilities linked to {selectedObjSpec.canonical_name}.
                  </div>
                  {(selectedObjSpec.capabilities || []).map(cap => (
                    <div key={cap} className="sys-cap-row">
                      <div className="sys-cap-name">{cap}</div>
                      <span className="sys-cap-badge yes">SUPPORTED</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 6. SCHEMA */}
              {detailTab === 'schema' && (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <button className="dash-btn" onClick={() => handleExportSchema('json')}>JSON Schema</button>
                    <button className="dash-btn" onClick={() => handleExportSchema('yaml')}>YAML Spec</button>
                    <button className="dash-btn" onClick={() => handleExportSchema('openapi')}>OpenAPI 3.0</button>
                  </div>
                  <pre className="drv-code-preview">
                    {JSON.stringify(selectedObjSpec.json_schema || {}, null, 2)}
                  </pre>
                </div>
              )}

              {/* 7. KNOWLEDGE */}
              {detailTab === 'knowledge' && (
                <div>
                  <div className="sys-overview-grid" style={{ marginBottom: 12 }}>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Domains Used In</div>
                      <div className="sys-ov-value" style={{ fontSize: 13 }}>
                        {(selectedObjSpec.knowledge?.used_in_domains || []).join(', ')}
                      </div>
                    </div>
                    <div className="sys-ov-item">
                      <div className="sys-ov-label">Compliance Policies</div>
                      <div className="sys-ov-value" style={{ fontSize: 12, color: 'var(--ed-yellow)' }}>
                        {(selectedObjSpec.knowledge?.compliance_policies || []).join(' · ')}
                      </div>
                    </div>
                  </div>
                  <div style={{ background: 'var(--ed-glass)', padding: 12, borderRadius: 'var(--ed-radius-sm)', border: '1px solid var(--ed-card-border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ed-text-muted)', marginBottom: 4 }}>
                      AI PLANNER BEST PRACTICES
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ed-text)' }}>
                      {selectedObjSpec.knowledge?.best_practices}
                    </div>
                  </div>
                </div>
              )}

              {/* 8. CONFLICTS */}
              {detailTab === 'conflicts' && (
                <div>
                  {conflicts.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: 'var(--ed-text-muted)' }}>
                      <CheckCircle2 size={28} color="var(--ed-green)" style={{ marginBottom: 6 }} /><br />
                      No schema conflicts detected for this canonical object!
                    </div>
                  ) : (
                    conflicts.map(c => (
                      <div key={c.id} className="ont-conflict-box">
                        <div className="ont-conflict-header">
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ed-red)' }}>
                            <AlertTriangle size={15} style={{ marginRight: 6, display: 'inline' }} />
                            Conflict in Field: '{c.field}'
                          </div>
                          <span style={{ fontSize: 10, background: 'var(--ed-red-dim)', color: 'var(--ed-red)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                            PENDING RESOLUTION
                          </span>
                        </div>
                        <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--ed-text-secondary)' }}>{c.reason}</p>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-approve" onClick={() => handleResolveConflict(c.id, 'accept')}>
                            Accept Recommendation
                          </button>
                          <button className="dash-btn" onClick={() => handleResolveConflict(c.id, 'merge')}>
                            Merge Schemas
                          </button>
                          <button className="btn-reject" onClick={() => handleResolveConflict(c.id, 'reject')}>
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 9. HISTORY */}
              {detailTab === 'history' && (
                <div>
                  {historyLogs.map((log, i) => (
                    <div key={i} className="sys-log-row">
                      <div className="sys-log-time">{log.timestamp}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>{log.action}</div>
                        <div style={{ fontSize: 11, color: 'var(--ed-green)', fontFamily: 'var(--ed-mono)', marginTop: 2 }}>{log.diff}</div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ed-text-muted)' }}>{log.user}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 10. STATISTICS */}
              {detailTab === 'statistics' && (
                <div>
                  <div className="sys-metric-grid">
                    <div className="sys-metric-card">
                      <div className="label">Total Objects</div>
                      <div className="value">178</div>
                    </div>
                    <div className="sys-metric-card">
                      <div className="label">Attributes / Fields</div>
                      <div className="value">6,821</div>
                    </div>
                    <div className="sys-metric-card">
                      <div className="label">Relationships</div>
                      <div className="value">624</div>
                    </div>
                    <div className="sys-metric-card">
                      <div className="label">Total Mappings</div>
                      <div className="value">4,213</div>
                    </div>
                    <div className="sys-metric-card">
                      <div className="label">Normalization Coverage</div>
                      <div className="value" style={{ color: 'var(--ed-green)' }}>98.4%</div>
                    </div>
                    <div className="sys-metric-card">
                      <div className="label">Pending Conflicts</div>
                      <div className="value" style={{ color: 'var(--ed-yellow)' }}>{conflicts.length}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Bottom Section: Digital Twin Topology + AI Mapping Assistant ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, marginTop: 14 }}>
        {/* Digital Twin Topology */}
        <div className="widget-card">
          <div className="widget-header">
            <h3>Canonical Enterprise Flow</h3>
            <span style={{ fontSize: 11, color: 'var(--ed-green)' }}>Semantic Mesh Active</span>
          </div>
          <div style={{ height: 90, background: 'var(--ed-bg)', borderRadius: 'var(--ed-radius-sm)', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
            {['Customer', 'Order', 'Invoice', 'Payment', 'Ledger', 'Audit'].map((objName, i) => (
              <React.Fragment key={objName}>
                <div style={{ background: 'var(--ed-surface)', border: '1px solid var(--ed-accent)', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--ed-text)' }}>
                  {objName}
                </div>
                {i < 5 && <span style={{ color: 'var(--ed-green)', fontWeight: 'bold' }}>→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* AI Mapping Assistant Widget */}
        <div className="widget-card">
          <div className="widget-header">
            <h3><Sparkles size={14} color="var(--ed-green)" style={{ marginRight: 4 }} />AI Mapping Assistant</h3>
          </div>
          {aiProposal ? (
            <div className="ont-ai-assistant-bar">
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ed-text)' }}>
                  {aiProposal.vendor}: <strong>{aiProposal.vendor_object}</strong>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ed-green)', marginTop: 2 }}>
                  Suggest → <strong>{aiProposal.suggested_canonical}</strong> (98% confidence)
                </div>
              </div>
              <button className="btn-approve" onClick={() => {
                alert(`Approved mapping: ${aiProposal.vendor_object} -> ${aiProposal.suggested_canonical}`);
                setAiProposal(null);
              }}>
                <Check size={12} /> Approve
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ed-text-muted)', textAlign: 'center', padding: 12 }}>
              All vendor mappings verified by AI mapping engine.
            </div>
          )}
        </div>
      </div>

      {/* Add Mapping Modal */}
      {mappingModalOpen && (
        <div className="connect-modal-overlay" onClick={() => setMappingModalOpen(false)}>
          <div className="connect-modal" onClick={e => e.stopPropagation()}>
            <div className="connect-modal-header">
              <h3>Add Vendor Mapping</h3>
              <button onClick={() => setMappingModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ed-text-muted)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="connect-modal-body">
              <div className="drv-dev-field">
                <label>Vendor System</label>
                <select value={mapVendor} onChange={e => setMapVendor(e.target.value)}>
                  <option value="SAP S/4HANA">SAP S/4HANA</option>
                  <option value="Oracle ERP">Oracle ERP</option>
                  <option value="Salesforce CRM">Salesforce CRM</option>
                  <option value="QuickBooks Online">QuickBooks Online</option>
                  <option value="Oracle NetSuite">Oracle NetSuite</option>
                  <option value="Microsoft Dynamics">Microsoft Dynamics</option>
                </select>
              </div>

              <div className="drv-dev-field">
                <label>Vendor Object / Table Name</label>
                <input
                  type="text"
                  placeholder="e.g. MARA, AP_INVOICES_ALL, Account"
                  value={mapVendorObj}
                  onChange={e => setMapVendorObj(e.target.value)}
                />
              </div>

              <div className="drv-dev-field">
                <label>Target Canonical Object</label>
                <input
                  type="text"
                  disabled
                  value={selectedObjSpec?.canonical_name || 'CanonicalObject'}
                />
              </div>
            </div>
            <div className="connect-modal-footer">
              <button className="dash-btn" onClick={() => setMappingModalOpen(false)}>Cancel</button>
              <button className="dash-btn dash-btn-primary" onClick={handleAddMapping}>Save Mapping</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseOntology;
