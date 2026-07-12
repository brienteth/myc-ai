import React, { useState, useEffect } from 'react';
import { Server, HardDrive, Shield, Settings as SettingsIcon, CheckCircle2, Trash2, Globe, Info } from 'lucide-react';
import './Settings.css';

const TABS = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'devices', label: 'Devices', icon: Server },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'privacy', label: 'Privacy', icon: Shield }
];

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [models, setModels] = useState([]);
  const [activeModel, setActiveModel] = useState('');
  const [nodes, setNodes] = useState([]);
  const [stats, setStats] = useState({ total_files: 0, total_size_bytes: 0, by_type: {} });
  const [globalDiscovery, setGlobalDiscovery] = useState(true);

  useEffect(() => {
    fetchModels();
    if (activeTab === 'devices') fetchNodes();
    if (activeTab === 'storage') fetchStats();
  }, [activeTab]);

  const fetchModels = async () => {
    try {
      const res = await fetch('http://localhost:8420/models');
      const data = await res.json();
      setModels(data.models || []);
      if (data.models && data.models.length > 0 && !activeModel) {
        setActiveModel(data.models[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const setModel = async (modelName) => {
    setActiveModel(modelName);
    try {
      await fetch('http://localhost:8420/settings/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNodes = async () => {
    try {
      const res = await fetch('http://localhost:8420/nodes/status');
      const data = await res.json();
      setNodes(data.peers || []);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleTrust = async (nodeId, currentTrust) => {
    try {
      await fetch('http://localhost:8420/node/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId, trusted: !currentTrust })
      });
      setNodes(nodes.map(n => n.node_id === nodeId ? { ...n, trusted: !currentTrust } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:8420/library/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const clearLibrary = async () => {
    if (window.confirm("Are you sure you want to clear the entire library? This action cannot be undone.")) {
      try {
        await fetch('http://localhost:8420/library/all', { method: 'DELETE' });
        fetchStats();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>
      
      <div className="settings-content">
        <div className="settings-sidebar">
          <ul className="settings-nav">
            {TABS.map(tab => (
              <li 
                key={tab.id}
                className={activeTab === tab.id ? 'active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="settings-main">
          {activeTab === 'general' && (
            <div className="settings-panel">
              <h2>General</h2>
              <div className="settings-group">
                <div className="setting-item">
                  <div className="setting-info">
                    <h3>Launch on Startup</h3>
                    <p>Start myc automatically in the background</p>
                  </div>
                  <div className="setting-control toggle active"></div>
                </div>
                
                <div className="setting-item">
                  <div className="setting-info">
                    <h3>Global Shortcut</h3>
                    <p>Keyboard shortcut to summon myc</p>
                  </div>
                  <div className="setting-control kbd-shortcut">⌘ Space</div>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <h3>Language Model (LLM)</h3>
                    <p>Active AI model running on your hardware</p>
                  </div>
                  <div className="setting-control">
                    <select 
                      className="model-select" 
                      value={activeModel}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      {models.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'devices' && (
            <div className="settings-panel">
              <h2>Devices (P2P Network)</h2>
              <p className="panel-desc">Devices discovered in the local and global network. You can share computation work with trusted nodes.</p>

              {/* Global Discovery Toggle */}
              <div className="settings-group" style={{ marginTop: 0 }}>
                <div className="setting-item">
                  <div className="setting-info">
                    <h3>Join Global P2P Mesh</h3>
                    <p>Connect with other myc users globally (via Opacus H3 registry)</p>
                  </div>
                  <div
                    className={`setting-control toggle ${globalDiscovery ? 'active' : ''}`}
                    onClick={() => setGlobalDiscovery(g => !g)}
                  />
                </div>
              </div>

              {/* Local mDNS Peers */}
              <div className="node-section-header">
                <Server size={14} />
                <span>On this Network (Wi-Fi)</span>
              </div>
              <div className="nodes-list">
                {nodes.filter(n => n.source !== 'h3_global').length === 0 ? (
                  <div className="empty-state">No other myc nodes found on the local network.</div>
                ) : (
                  nodes.filter(n => n.source !== 'h3_global').map(node => {
                    const isTrusted = node.trusted !== false;
                    return (
                      <div key={node.node_id} className="node-setting-card">
                        <div className="node-setting-info">
                          <Server size={20} color={isTrusted ? 'var(--accent-primary)' : 'var(--text-tertiary)'} />
                          <div>
                            <h3>{node.node_id}</h3>
                            <p>Last seen: {Math.round(Date.now() / 1000 - node.last_seen)}s ago</p>
                          </div>
                        </div>
                        <div className="node-setting-action">
                          <span className="trust-label">{isTrusted ? 'Trusted' : 'Blocked'}</span>
                          <div
                            className={`setting-control toggle ${isTrusted ? 'active' : ''}`}
                            onClick={() => toggleTrust(node.node_id, isTrusted)}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Global H3 Peers */}
              {globalDiscovery && (
                <>
                  <div className="node-section-header" style={{ marginTop: 20 }}>
                    <Globe size={14} />
                    <span>Globally Discovered (H3 Registry)</span>
                  </div>
                  <div className="nodes-list">
                    {nodes.filter(n => n.source === 'h3_global').length === 0 ? (
                      <div className="empty-state">
                        No global myc nodes found yet.
                        <br />
                        <small style={{ opacity: 0.6 }}>Will auto-discover once OPACUS_H3_URL is configured.</small>
                      </div>
                    ) : (
                      nodes.filter(n => n.source === 'h3_global').map(node => {
                        const isTrusted = node.trusted !== false;
                        return (
                          <div key={node.node_id} className="node-setting-card node-setting-card--global">
                            <div className="node-setting-info">
                              <Globe size={20} color={isTrusted ? '#0a84ff' : 'var(--text-tertiary)'} />
                              <div>
                                <h3>{node.node_id}</h3>
                                <p>
                                  {node.latency_ms ? `${Math.round(node.latency_ms)}ms` : 'waiting link'}
                                  {node.load_pct > 0 ? ` · ${Math.round(node.load_pct)}% load` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="node-setting-action">
                              <span className="trust-label">{isTrusted ? 'Trusted' : 'Blocked'}</span>
                              <div
                                className={`setting-control toggle ${isTrusted ? 'active' : ''}`}
                                onClick={() => toggleTrust(node.node_id, isTrusted)}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="settings-panel">
              <h2>Storage</h2>
              
              <div className="storage-overview">
                <div className="storage-stat-big">
                  <span className="value">{formatSize(stats.total_size_bytes)}</span>
                  <span className="label">Total Space</span>
                </div>
                <div className="storage-stat-big">
                  <span className="value">{stats.total_files}</span>
                  <span className="label">Total Files</span>
                </div>
              </div>

              <div className="storage-chart">
                <div className="chart-bar">
                  {Object.entries(stats.by_type || {}).map(([type, data]) => {
                    const pct = (data.size_bytes / (stats.total_size_bytes || 1)) * 100;
                    return <div key={type} className={`chart-segment type-${type}`} style={{ width: `${pct}%` }} title={`${type}: ${formatSize(data.size_bytes)}`}></div>;
                  })}
                </div>
                <div className="chart-legend">
                  {Object.keys(stats.by_type || {}).map(type => (
                    <div key={type} className="legend-item">
                      <span className={`legend-dot type-${type}`}></span> {type}
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-group danger-zone">
                <div className="setting-item">
                  <div className="setting-info">
                    <h3>Clear Library</h3>
                    <p>Permanently deletes all summaries, synced files, and historical entries.</p>
                  </div>
                  <button className="danger-btn" onClick={clearLibrary}>
                    <Trash2 size={16} /> Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="settings-panel">
              <h2>Privacy</h2>
              <p className="panel-desc">myc keeps all data entirely on your device. Zero cloud transmission.</p>
              
              <div className="privacy-cards">
                <div className="privacy-card">
                  <div className="privacy-icon"><CheckCircle2 size={24} color="#34c759" /></div>
                  <div className="privacy-text">
                    <h3>Where is data stored?</h3>
                    <p>All database files and cached documents live inside the local <code>ai-layer/data/</code> folder on your local storage.</p>
                  </div>
                </div>

                <div className="privacy-card">
                  <div className="privacy-icon"><CheckCircle2 size={24} color="#34c759" /></div>
                  <div className="privacy-text">
                    <h3>Is P2P Communication Secure?</h3>
                    <p>Only the specific text prompt goes to peer nodes. Your personal files are never sent. Mesh traffic is fully encrypted end-to-end via Kyber KEM.</p>
                  </div>
                </div>

                <div className="privacy-card">
                  <div className="privacy-icon"><Globe size={24} color="#0a84ff" /></div>
                  <div className="privacy-text">
                    <h3>About Global Discovery</h3>
                    <p>
                      When active, other myc nodes discover your node at a <strong>city level</strong> (e.g. Istanbul, New York).
                      Exact location remains hidden. Only your <code>node_id</code>, capabilities, and P2P IP are catalogued.
                      This can be turned off anytime under <strong>Settings → Devices</strong>.
                    </p>
                  </div>
                </div>

                <div className="privacy-card">
                  <div className="privacy-icon"><CheckCircle2 size={24} color="#34c759" /></div>
                  <div className="privacy-text">
                    <h3>Chat Logs</h3>
                    <p>Chat history is stored locally in an SQLite database and can be cleared instantly via the Storage tab.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
