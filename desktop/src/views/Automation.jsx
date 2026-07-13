import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import WorkflowStudio from '../components/WorkflowStudio/WorkflowStudio';
import { 
  Plus, Play, Trash2, Workflow, Zap, History, Key, 
  Settings, ArrowRight, Activity, CheckCircle, XCircle, Clock, AlertCircle, Square
} from 'lucide-react';
import ModelsManager from '../components/ExecutionOS/ModelsManager';
import MCPServers from '../components/ExecutionOS/MCPServers';
import Policies from '../components/ExecutionOS/Policies';
import Marketplace from '../components/ExecutionOS/Marketplace';
import ToolsRegistry from '../components/ExecutionOS/ToolsRegistry';
import './Automation.css';

const formatDuration = (seconds) => {
  if (!seconds) return '0s';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
};

const formatDate = (ts) => {
  if (!ts) return 'Unknown';
  return new Date(ts * 1000).toLocaleString();
};

const Automation = () => {
  const [activeTab, setActiveTab] = useState('workflows-studio');
  const [workflows, setWorkflows] = useState([]);
  const [history, setHistory] = useState([]);
  const [secrets, setSecrets] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretVal, setNewSecretVal] = useState('');
  const [showSecretForm, setShowSecretForm] = useState(false);
  const [runningWorkflows, setRunningWorkflows] = useState(new Set());
  const { t } = useTranslation();

  const refreshData = () => {
    fetch('http://127.0.0.1:8420/automation/workflows')
      .then(res => res.json())
      .then(data => setWorkflows(data.workflows || []))
      .catch(err => console.error("Failed to load workflows:", err));

    fetch('http://127.0.0.1:8420/automation/history')
      .then(res => res.json())
      .then(data => setHistory(data.history || []))
      .catch(err => console.error("Failed to load history:", err));
      
    fetch('http://127.0.0.1:8420/automation/templates')
      .then(res => res.json())
      .then(data => setTemplates(data.templates || []))
      .catch(err => console.error("Failed to load templates:", err));

    fetch('http://127.0.0.1:8420/automation/secrets')
      .then(res => res.json())
      .then(data => {
        if(data.keys) {
          setSecrets(data.keys.map(k => ({ id: k, key: k, updated: 'Saved' })));
        }
      })
      .catch(err => console.error("Failed to load secrets:", err));
  };

  useEffect(() => {
    refreshData();

    // Poll history and workflows every 3 seconds to keep UI in sync
    const interval = setInterval(() => {
      fetch('http://127.0.0.1:8420/automation/history')
        .then(res => res.json())
        .then(data => setHistory(data.history || []))
        .catch(err => console.error("Failed to poll history:", err));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleRunWorkflow = async (workflowId) => {
    setRunningWorkflows(prev => new Set([...prev, workflowId]));
    try {
      await fetch(`http://127.0.0.1:8420/automation/run/${workflowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      // Wait a bit then refresh history
      setTimeout(() => {
        setRunningWorkflows(prev => { const s = new Set(prev); s.delete(workflowId); return s; });
        refreshData();
      }, 3000);
    } catch (e) {
      console.error("Failed to run workflow:", e);
      setRunningWorkflows(prev => { const s = new Set(prev); s.delete(workflowId); return s; });
    }
  };

  const handleCancelRun = async (runId) => {
    if (!confirm('Are you sure you want to stop this running workflow?')) return;
    try {
      const res = await fetch(`http://127.0.0.1:8420/automation/runs/${runId}/cancel`, {
        method: 'POST'
      });
      if (res.ok) {
        refreshData();
      } else {
        const data = await res.json();
        alert(`Failed to cancel: ${data.detail || 'unknown error'}`);
      }
    } catch (e) {
      console.error("Failed to cancel run:", e);
    }
  };

  const handleDeleteWorkflow = async (workflowId) => {
    if (!confirm('Delete this workflow?')) return;
    try {
      await fetch(`http://127.0.0.1:8420/automation/workflows/${workflowId}`, { method: 'DELETE' });
      setWorkflows(workflows.filter(w => w.id !== workflowId));
    } catch (e) {
      console.error("Failed to delete workflow:", e);
    }
  };

  const handleInstallTemplate = async (template) => {
    try {
      const payload = {
        name: template.name,
        description: template.description,
        trigger: template.trigger,
        nodes: template.nodes || [],
        edges: template.edges || [],
        variables: template.variables || {},
        permissions: template.permissions || [],
        enabled: true
      };
      const res = await fetch('http://127.0.0.1:8420/automation/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setWorkflows([...workflows, data.workflow]);
        alert(`"${template.name}" installed as workflow!`);
      }
    } catch (e) {
      console.error("Failed to install template:", e);
    }
  };

  const handleAddSecret = async () => {
    if (newSecretKey.trim() && newSecretVal.trim()) {
      try {
        await fetch('http://127.0.0.1:8420/automation/secrets', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ key: newSecretKey.toUpperCase(), value: newSecretVal })
        });
        setSecrets([...secrets, { id: newSecretKey.toUpperCase(), key: newSecretKey.toUpperCase(), updated: 'Just now' }]);
        setNewSecretKey('');
        setNewSecretVal('');
        setShowSecretForm(false);
      } catch(e) {
        console.error("Failed to save secret:", e);
      }
    }
  };

  const handleDeleteSecret = async (id) => {
    if (!confirm(`Delete secret "${id}"?`)) return;
    try {
      await fetch(`http://127.0.0.1:8420/automation/secrets/${id}`, { method: 'DELETE' });
      setSecrets(secrets.filter(s => s.id !== id));
    } catch(e) {
      console.error("Failed to delete secret:", e);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'Completed') return <CheckCircle size={16} color="var(--f-moss)" />;
    if (status === 'Failed') return <XCircle size={16} color="var(--f-dead)" />;
    if (status === 'Running') return <Activity size={16} color="var(--f-alive)" />;
    return <Clock size={16} color="var(--f-stone)" />;
  };

  const renderContent = () => {
    if (activeTab === 'workflows-studio') {
      return <WorkflowStudio />;
    }

    return (
      <div className="auto-container full-width">
        <div className="auto-main" style={{ padding: '40px' }}>
          {activeTab === 'workflows' && (
            <>
              <div className="auto-header">
                <h1 className="f-serif-italic">Workflows</h1>
                <p>Manage your installed automations</p>
              </div>

              {history.some(h => h.status === 'Running') && (
                <div className="auto-card" style={{ marginBottom: 24, background: 'rgba(230,90,90,0.05)', border: '1px solid rgba(230,90,90,0.2)', maxWidth: 800 }}>
                  <h4 style={{ marginBottom: 12, color: 'var(--f-dead)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <Activity size={16} className="spin" color="var(--f-dead)" /> Active Executions (Running)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {history.filter(h => h.status === 'Running').map(h => (
                      <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--f-parchment)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--f-bark)' }}>
                        <div style={{ fontSize: 13 }}>
                          <strong>{h.workflow_name || h.workflow || 'Unknown'}</strong> <span style={{ color: 'var(--f-stone)', marginLeft: 8 }}>(ID: {h.id.slice(0, 8)}...)</span>
                        </div>
                        <button 
                          className="secondary-btn" 
                          onClick={() => handleCancelRun(h.id)}
                          style={{ padding: '4px 10px', fontSize: 11, borderColor: 'var(--f-dead)', color: 'var(--f-dead)', background: 'white' }}
                        >
                          Cancel/Stop
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="auto-grid">
                {workflows.length === 0 ? (
                  <div style={{color: 'var(--f-earth)'}}>No workflows found. Switch to Workflow Studio to create one, or install from Templates.</div>
                ) : (
                  workflows.map(w => (
                    <div key={w.id} className="workflow-card">
                      <div className="card-header">
                        <h3>{w.name}</h3>
                        <div style={{display: 'flex', gap: 4}}>
                          {history.some(h => h.workflow_id === w.id && h.status === 'Running') ? (
                            <button 
                              className="icon-btn" 
                              onClick={() => {
                                const activeRun = history.find(h => h.workflow_id === w.id && h.status === 'Running');
                                if (activeRun) handleCancelRun(activeRun.id);
                              }}
                              title="Stop workflow run"
                              style={{ color: 'var(--f-dead)' }}
                            >
                              <Square size={16} fill="currentColor" />
                            </button>
                          ) : (
                            <button 
                              className="icon-btn" 
                              onClick={() => handleRunWorkflow(w.id)}
                              disabled={runningWorkflows.has(w.id)}
                              title="Run workflow"
                            >
                              {runningWorkflows.has(w.id) ? <Activity size={16} className="spin" /> : <Play size={16} />}
                            </button>
                          )}
                          <button className="icon-btn" onClick={() => handleDeleteWorkflow(w.id)} title="Delete workflow">
                            <Trash2 size={16} color="var(--f-dead)" />
                          </button>
                        </div>
                      </div>
                      <p>{w.description}</p>
                      <div className="card-meta">
                        <span className={`status-indicator ${w.enabled ? 'enabled' : ''}`}>{w.enabled ? 'Enabled' : 'Disabled'}</span>
                        <span>{w.nodes?.length || 0} Nodes</span>
                        <span className="trigger-badge">{w.trigger?.type || 'manual'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'templates' && (
            <>
              <div className="auto-header">
                <h1 className="f-serif-italic">Templates</h1>
                <p>Install ready-made automations</p>
              </div>
              <div className="auto-grid">
                {templates.length === 0 ? (
                  <div style={{color: 'var(--f-earth)'}}>No templates available.</div>
                ) : (
                  templates.map(tmpl => {
                    const isInstalled = workflows.some(w => w.name === tmpl.name);
                    return (
                      <div key={tmpl.id} className="template-card">
                        <div className="card-header">
                          <h3>{tmpl.name}</h3>
                          <button 
                            className={isInstalled ? "secondary-btn" : "primary-btn"} 
                            style={{padding: '4px 12px', fontSize: 12}}
                            onClick={() => !isInstalled && handleInstallTemplate(tmpl)}
                            disabled={isInstalled}
                          >
                            {isInstalled ? 'Installed ✓' : 'Install'}
                          </button>
                        </div>
                        <p>{tmpl.description}</p>
                        <div className="card-meta">
                          <span className="trigger-badge">{tmpl.trigger?.type || 'Manual'}</span>
                          <span>{tmpl.nodes?.length || 0} Nodes</span>
                          <span style={{fontSize: 11, color: 'var(--f-stone)'}}>{(tmpl.permissions || []).join(', ')}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <>
              <div className="auto-header">
                <h1 className="f-serif-italic">Execution History</h1>
                <p>Logs of recent automation runs</p>
              </div>
              <div className="auto-grid" style={{gridTemplateColumns: '1fr', maxWidth: 900}}>
                {history.map(h => (
                  <div key={h.id} className="auto-card" style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        {getStatusIcon(h.status)}
                        <h4 style={{margin: 0}}>{h.workflow_name || h.workflow || 'Unknown Workflow'}</h4>
                      </div>
                      <div style={{color: h.status === 'Completed' ? 'var(--f-moss)' : h.status === 'Failed' ? 'var(--f-dead)' : 'var(--f-alive)', fontWeight: 500, fontSize: 13}}>
                        {h.status}
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: 24, fontSize: 12, color: 'var(--f-soil)', alignItems: 'center'}}>
                      <span>Started: {formatDate(h.started_at)}</span>
                      <span>Duration: {formatDuration(h.duration)}</span>
                      {h.nodes && <span>{h.nodes.length} nodes executed</span>}
                      {h.status === 'Running' && (
                        <button 
                          className="secondary-btn" 
                          onClick={() => handleCancelRun(h.id)}
                          style={{padding: '2px 8px', fontSize: 11, borderColor: 'var(--f-dead)', color: 'var(--f-dead)', marginLeft: 'auto'}}
                        >
                          Stop Run
                        </button>
                      )}
                    </div>
                    {h.error && (
                      <div style={{background: 'rgba(200,50,50,0.1)', padding: '6px 10px', borderRadius: 6, fontSize: 12, color: 'var(--f-dead)'}}>
                        <AlertCircle size={12} style={{display: 'inline', marginRight: 4}} /> {h.error}
                      </div>
                    )}
                    {h.nodes && h.nodes.length > 0 && (
                      <div style={{borderTop: '1px solid var(--f-bark)', paddingTop: 8, marginTop: 4}}>
                        <div style={{fontSize: 11, fontWeight: 600, color: 'var(--f-earth)', marginBottom: 6}}>NODE EXECUTION LOG</div>
                        {h.nodes.map(n => (
                          <details key={n.id} style={{marginBottom: 4}}>
                            <summary style={{display: 'flex', gap: 12, fontSize: 12, color: 'var(--f-soil)', alignItems: 'center', cursor: 'pointer', outline: 'none'}}>
                              {getStatusIcon(n.status)}
                              <span style={{fontFamily: 'var(--font-mono)', color: 'var(--f-deep)'}}>{n.skill}</span>
                              <span>{formatDuration(n.duration)}</span>
                            </summary>
                            <div style={{marginTop: 8, marginLeft: 28, padding: '8px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--f-earth)', whiteSpace: 'pre-wrap'}}>
                              {n.logs && <div style={{marginBottom: 6}}><strong>Logs:</strong><br/>{n.logs}</div>}
                              {n.outputs_json && n.outputs_json !== '{}' && <div><strong>Outputs:</strong><br/>{n.outputs_json}</div>}
                              {!n.logs && (!n.outputs_json || n.outputs_json === '{}') && <div>No detailed logs available.</div>}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {history.length === 0 && <p style={{color: 'var(--f-stone)'}}>No execution history yet. Run a workflow to see results here.</p>}
              </div>
            </>
          )}

          {activeTab === 'secrets' && (
            <>
              <div className="auto-header">
                <h1 className="f-serif-italic">Secrets Vault</h1>
                <p>Securely store API keys and tokens locally</p>
              </div>
              
              <div className="auto-card" style={{marginBottom: 24, maxWidth: 500, background: 'var(--f-parchment)'}}>
                <h4 style={{marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8}}>
                  <Plus size={16} /> Add New Secret
                </h4>
                <input 
                  type="text" 
                  placeholder="Key Name (e.g. TELEGRAM_BOT_TOKEN)" 
                  className="secret-input"
                  value={newSecretKey}
                  onChange={e => setNewSecretKey(e.target.value)}
                  style={{width: '100%', marginBottom: 8}}
                />
                <input 
                  type="password" 
                  placeholder="Secret Value (e.g. 7123456789:AAG...)" 
                  className="secret-input"
                  value={newSecretVal}
                  onChange={e => setNewSecretVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSecret()}
                  style={{width: '100%'}}
                />
                <div style={{display: 'flex', gap: 8, marginTop: 16, alignItems: 'center'}}>
                  <button className="primary-btn" onClick={handleAddSecret} disabled={!newSecretKey.trim() || !newSecretVal.trim()}>Save Secret</button>
                  <span style={{fontSize: 11, color: 'var(--f-stone)'}}>Use in workflows as {'{{'}secrets.KEY_NAME{'}}'}</span>
                </div>
              </div>

              <div style={{fontSize: 13, fontWeight: 600, color: 'var(--f-earth)', marginBottom: 12}}>
                Stored Secrets ({secrets.length})
              </div>
              <div className="auto-grid" style={{gridTemplateColumns: '1fr', maxWidth: 800}}>
                {secrets.map(s => (
                  <div key={s.id} className="auto-card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                      <Key size={16} color="var(--f-moss)" />
                      <div style={{fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--f-deep)'}}>{s.key}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{color: 'var(--f-soil)', fontSize: 12}}>••••••••</div>
                      <button className="icon-btn" onClick={() => handleDeleteSecret(s.key)}><Trash2 size={16} color="var(--f-dead)" /></button>
                    </div>
                  </div>
                ))}
                {secrets.length === 0 && <p style={{color: 'var(--f-stone)'}}>No secrets stored yet. Add API keys above.</p>}
              </div>
            </>
          )}

          {activeTab === 'marketplace' && <Marketplace />}
          {activeTab === 'models' && <ModelsManager />}
          {activeTab === 'tools' && <ToolsRegistry />}
          {activeTab === 'mcp' && <MCPServers />}
          {activeTab === 'policies' && <Policies />}
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div className="automation-nav" style={{ 
        position: 'absolute', top: 0, left: 0, right: 0, height: 40, 
        borderBottom: '1px solid var(--f-bark)', background: 'var(--f-cream)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 4, zIndex: 100,
        overflowX: 'auto'
      }}>
        <div style={{fontWeight: 600, color: 'var(--f-deep)', marginRight: 16, whiteSpace: 'nowrap'}}>Execution OS</div>
        {[
          ['workflows-studio', 'Workflow Studio'],
          ['workflows', 'Workflows'],
          ['templates', 'Templates'],
          ['history', 'History'],
          ['marketplace', 'Marketplace'],
          ['models', 'Models'],
          ['tools', 'Tools'],
          ['mcp', 'MCP'],
          ['secrets', 'Secrets'],
          ['policies', 'Policies'],
        ].map(([id, label]) => (
          <button 
            key={id}
            onClick={() => setActiveTab(id)} 
            style={{ 
              border: 'none', background: activeTab === id ? 'var(--f-linen)' : 'transparent', 
              cursor: 'pointer', color: activeTab === id ? 'var(--f-moss)' : 'var(--f-soil)', 
              fontWeight: activeTab === id ? 600 : 400, padding: '6px 12px', borderRadius: 6,
              fontSize: 13, whiteSpace: 'nowrap', transition: 'all 0.15s'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ width: '100%', height: 'calc(100% - 40px)', marginTop: 40 }}>
        {renderContent()}
      </div>
    </div>
  );
};

export default Automation;
