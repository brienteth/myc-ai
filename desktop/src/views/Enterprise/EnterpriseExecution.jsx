import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  Handle, Position, MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Play, Pause, RotateCcw, X, Download, Upload, Copy, FileText,
  Clock, Server, Activity, Zap, ShieldCheck, Eye, ChevronRight,
  RefreshCw, BarChart3, Terminal, Layers, Database, Sparkles,
  AlertTriangle, CheckCircle2, XCircle, CircleDot
} from 'lucide-react';
import './Enterprise.css';

const API = 'http://127.0.0.1:8420/enterprise';

/* ══════════════════════════════════════════════════════════════
   Custom React Flow Node
   ══════════════════════════════════════════════════════════════ */
const ExecutionNode = ({ data }) => {
  const { label, type, status, duration_ms, driver } = data;
  return (
    <div className={`exec-dag-node ${type}`} style={{ cursor: 'pointer' }}>
      <Handle type="target" position={Position.Top} style={{ background: 'transparent', border: 'none' }} />
      <div>
        <span className={`node-status-dot ${status}`} />
        {label}
      </div>
      {duration_ms != null && (
        <div style={{ fontSize: 9, marginTop: 3, opacity: 0.7 }}>{duration_ms}ms{driver ? ` · ${driver}` : ''}</div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: 'transparent', border: 'none' }} />
    </div>
  );
};

const nodeTypes = { executionNode: ExecutionNode };

