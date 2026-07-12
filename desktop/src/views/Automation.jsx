import React, { useState, useEffect, useCallback } from 'react';
import { Play, ToggleLeft, ToggleRight, Trash2, Plus, Clock, Settings, FileText, Database, Code, RefreshCw, Key, Shield, HelpCircle, ArrowRight } from 'lucide-react';
import './Automation.css';

const Automation = () => {
  const [workflows, setWorkflows] = useState([]);
  const [history, setHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState('workflows'); // workflows, templates, history, secrets
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [viewMode, setViewMode] = useState('intent'); // intent, developer
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowPrompt, setNewFlowPrompt] = useState('');
  const [planning, setPlanning] = useState(false);

  // Vault Secrets States
  const [secrets, setSecrets] = useState([]);
  const [secretKey, setSecretKey] = useState('');
  const [secretVal, setSecretVal] = useState('');

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8420/automation/workflows');
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8420/automation/history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8420/automation/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchSecrets = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8420/automation/secrets');
      const data = await res.json();
      setSecrets(data.keys || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
    fetchHistory();
    fetchTemplates();
    fetchSecrets();
  }, [fetchWorkflows, fetchHistory, fetchTemplates, fetchSecrets]);

  const handlePlanIntent = async () => {
    if (!newFlowPrompt.trim()) return;
    setPlanning(true);
    try {
      const res = await fetch('http://localhost:8420/automation/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: newFlowPrompt })
      });
      const data = await res.json();
      if (data.plan) {
        // Save the plan to backend
        const saveRes = await fetch('http://localhost:8420/automation/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.plan)
        });
        const savedData = await saveRes.json();
        setNewFlowPrompt('');
        fetchWorkflows();
        setSelectedWorkflow(savedData.workflow);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPlanning(false);
    }
  };

  const handleInstallTemplate = async (template) => {
    try {
      const res = await fetch('http://localhost:8420/automation/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });
      fetchWorkflows();
      setActiveTab('workflows');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteWorkflow = async (id) => {
    try {
      await fetch(`http://localhost:8420/automation/workflows/${id}`, { method: 'DELETE' });
      if (selectedWorkflow?.id === id) setSelectedWorkflow(null);
      fetchWorkflows();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleWorkflow = async (flow) => {
    const updated = { ...flow, enabled: !flow.enabled };
    try {
      await fetch('http://localhost:8420/automation/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      fetchWorkflows();
      if (selectedWorkflow?.id === flow.id) {
        setSelectedWorkflow(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerRun = async (id) => {
    try {
      await fetch(`http://localhost:8420/automation/run/${id}`, { method: 'POST' });
      setTimeout(fetchHistory, 1000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSecret = async () => {
    if (!secretKey.trim() || !secretVal.trim()) return;
    try {
      await fetch('http://localhost:8420/automation/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: secretKey, value: secretVal })
      });
      setSecretKey('');
      setSecretVal('');
      fetchSecrets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSecret = async (key) => {
    try {
      await fetch(`http://localhost:8420/automation/secrets/${key}`, { method: 'DELETE' });
      fetchSecrets();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="automation-container">
      <div className="automation-sidebar">
        <div className="sidebar-header">
          <h2>Automation OS</h2>
          <span className="subtitle">Intent Native</span>
        </div>
        
        <ul className="nav-tabs">
          <li className={activeTab === 'workflows' ? 'active' : ''} onClick={() => setActiveTab('workflows')}>
            <Code size={16} /> Workflows
          </li>
          <li className={activeTab === 'templates' ? 'active' : ''} onClick={() => setActiveTab('templates')}>
            <FileText size={16} /> Templates
          </li>
          <li className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
            <Clock size={16} /> Execution History
          </li>
          <li className={activeTab === 'secrets' ? 'active' : ''} onClick={() => setActiveTab('secrets')}>
            <Key size={16} /> Vault Secrets
          </li>
        </ul>

        {activeTab === 'workflows' && (
          <div className="workflows-panel">
            <div className="planning-box">
              <h4>Generate via Intent</h4>
              <textarea 
                placeholder="e.g. Every hour, read clipboard and summarize it"
                value={newFlowPrompt}
                onChange={(e) => setNewFlowPrompt(e.target.value)}
                disabled={planning}
              />
              <button className="btn-plan" onClick={handlePlanIntent} disabled={planning}>
                {planning ? <RefreshCw className="spin-icon" size={14} /> : <Plus size={14} />}
                {planning ? 'Planning DAG...' : 'Create Workflow'}
              </button>
            </div>
            
            <ul className="flow-list">
              {workflows.map(w => (
                <li 
                  key={w.id} 
                  className={`flow-item ${selectedWorkflow?.id === w.id ? 'selected' : ''}`}
                  onClick={() => setSelectedWorkflow(w)}
                >
                  <div className="flow-item-header">
                    <strong>{w.name}</strong>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={(e) => { e.stopPropagation(); handleToggleWorkflow(w); }}>
                        {w.enabled ? <ToggleRight size={20} color="#00e87a" /> : <ToggleLeft size={20} color="#86868b" />}
                      </button>
                      <button className="del-btn" onClick={(e) => { e.stopPropagation(); handleDeleteWorkflow(w.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <span className="flow-trigger-desc">Trigger: {w.trigger.type}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="templates-panel">
            <ul className="template-list">
              {templates.map(t => (
                <li key={t.id} className="template-item">
                  <div className="template-item-meta">
                    <strong>{t.name}</strong>
                    <p>{t.description}</p>
                    <span className="flow-trigger-desc">Trigger: {t.trigger.type}</span>
                  </div>
                  <button className="btn-install" onClick={() => handleInstallTemplate(t)}>
                    Install Template
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-panel">
            <ul className="history-list">
              {history.map(h => (
                <li key={h.id} className="history-item">
                  <div className="history-header">
                    <strong>{h.workflow_name || 'Workflow'}</strong>
                    <span className={`status-badge ${h.status.toLowerCase()}`}>{h.status}</span>
                  </div>
                  <span className="history-time">{new Date(h.started_at * 1000).toLocaleString()}</span>
                  {h.duration > 0 && <span className="history-duration">Duration: {h.duration.toFixed(2)}s</span>}
                  {h.error && <p className="history-error">{h.error}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'secrets' && (
          <div className="secrets-panel">
            <div className="vault-form">
              <h4>Local Secure Vault</h4>
              <input 
                type="text" 
                placeholder="Secret Key (e.g. TELEGRAM_TOKEN)" 
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
              />
              <input 
                type="password" 
                placeholder="Secret Value" 
                value={secretVal}
                onChange={(e) => setSecretVal(e.target.value)}
              />
              <button className="btn-save-secret" onClick={handleSaveSecret}>
                Save Key
              </button>
            </div>
            <ul className="secret-list">
              {secrets.map(k => (
                <li key={k} className="secret-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Key size={14} color="#86868b" />
                    <span>{k}</span>
                  </div>
                  <button className="del-btn" onClick={() => handleDeleteSecret(k)}>
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="automation-canvas">
        {selectedWorkflow ? (
          <div className="canvas-content">
            <div className="canvas-header">
              <div>
                <h3>{selectedWorkflow.name}</h3>
                <p className="flow-trigger-desc">{selectedWorkflow.description}</p>
              </div>
              <div className="canvas-actions">
                <button className="btn-run" onClick={() => handleTriggerRun(selectedWorkflow.id)}>
                  <Play size={14} /> Run once
                </button>
                <div className="view-mode-toggle">
                  <button className={viewMode === 'intent' ? 'active' : ''} onClick={() => setViewMode('intent')}>Intent</button>
                  <button className={viewMode === 'developer' ? 'active' : ''} onClick={() => setViewMode('developer')}>Developer</button>
                </div>
              </div>
            </div>

            <div className="canvas-body">
              {viewMode === 'intent' ? (
                <div className="intent-view">
                  <div className="trigger-block block">
                    <span className="block-type">TRIGGER</span>
                    <h4>{selectedWorkflow.trigger.type.toUpperCase()}</h4>
                    {selectedWorkflow.trigger.interval && <span className="block-val">Interval: {selectedWorkflow.trigger.interval}s</span>}
                    {selectedWorkflow.trigger.regex && <span className="block-val">Pattern: {selectedWorkflow.trigger.regex}</span>}
                    {selectedWorkflow.trigger.path && <span className="block-val">Watch Path: {selectedWorkflow.trigger.path}</span>}
                  </div>
                  
                  {selectedWorkflow.nodes.map((node, idx) => (
                    <React.Fragment key={node.id}>
                      <div className="block-connector">
                        <ArrowRight size={16} color="#48484a" />
                      </div>
                      <div className="node-block block">
                        <span className="block-type">ACTION STEP {idx + 1}</span>
                        <h4>{node.skill}</h4>
                        <pre className="block-inputs">{JSON.stringify(node.inputs, null, 2)}</pre>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="developer-view">
                  <div className="dag-pane">
                    <h4>Directed Acyclic Graph (DAG) Layout</h4>
                    <div className="dag-grid">
                      {selectedWorkflow.nodes.map(n => (
                        <div key={n.id} className="dag-node">
                          <strong>{n.id}</strong>
                          <span className="dag-node-skill">{n.skill}</span>
                          {n.depends_on.length > 0 && (
                            <span className="dag-node-deps">Depends: {n.depends_on.join(', ')}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="permissions-pane">
                    <h4>Requested Permissions</h4>
                    <ul className="perm-list">
                      {selectedWorkflow.permissions?.map(p => (
                        <li key={p} className="perm-item">
                          <Shield size={14} color="#00e87a" />
                          <span>{p}</span>
                        </li>
                      ))}
                      {(!selectedWorkflow.permissions || selectedWorkflow.permissions.length === 0) && (
                        <span className="no-perm-msg">No special permissions requested.</span>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="canvas-empty">
            <HelpCircle size={48} color="#48484a" />
            <h3>No Workflow Selected</h3>
            <p>Select a workflow from the list or create a new intent to view the execution graph.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Automation;
