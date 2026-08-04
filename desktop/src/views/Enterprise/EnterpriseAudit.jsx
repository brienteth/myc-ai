import React, { useState, useEffect } from 'react';
import { Search, History, AlertTriangle, CheckCircle, XCircle, Clock, Server, FileText, Download, ShieldCheck, UserCheck, Play, ArrowRight, Eye, Code, File } from 'lucide-react';
import './Enterprise.css';

const EnterpriseAudit = () => {
  const [metrics, setMetrics] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [executions, setExecutions] = useState([]);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');

  // Details data for selected execution
  const [timeline, setTimeline] = useState([]);
  const [driverCalls, setDriverCalls] = useState([]);
  const [policyDecisions, setPolicyDecisions] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [artifacts, setArtifacts] = useState([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8420/enterprise/audit/dashboard')
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(err => console.error("Failed to load audit metrics:", err));

    fetchExecutions();
  }, []);

  const fetchExecutions = () => {
    fetch(`http://127.0.0.1:8420/enterprise/audit/search?q=${encodeURIComponent(searchQuery)}`)
      .then(res => res.json())
      .then(data => setExecutions(data.executions || []))
      .catch(err => console.error("Failed to search executions:", err));
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchExecutions();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSelectExecution = (exec) => {
    setSelectedExecution(exec);
    setActiveTab('timeline');
    
    // Fetch details
    fetch(`http://127.0.0.1:8420/enterprise/audit/executions/${exec.id}/timeline`).then(r => r.json()).then(d => setTimeline(d.timeline || []));
    fetch(`http://127.0.0.1:8420/enterprise/audit/executions/${exec.id}/driver-calls`).then(r => r.json()).then(d => setDriverCalls(d.calls || []));
    fetch(`http://127.0.0.1:8420/enterprise/audit/executions/${exec.id}/policy-decisions`).then(r => r.json()).then(d => setPolicyDecisions(d.decisions || []));
    fetch(`http://127.0.0.1:8420/enterprise/audit/executions/${exec.id}/approvals`).then(r => r.json()).then(d => setApprovals(d.approvals || []));
    fetch(`http://127.0.0.1:8420/enterprise/audit/executions/${exec.id}/artifacts`).then(r => r.json()).then(d => setArtifacts(d.artifacts || []));
  };

  const handleReplay = () => {
    if (!selectedExecution) return;
    fetch(`http://127.0.0.1:8420/enterprise/audit/executions/${selectedExecution.id}/replay?mode=standard`, { method: 'POST' })
      .then(r => r.json())
      .then(d => alert(d.message))
      .catch(err => console.error(err));
  };

  const handleReport = () => {
    if (!selectedExecution) return;
    fetch(`http://127.0.0.1:8420/enterprise/audit/executions/${selectedExecution.id}/report`, { method: 'POST' })
      .then(r => r.json())
      .then(d => alert("Report generated: " + d.url))
      .catch(err => console.error(err));
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed': return <CheckCircle size={14} className="status-icon success" />;
      case 'failed': return <XCircle size={14} className="status-icon error" />;
      case 'waiting': return <Clock size={14} className="status-icon warning" />;
      default: return <Clock size={14} className="status-icon" />;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--ed-serif)', fontSize: 24, margin: '0 0 6px 0', color: 'var(--ed-text)' }}>Execution Forensics</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ed-text-muted)' }}>Black box recorder for compliance, security, and digital forensics.</p>
        </div>
        <div style={{ width: 300 }}>
          <div className="audit-search-bar">
            <Search size={16} color="var(--ed-text-muted)" />
            <input 
              type="text" 
              placeholder="Search by ID, User, Driver, Status..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* KPI Row */}
      {metrics && (
        <div className="audit-kpi-row">
          <div className="audit-kpi-card">
            <div className="audit-kpi-title">TOTAL EXECUTIONS</div>
            <div className="audit-kpi-val">{metrics.total_executions.value}</div>
            <div className={`audit-kpi-trend ${metrics.total_executions.trend}`}>↑ {metrics.total_executions.pct}</div>
          </div>
          <div className="audit-kpi-card">
            <div className="audit-kpi-title">FAILED EXECUTIONS</div>
            <div className="audit-kpi-val">{metrics.failed_executions.value}</div>
            <div className={`audit-kpi-trend ${metrics.failed_executions.trend}`}>↓ {metrics.failed_executions.pct}</div>
          </div>
          <div className="audit-kpi-card">
            <div className="audit-kpi-title">APPROVALS</div>
            <div className="audit-kpi-val">{metrics.approvals.value}</div>
            <div className={`audit-kpi-trend ${metrics.approvals.trend}`}>↑ {metrics.approvals.pct}</div>
          </div>
          <div className="audit-kpi-card">
            <div className="audit-kpi-title">POLICY VIOLATIONS</div>
            <div className="audit-kpi-val">{metrics.policy_violations.value}</div>
            <div className={`audit-kpi-trend ${metrics.policy_violations.trend}`}>↓ {metrics.policy_violations.pct}</div>
          </div>
          <div className="audit-kpi-card">
            <div className="audit-kpi-title">EXTERNAL API CALLS</div>
            <div className="audit-kpi-val">{metrics.external_api_calls.value}</div>
            <div className={`audit-kpi-trend ${metrics.external_api_calls.trend}`}>↑ {metrics.external_api_calls.pct}</div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="audit-layout">
        
        {/* Left: Filters */}
        <div className="audit-filters">
          <div className="audit-filter-section">
            <div className="audit-filter-title">Date</div>
            <div className="audit-filter-item">Today</div>
            <div className="audit-filter-item">Yesterday</div>
            <div className="audit-filter-item">7 Days</div>
            <div className="audit-filter-item">Custom</div>
          </div>
          <div className="audit-filter-section">
            <div className="audit-filter-title">Status</div>
            <div className="audit-filter-item"><CheckCircle size={12} color="var(--ed-green)"/> Completed</div>
            <div className="audit-filter-item"><XCircle size={12} color="var(--ed-red)"/> Failed</div>
            <div className="audit-filter-item"><Clock size={12} color="var(--ed-yellow)"/> Waiting</div>
          </div>
          <div className="audit-filter-section">
            <div className="audit-filter-title">Drivers</div>
            <div className="audit-filter-item">SAP</div>
            <div className="audit-filter-item">Oracle</div>
            <div className="audit-filter-item">Salesforce</div>
            <div className="audit-filter-item">Slack</div>
          </div>
        </div>

        {/* Center: List */}
        <div className="audit-list">
          {executions.map(ex => (
            <div 
              key={ex.id} 
              className={`audit-list-item ${selectedExecution?.id === ex.id ? 'selected' : ''}`}
              onClick={() => handleSelectExecution(ex)}
            >
              <div className="audit-item-header">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {getStatusIcon(ex.status)}
                  <span className="audit-item-name">{ex.name}</span>
                </div>
              </div>
              <div className="audit-item-meta">
                <span>{ex.duration}</span>
                <span>•</span>
                <span>{ex.user}</span>
                <span>•</span>
                <span>{ex.date.split(',')[0]}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Details */}
        <div className="audit-detail">
          {selectedExecution ? (
            <>
              <div className="audit-detail-header">
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ed-text)' }}>{selectedExecution.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ed-text-muted)', marginTop: 4 }}>ID: {selectedExecution.id}</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="exec-btn secondary" onClick={handleReport}><FileText size={14}/> Report</button>
                  <button className="exec-btn primary" onClick={handleReplay}><Play size={14}/> Replay</button>
                </div>
              </div>
              
              <div style={{ borderBottom: '1px solid var(--ed-border)', display: 'flex', overflowX: 'auto' }}>
                {['timeline', 'driver-calls', 'policies', 'approvals', 'artifacts'].map(tab => (
                  <div 
                    key={tab}
                    style={{
                      padding: '12px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: activeTab === tab ? 'var(--ed-accent)' : 'var(--ed-text-muted)',
                      borderBottom: activeTab === tab ? '2px solid var(--ed-accent)' : '2px solid transparent',
                      textTransform: 'capitalize'
                    }}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.replace('-', ' ')}
                  </div>
                ))}
              </div>

              <div className="audit-detail-body">
                {activeTab === 'timeline' && (
                  <div className="exec-events">
                    {timeline.map((evt, idx) => (
                      <div key={idx} className="exec-event">
                        <div className="exec-event-time">{evt.time}</div>
                        <div className="exec-event-content">
                          <div className="exec-event-title">{evt.event}</div>
                          <div className="exec-event-detail">{evt.detail}</div>
                        </div>
                        <div style={{ fontSize: 10, padding: '2px 6px', background: 'var(--ed-surface)', border: '1px solid var(--ed-card-border)', borderRadius: 4, fontFamily: 'var(--ed-mono)' }}>
                          {evt.node}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'driver-calls' && (
                  <div>
                    {driverCalls.length === 0 ? <p style={{color: 'var(--ed-text-muted)', fontSize: 12}}>No driver network calls.</p> : driverCalls.map((call, idx) => (
                      <div key={idx} className="audit-driver-call">
                        <div className="audit-driver-call-head">
                          <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                            <span className="audit-http-method">{call.method}</span>
                            <span style={{fontSize: 12, fontFamily: 'var(--ed-mono)', color: 'var(--ed-text)'}}>{call.endpoint}</span>
                          </div>
                          <div className={`audit-http-status ${call.status_code >= 400 ? 'error' : 'success'}`}>
                            {call.status_code} {call.status_text} • {call.latency_ms}ms
                          </div>
                        </div>
                        <div className="audit-driver-call-body">
                          <div style={{fontSize: 11, fontWeight: 600, color: 'var(--ed-text-muted)', marginBottom: 4}}>REQUEST PAYLOAD</div>
                          <pre style={{margin: 0, padding: 8, background: 'var(--ed-bg)', borderRadius: 4, fontSize: 11, fontFamily: 'var(--ed-mono)', overflowX: 'auto', marginBottom: 12}}>
                            {JSON.stringify(call.request_payload, null, 2)}
                          </pre>
                          <div style={{fontSize: 11, fontWeight: 600, color: 'var(--ed-text-muted)', marginBottom: 4}}>RESPONSE PAYLOAD</div>
                          <pre style={{margin: 0, padding: 8, background: 'var(--ed-bg)', borderRadius: 4, fontSize: 11, fontFamily: 'var(--ed-mono)', overflowX: 'auto'}}>
                            {JSON.stringify(call.response_payload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'policies' && (
                  <div>
                    {policyDecisions.length === 0 ? <p style={{color: 'var(--ed-text-muted)', fontSize: 12}}>No policy evaluations.</p> : policyDecisions.map((pol, idx) => (
                      <div key={idx} className="audit-policy-card">
                        <div className="audit-policy-header">
                          <div className="audit-policy-title"><ShieldCheck size={14} style={{display:'inline', verticalAlign:'middle', marginRight: 6, color: 'var(--ed-accent)'}}/>{pol.policy}</div>
                          <div className={`audit-policy-result ${pol.result.toLowerCase()}`}>{pol.result}</div>
                        </div>
                        <div className="audit-policy-grid">
                          <div><span className="lbl">Limit: </span><span className="val">{pol.limit}</span></div>
                          <div><span className="lbl">Request: </span><span className="val">{pol.request}</span></div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ed-text-muted)' }}>Reason: {pol.reason}</div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'approvals' && (
                  <div className="audit-approval-chain">
                    {approvals.length === 0 ? <p style={{color: 'var(--ed-text-muted)', fontSize: 12}}>No approvals required.</p> : approvals.map((app, idx) => (
                      <div key={idx} className="audit-approval-step">
                        <div className="audit-approval-icon">
                          <UserCheck size={16} />
                        </div>
                        <div className="audit-approval-content">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>{app.step}</div>
                            <div style={{ fontSize: 11, color: 'var(--ed-text-muted)' }}>{app.time}</div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                            <div style={{ color: 'var(--ed-text-muted)' }}>Signer: <span style={{color: 'var(--ed-text)', fontWeight:500}}>{app.name}</span></div>
                            <div style={{ color: 'var(--ed-text-muted)' }}>Passkey: <span style={{color: 'var(--ed-text)', fontWeight:500}}>{app.passkey}</span></div>
                            <div style={{ color: 'var(--ed-text-muted)' }}>IP: <span style={{color: 'var(--ed-mono)', color: 'var(--ed-text)'}}>{app.ip}</span></div>
                            <div style={{ color: 'var(--ed-text-muted)' }}>Device: <span style={{color: 'var(--ed-text)'}}>{app.device}</span></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'artifacts' && (
                  <div>
                    {artifacts.length === 0 ? <p style={{color: 'var(--ed-text-muted)', fontSize: 12}}>No artifacts produced.</p> : artifacts.map((art, idx) => (
                      <div key={idx} style={{ padding: 12, background: 'var(--ed-bg)', border: '1px solid var(--ed-card-border)', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <File size={20} color="var(--ed-text-muted)" />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>{art.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', display: 'flex', gap: 10, marginTop: 2 }}>
                              <span>{art.size}</span>
                              <span>{art.mime}</span>
                              <span style={{fontFamily: 'var(--ed-mono)'}}>{art.hash.substring(0, 16)}...</span>
                            </div>
                          </div>
                        </div>
                        <button className="exec-btn secondary"><Download size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ed-text-muted)' }}>
              <History size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>Select an execution</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>View detailed forensics and audit trails</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default EnterpriseAudit;