/* ══════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════ */
const EnterpriseExecution = () => {
  // Queue state
  const [executions, setExecutions] = useState([]);
  const [counts, setCounts] = useState({});
  const [queueFilter, setQueueFilter] = useState('all');

  // Selected execution state
  const [selectedExecId, setSelectedExecId] = useState('exec_fin_report_001');
  const [selectedExec, setSelectedExec] = useState(null);

  // Detail tab state
  const [detailTab, setDetailTab] = useState('graph');

  // Graph data
  const [graphData, setGraphData] = useState(null);

  // Sub-resources
  const [timeline, setTimeline] = useState([]);
  const [logs, setLogs] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [variables, setVariables] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [logFilter, setLogFilter] = useState('');

  // Node inspector
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [nodeDetail, setNodeDetail] = useState(null);

  // Run Wizard modal
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardForm, setWizardForm] = useState({
    name: '', description: '', need: '', priority: 'High', policy: 'Standard', environment: 'Production'
  });

  // ── Data Loading ─────────────────────────────────────────────
  const loadQueue = useCallback(() => {
    fetch(`${API}/executions${queueFilter !== 'all' ? `?status=${queueFilter}` : ''}`)
      .then(r => r.json())
      .then(d => {
        setExecutions(d.executions || []);
        setCounts(d.counts || {});
      })
      .catch(() => {});
  }, [queueFilter]);

  const loadExecDetail = useCallback(() => {
    if (!selectedExecId) return;
    fetch(`${API}/executions/${selectedExecId}`).then(r => r.json()).then(setSelectedExec).catch(() => {});
    fetch(`${API}/executions/${selectedExecId}/graph`).then(r => r.json()).then(setGraphData).catch(() => {});
    fetch(`${API}/executions/${selectedExecId}/timeline`).then(r => r.json()).then(d => setTimeline(d.timeline || [])).catch(() => {});
    fetch(`${API}/executions/${selectedExecId}/logs`).then(r => r.json()).then(d => setLogs(d.logs || [])).catch(() => {});
    fetch(`${API}/executions/${selectedExecId}/artifacts`).then(r => r.json()).then(d => setArtifacts(d.artifacts || [])).catch(() => {});
    fetch(`${API}/executions/${selectedExecId}/variables`).then(r => r.json()).then(d => setVariables(d.variables || [])).catch(() => {});
    fetch(`${API}/executions/${selectedExecId}/drivers`).then(r => r.json()).then(d => setDrivers(d.drivers || [])).catch(() => {});
    fetch(`${API}/executions/${selectedExecId}/metrics`).then(r => r.json()).then(setMetrics).catch(() => {});
  }, [selectedExecId]);

  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => { loadExecDetail(); }, [loadExecDetail]);
  useEffect(() => {
    fetch(`${API}/executions/events`).then(r => r.json()).then(d => setLiveEvents(d.events || [])).catch(() => {});
  }, []);

  // Load node detail on node click
  useEffect(() => {
    if (!selectedNodeId || !selectedExecId) { setNodeDetail(null); return; }
    fetch(`${API}/executions/${selectedExecId}/nodes/${selectedNodeId}`)
      .then(r => r.json()).then(setNodeDetail).catch(() => setNodeDetail(null));
  }, [selectedNodeId, selectedExecId]);

  // ── React Flow data ──────────────────────────────────────────
  const rfNodes = useMemo(() => {
    if (!graphData?.nodes) return [];
    return graphData.nodes.map(n => ({
      id: n.id,
      type: 'executionNode',
      position: { x: n.x, y: n.y },
      data: { label: n.label, type: n.type, status: n.status, duration_ms: n.duration_ms, driver: n.driver },
    }));
  }, [graphData]);

  const rfEdges = useMemo(() => {
    if (!graphData?.edges) return [];
    return graphData.edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      animated: true,
      style: { stroke: '#238636', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#238636', width: 14, height: 14 },
    }));
  }, [graphData]);

  // ── Lifecycle Actions ────────────────────────────────────────
  const execAction = async (action) => {
    await fetch(`${API}/executions/${selectedExecId}/${action}`, { method: 'POST' });
    loadQueue();
    loadExecDetail();
  };

  const handleCreateExecution = async () => {
    await fetch(`${API}/executions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wizardForm)
    });
    setWizardOpen(false);
    setWizardForm({ name: '', description: '', need: '', priority: 'High', policy: 'Standard', environment: 'Production' });
    loadQueue();
  };

  const filteredLogs = logFilter ? logs.filter(l => l.source.toLowerCase() === logFilter.toLowerCase()) : logs;

  const statusColor = (s) => ({ running: 'var(--ed-green)', waiting: '#58a6ff', paused: 'var(--ed-yellow)', completed: '#58a6ff', failed: 'var(--ed-red)', cancelled: 'var(--ed-text-muted)' }[s] || 'var(--ed-text)');

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="ont-header">
        <div>
          <h2>Execution</h2>
          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--ed-text-secondary)' }}>
            Enterprise Runtime Control Center · Real-Time DAG Execution & Node Orchestration
          </p>
        </div>
        <div className="ont-actions">
          <button className="dash-btn dash-btn-primary" onClick={() => setWizardOpen(true)}>
            <Play size={13} /> Run Execution
          </button>
          <button className="dash-btn"><Upload size={13} /> Import Graph</button>
          <button className="dash-btn"><Download size={13} /> Export Graph</button>
          <button className="dash-btn" onClick={() => execAction('replay')}>
            <RotateCcw size={13} /> Replay
          </button>
          <button className="dash-btn"><Copy size={13} /> Templates</button>
        </div>
      </div>

      {/* ── Queue Filter Tabs ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { key: 'all', label: 'All', count: executions.length },
          { key: 'running', label: 'Running' },
          { key: 'waiting', label: 'Waiting' },
          { key: 'paused', label: 'Paused' },
          { key: 'completed', label: 'Completed' },
          { key: 'failed', label: 'Failed' },
          { key: 'cancelled', label: 'Cancelled' },
        ].map(f => (
          <button key={f.key}
            className={`sys-filter-chip ${queueFilter === f.key ? 'active' : ''}`}
            onClick={() => setQueueFilter(f.key)}
          >
            {f.label} {counts[f.key] != null ? `(${counts[f.key]})` : f.count != null ? `(${f.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── Main Layout: Queue | Graph+Tabs ────────────────── */}
      <div className="exec-layout">
        {/* Left: Execution Queue */}
        <div className="exec-queue">
          {executions.map(ex => {
            const pct = ex.progress ? Math.round((ex.progress.completed / ex.progress.total) * 100) : 0;
            return (
              <div
                key={ex.id}
                className={`exec-card ${selectedExecId === ex.id ? 'selected' : ''}`}
                onClick={() => { setSelectedExecId(ex.id); setSelectedNodeId(null); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div className="exec-card-name">{ex.name}</div>
                  <span className={`exec-status ${ex.status}`}>{ex.status}</span>
                </div>
                <div className="exec-card-meta">
                  <span>{ex.progress?.completed}/{ex.progress?.total} nodes</span>
                  <span>{ex.elapsed}</span>
                  <span>Priority: {ex.priority}</span>
                </div>
                <div className="exec-progress-bar">
                  <div className="exec-progress-fill" style={{ width: `${pct}%`, background: statusColor(ex.status) }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Top: Graph Viewer + Detail Tabs */}
        <div className="exec-main">
          {/* Execution action bar */}
          {selectedExec && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ed-text)' }}>{selectedExec.name}</span>
                <span className={`exec-status ${selectedExec.status}`}>{selectedExec.status}</span>
                <span style={{ fontSize: 11, color: 'var(--ed-text-muted)' }}>
                  {selectedExec.progress?.completed}/{selectedExec.progress?.total} nodes · {selectedExec.elapsed}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {selectedExec.status === 'running' && (
                  <button className="dash-btn" onClick={() => execAction('pause')}><Pause size={12} /> Pause</button>
                )}
                {selectedExec.status === 'paused' && (
                  <button className="dash-btn" onClick={() => execAction('resume')}><Play size={12} /> Resume</button>
                )}
                {(selectedExec.status === 'running' || selectedExec.status === 'paused') && (
                  <button className="dash-btn" onClick={() => execAction('cancel')}><X size={12} /> Cancel</button>
                )}
                {selectedExec.status === 'failed' && (
                  <button className="dash-btn" onClick={() => execAction('retry')}><RotateCcw size={12} /> Retry</button>
                )}
                <button className="dash-btn" onClick={() => execAction('replay')}><RotateCcw size={12} /> Replay</button>
              </div>
            </div>
          )}

          {/* Detail Tabs */}
          <div className="sys-tabs">
            {['graph', 'timeline', 'logs', 'artifacts', 'variables', 'drivers', 'metrics'].map(t => (
              <button key={t} className={`sys-tab ${detailTab === t ? 'active' : ''}`} onClick={() => setDetailTab(t)}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {detailTab === 'graph' && (
            <div className="exec-graph-container">
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                fitView
                minZoom={0.3}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#1a1e24" gap={20} variant="dots" />
                <Controls position="top-right" />
                <MiniMap
                  nodeColor={(n) => {
                    const t = n.data?.type;
                    if (t === 'planner' || t === 'ai') return '#a371f7';
                    if (t === 'driver') return '#58a6ff';
                    if (t === 'approval') return '#d29922';
                    if (t === 'artifact' || t === 'done') return '#238636';
                    return '#388bfd';
                  }}
                  maskColor="rgba(0,0,0,0.7)"
                  style={{ background: '#0d1117' }}
                />
              </ReactFlow>
            </div>
          )}

          {detailTab === 'timeline' && (
            <div style={{ flex: 1, overflow: 'auto', background: 'var(--ed-surface)', borderRadius: 'var(--ed-radius-sm)', border: '1px solid var(--ed-card-border)', padding: 14 }}>
              {timeline.map((ev, i) => {
                const dotColor = ev.icon === 'check' || ev.icon === 'sparkles' || ev.icon === 'file' ? 'green' : ev.icon === 'brain' || ev.icon === 'code' ? 'purple' : ev.icon === 'clock' ? 'orange' : 'blue';
                return (
                  <div key={i} className="exec-timeline-event">
                    <div className={`exec-timeline-dot ${dotColor}`} />
                    <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', minWidth: 52, fontFamily: 'var(--ed-mono)' }}>{ev.time}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ed-text)' }}>{ev.event}</div>
                      <div style={{ fontSize: 11, color: 'var(--ed-text-muted)' }}>{ev.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {detailTab === 'logs' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['', 'Planner', 'Compiler', 'Validator', 'Runtime', 'Driver', 'Artifact', 'Approval'].map(s => (
                  <button key={s} className={`sys-filter-chip ${logFilter === s ? 'active' : ''}`} onClick={() => setLogFilter(s)}>
                    {s || 'All'}
                  </button>
                ))}
              </div>
              <div className="exec-log-console" style={{ flex: 1 }}>
                {filteredLogs.map((l, i) => (
                  <div key={i} className="exec-log-line">
                    <span className="log-time">{l.time}</span>
                    <span className={`log-level ${l.level}`}>{l.level}</span>
                    <span className="log-source">[{l.source}]</span>
                    <span className="log-msg">{l.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detailTab === 'artifacts' && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table className="sys-obj-table">
                <thead>
                  <tr><th>File</th><th>Type</th><th>Size</th><th>Hash</th><th>Owner</th></tr>
                </thead>
                <tbody>
                  {artifacts.map((a, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--ed-text)', fontFamily: 'var(--ed-mono)' }}>{a.name}</td>
                      <td><span className="sys-schema-tag">{a.mime}</span></td>
                      <td style={{ color: 'var(--ed-text-secondary)' }}>{a.size}</td>
                      <td style={{ fontSize: 10, fontFamily: 'var(--ed-mono)', color: 'var(--ed-text-muted)' }}>{a.hash}</td>
                      <td style={{ color: 'var(--ed-text-secondary)' }}>{a.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {detailTab === 'variables' && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table className="sys-obj-table">
                <thead>
                  <tr><th>Variable</th><th>Value</th><th>Type</th><th>Mutable</th></tr>
                </thead>
                <tbody>
                  {variables.map((v, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--ed-text)', fontFamily: 'var(--ed-mono)' }}>{v.key}</td>
                      <td style={{ fontFamily: 'var(--ed-mono)', color: 'var(--ed-green)' }}>{v.value}</td>
                      <td><span className="sys-schema-tag">{v.type}</span></td>
                      <td style={{ color: v.immutable ? 'var(--ed-text-muted)' : 'var(--ed-green)', fontSize: 10, fontWeight: 700 }}>
                        {v.immutable ? 'IMMUTABLE' : 'MUTABLE'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {detailTab === 'drivers' && (
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {drivers.map((drv, i) => (
                <div key={i} className="cap-driver-priority-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Server size={16} color="#58a6ff" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>{drv.name} <span style={{ fontSize: 10, color: 'var(--ed-text-muted)' }}>{drv.version}</span></div>
                      <div style={{ fontSize: 10, color: 'var(--ed-text-muted)' }}>Nodes: {drv.nodes_executed} · Data: {drv.data_transferred}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span className="sys-status-badge healthy">{drv.status}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--ed-mono)', color: 'var(--ed-green)' }}>{drv.latency_ms}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {detailTab === 'metrics' && metrics && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div className="sys-metric-grid" style={{ marginBottom: 14 }}>
                <div className="sys-metric-card"><div className="label">Total Nodes</div><div className="value">{metrics.total_nodes}</div></div>
                <div className="sys-metric-card"><div className="label">Completed</div><div className="value" style={{ color: 'var(--ed-green)' }}>{metrics.completed_nodes}</div></div>
                <div className="sys-metric-card"><div className="label">Running</div><div className="value" style={{ color: 'var(--ed-green)' }}>{metrics.running_nodes}</div></div>
                <div className="sys-metric-card"><div className="label">Waiting</div><div className="value">{metrics.waiting_nodes}</div></div>
                <div className="sys-metric-card"><div className="label">CPU</div><div className="value">{metrics.cpu_percent}%</div></div>
                <div className="sys-metric-card"><div className="label">Memory</div><div className="value">{metrics.memory_mb} MB</div></div>
                <div className="sys-metric-card"><div className="label">Avg Latency</div><div className="value" style={{ color: 'var(--ed-green)' }}>{metrics.avg_latency_ms}ms</div></div>
                <div className="sys-metric-card"><div className="label">Network</div><div className="value">{(metrics.network_kb / 1024).toFixed(1)} MB</div></div>
                <div className="sys-metric-card"><div className="label">Estimated Cost</div><div className="value">${metrics.estimated_cost_usd}</div></div>
                <div className="sys-metric-card"><div className="label">Actual Cost</div><div className="value" style={{ color: 'var(--ed-green)' }}>${metrics.actual_cost_usd}</div></div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Left: Node Inspector */}
        <div className="exec-inspector">
          {nodeDetail ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ed-text)' }}>{nodeDetail.label}</div>
                <span className={`exec-status ${nodeDetail.status}`}>{nodeDetail.status}</span>
              </div>
              <div className="exec-inspector-row"><span className="label">Type</span><span className="value">{nodeDetail.type}</span></div>
              <div className="exec-inspector-row"><span className="label">Duration</span><span className="value">{nodeDetail.duration_ms != null ? `${nodeDetail.duration_ms}ms` : '—'}</span></div>
              <div className="exec-inspector-row"><span className="label">Driver</span><span className="value">{nodeDetail.driver || '—'}</span></div>
              <div className="exec-inspector-row"><span className="label">Capability</span><span className="value">{nodeDetail.capability}</span></div>
              <div className="exec-inspector-row"><span className="label">Policy</span><span className="value">{nodeDetail.policy}</span></div>
              <div className="exec-inspector-row"><span className="label">Permission</span><span className="value">{nodeDetail.permission}</span></div>
              <div className="exec-inspector-row"><span className="label">Retry</span><span className="value">{nodeDetail.retry_count}</span></div>
              <div className="exec-inspector-row"><span className="label">Cost</span><span className="value">${nodeDetail.cost_usd}</span></div>

              {nodeDetail.input && Object.keys(nodeDetail.input).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ed-text-muted)', marginBottom: 4 }}>INPUT</div>
                  <pre className="drv-code-preview" style={{ fontSize: 10 }}>{JSON.stringify(nodeDetail.input, null, 2)}</pre>
                </div>
              )}
              {nodeDetail.output && Object.keys(nodeDetail.output).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ed-text-muted)', marginBottom: 4 }}>OUTPUT</div>
                  <pre className="drv-code-preview" style={{ fontSize: 10 }}>{JSON.stringify(nodeDetail.output, null, 2)}</pre>
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="dash-btn" onClick={() => execAction('retry')}><RotateCcw size={11} /> Retry Node</button>
                <button className="dash-btn"><Download size={11} /> Export Output</button>
                <button className="dash-btn"><Eye size={11} /> Open Artifact</button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--ed-text-muted)', fontSize: 12, padding: 30 }}>
              <Activity size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <div>Click a node in the graph to inspect</div>
            </div>
          )}
        </div>

        {/* Bottom Right: Live Event Stream */}
        <div className="exec-event-stream">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ed-text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
            Live Event Stream
          </div>
          {liveEvents.map((ev, i) => (
            <div key={i} className="exec-event-row">
              <div className={`exec-event-dot ${ev.color}`} />
              <span style={{ fontFamily: 'var(--ed-mono)', color: 'var(--ed-text-muted)', minWidth: 56 }}>{ev.time}</span>
              <span style={{ fontWeight: 600, color: 'var(--ed-text)', minWidth: 120 }}>{ev.type}</span>
              <span style={{ color: 'var(--ed-text-secondary)', flex: 1 }}>{ev.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Run Execution Wizard Modal ──────────────────────── */}
      {wizardOpen && (
        <div className="connect-modal-overlay" onClick={() => setWizardOpen(false)}>
          <div className="connect-modal" style={{ width: 540 }} onClick={e => e.stopPropagation()}>
            <div className="connect-modal-header">
              <h3>Run New Execution</h3>
              <button onClick={() => setWizardOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ed-text-muted)' }}><X size={16} /></button>
            </div>
            <div className="connect-modal-body">
              <div className="exec-wizard-field">
                <label>Execution Name</label>
                <input value={wizardForm.name} onChange={e => setWizardForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Monthly Financial Report" />
              </div>
              <div className="exec-wizard-field">
                <label>Description</label>
                <input value={wizardForm.description} onChange={e => setWizardForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the execution" />
              </div>
              <div className="exec-wizard-field">
                <label>Need (Business Intent)</label>
                <textarea value={wizardForm.need} onChange={e => setWizardForm(f => ({ ...f, need: e.target.value }))} placeholder={"Generate monthly financial report\nApprove invoices\nSend to CFO"} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="exec-wizard-field">
                  <label>Priority</label>
                  <select value={wizardForm.priority} onChange={e => setWizardForm(f => ({ ...f, priority: e.target.value }))}>
                    <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                  </select>
                </div>
                <div className="exec-wizard-field">
                  <label>Run Policy</label>
                  <select value={wizardForm.policy} onChange={e => setWizardForm(f => ({ ...f, policy: e.target.value }))}>
                    <option>Standard</option><option>SOX Compliant</option><option>GDPR Required</option><option>SOX + Approval Required</option>
                  </select>
                </div>
                <div className="exec-wizard-field">
                  <label>Environment</label>
                  <select value={wizardForm.environment} onChange={e => setWizardForm(f => ({ ...f, environment: e.target.value }))}>
                    <option>Production</option><option>Staging</option><option>Development</option>
                  </select>
                </div>
              </div>

              <div style={{ background: 'var(--ed-glass)', border: '1px solid var(--ed-card-border)', borderRadius: 'var(--ed-radius-sm)', padding: 12, marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ed-text-muted)', marginBottom: 6 }}>EXECUTION PIPELINE</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ed-text)' }}>
                  <span style={{ color: '#a371f7' }}>Need</span> → <span style={{ color: '#a371f7' }}>Planner</span> → <span style={{ color: '#8b5cf6' }}>Compiler</span> → <span style={{ color: '#58a6ff' }}>IR</span> → <span style={{ color: '#58a6ff' }}>Optimizer</span> → <span style={{ color: '#7c3aed' }}>Validator</span> → <span style={{ color: 'var(--ed-green)' }}>Execution</span>
                </div>
              </div>
            </div>
            <div className="connect-modal-footer">
              <button className="dash-btn" onClick={() => setWizardOpen(false)}>Cancel</button>
              <button className="dash-btn dash-btn-primary" onClick={handleCreateExecution} disabled={!wizardForm.name}>
                <Play size={13} /> Start Execution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseExecution;
