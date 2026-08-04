import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Plus, MessageSquare, Bell, Search, ArrowUpRight,
  Check, X, Sparkles, Activity, Server, Cpu, Zap, DollarSign,
  Clock, CheckSquare, ShieldAlert, AlertTriangle, ChevronRight
} from 'lucide-react';
import CompanyGraphCanvas from './CompanyGraphCanvas';
import GlobalSearchModal from './GlobalSearchModal';
import './Enterprise.css';

const API = 'http://127.0.0.1:8420/enterprise';

const EnterpriseDashboard = ({ data: initialData, onNavigateTab }) => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    fetch(`${API}/dashboard`)
      .then(r => r.json())
      .then(d => { setDashboard(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ⌘K Global Search shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const nav = (tab) => onNavigateTab && onNavigateTab(tab);
  const s = dashboard?.summary || {};
  const cards = dashboard?.cards || {};
  const execs = dashboard?.active_executions || [];
  const approvals = dashboard?.approvals || [];
  const drivers = dashboard?.driver_health || [];
  const recs = dashboard?.ai_recommendations || [];
  const timeline = dashboard?.timeline || [];
  const feed = dashboard?.activity_feed || [];

  const notifications = [
    { type: 'approval', text: 'Invoice $42,000 awaiting CFO approval', icon: <CheckSquare size={14} />, color: '#d29922' },
    { type: 'warning', text: 'Oracle Driver: High queue depth warning', icon: <AlertTriangle size={14} />, color: '#d29922' },
    { type: 'policy', text: 'SOX compliance rule conflict detected', icon: <ShieldAlert size={14} />, color: '#f85149' },
    { type: 'savings', text: 'New automation opportunity: $28k/mo savings', icon: <DollarSign size={14} />, color: '#3fb950' }
  ];

  return (
    <div>
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} onNavigateTab={nav} />

      {/* ── Dashboard Header ──────────────────────────────── */}
      <div className="dash-topbar">
        <div className="dash-topbar-left">
          <h2>Enterprise Dashboard</h2>
          <div className="dash-live-badge">
            <div className="dash-live-dot" />
            LIVE
          </div>
          <span style={{ fontSize: 11, color: 'var(--ed-text-muted)' }}>
            {s.company_name || 'Acme Manufacturing'} · {s.connected_systems_count || 13} Connected Systems · Last Sync: {s.last_sync || '2 sec ago'}
          </span>
        </div>
        <div className="dash-topbar-right">
          <button className="dash-search-btn" onClick={() => setSearchOpen(true)}>
            <Search size={13} /> Search Company...
            <kbd>⌘K</kbd>
          </button>
          <button className="dash-btn" onClick={fetchDashboard} title="Refresh Dashboard">
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="dash-btn dash-btn-primary" onClick={() => nav('execution')} title="New Workflow">
            <Plus size={13} /> New Workflow
          </button>
          <button className="dash-btn" title="Ask AI">
            <MessageSquare size={13} /> Ask AI
          </button>
          <div style={{ position: 'relative' }}>
            <button className="dash-btn" onClick={() => setNotifOpen(!notifOpen)} style={{ position: 'relative' }}>
              <Bell size={13} />
              <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: '50%', background: '#f85149' }} />
            </button>
            {notifOpen && (
              <div className="notif-dropdown">
                <div style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', color: 'var(--ed-text)', borderBottom: '1px solid var(--ed-border)', marginBottom: 4 }}>
                  Notifications
                </div>
                {notifications.map((n, i) => (
                  <div key={i} className="notif-item">
                    <span style={{ color: n.color }}>{n.icon}</span>
                    <span style={{ fontSize: 12, color: 'var(--ed-text)' }}>{n.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Company Status Banner ─────────────────────────── */}
      <div className="status-banner">
        <div className="status-health-block">
          <div className={`status-health-pct ${s.company_health_percent >= 90 ? 'healthy' : s.company_health_percent >= 70 ? 'warning' : 'critical'}`}>
            {s.company_health_percent || 97}%
          </div>
          <div className="status-health-label">Company Health</div>
        </div>
        <div className="status-breakdown">
          <div className="status-segment">
            <div className="status-segment-title">Systems</div>
            <div className="status-segment-items">
              <div className="status-item"><span className="num" style={{ color: 'var(--ed-green)' }}>{s.systems?.healthy ?? 11}</span><span className="lbl">Healthy</span></div>
              <div className="status-item"><span className="num" style={{ color: 'var(--ed-yellow)' }}>{s.systems?.warning ?? 2}</span><span className="lbl">Warning</span></div>
              <div className="status-item"><span className="num" style={{ color: 'var(--ed-red)' }}>{s.systems?.offline ?? 0}</span><span className="lbl">Offline</span></div>
            </div>
          </div>
          <div className="status-segment">
            <div className="status-segment-title">Executions</div>
            <div className="status-segment-items">
              <div className="status-item"><span className="num" style={{ color: 'var(--ed-green)' }}>{s.executions?.running ?? 18}</span><span className="lbl">Running</span></div>
              <div className="status-item"><span className="num" style={{ color: 'var(--ed-yellow)' }}>{s.executions?.queued ?? 5}</span><span className="lbl">Queued</span></div>
              <div className="status-item"><span className="num" style={{ color: 'var(--ed-red)' }}>{s.executions?.failed ?? 1}</span><span className="lbl">Failed</span></div>
            </div>
          </div>
          <div className="status-segment">
            <div className="status-segment-title">Approvals</div>
            <div className="status-segment-items">
              <div className="status-item"><span className="num" style={{ color: 'var(--ed-yellow)' }}>{s.approvals?.pending ?? 3}</span><span className="lbl">Pending</span></div>
            </div>
          </div>
          <div className="status-segment">
            <div className="status-segment-title">Estimated Savings</div>
            <div className="status-segment-items">
              <div className="status-item"><span className="num" style={{ color: 'var(--ed-green)' }}>{s.estimated_savings || '$128,000'}</span><span className="lbl">/ month</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card" onClick={() => nav('systems')}>
          <div className="kpi-value">{cards.card_1_systems?.count ?? 13}</div>
          <div className="kpi-label">Connected Systems</div>
          <div className="kpi-sub">{(cards.card_1_systems?.preview || ['SAP','Oracle','Salesforce']).slice(0, 3).join(', ')}...</div>
        </div>
        <div className="kpi-card" onClick={() => nav('drivers')}>
          <div className="kpi-value">{cards.card_2_drivers?.count ?? 41}</div>
          <div className="kpi-label">Drivers</div>
          <div className="kpi-sub" style={{ color: 'var(--ed-green)' }}>{cards.card_2_drivers?.healthy_count ?? 39} Healthy</div>
        </div>
        <div className="kpi-card" onClick={() => nav('capabilities')}>
          <div className="kpi-value">{cards.card_3_capabilities?.count ?? 856}</div>
          <div className="kpi-label">Capabilities Available</div>
        </div>
        <div className="kpi-card" onClick={() => nav('execution')} style={{ position: 'relative' }}>
          <div className="kpi-value">{(cards.card_4_today_executions?.count ?? 3941).toLocaleString()}</div>
          <div className="kpi-label">Today's Executions</div>
          {/* Mini sparkline */}
          <svg className="kpi-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
            <polyline
              points={
                (cards.card_4_today_executions?.sparkline || [420, 680, 910, 1150, 1400, 1890, 2400, 3100, 3941])
                  .map((v, i, arr) => `${(i / (arr.length - 1)) * 100},${30 - (v / Math.max(...arr)) * 28}`)
                  .join(' ')
              }
              fill="none"
              stroke="#3fb950"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div className="kpi-card" onClick={() => nav('analytics')}>
          <div className="kpi-value" style={{ color: 'var(--ed-green)' }}>{cards.card_5_money_saved?.amount ?? '$84,200'}</div>
          <div className="kpi-label">Money Saved Today</div>
        </div>
        <div className="kpi-card" onClick={() => nav('analytics')}>
          <div className="kpi-value">{(cards.card_6_tasks_eliminated?.count ?? 5118).toLocaleString()}</div>
          <div className="kpi-label">Tasks Eliminated</div>
        </div>
      </div>

      {/* ── Main Split: Company Graph + Active Execution ── */}
      <div className="dash-main-grid">
        <div className="widget-card" style={{ minHeight: 260 }}>
          <div className="widget-header">
            <h3>Company Digital Twin Graph</h3>
            <button className="view-all" onClick={() => nav('ontology')}>
              Open Full Graph <ArrowUpRight size={12} />
            </button>
          </div>
          <CompanyGraphCanvas
            onNodeClick={(nodeId) => nav('ontology')}
            graphData={dashboard?.graph}
          />
        </div>

        <div className="widget-card">
          <div className="widget-header">
            <h3>Active Executions</h3>
            <button className="view-all" onClick={() => nav('execution')}>
              View All <ArrowUpRight size={12} />
            </button>
          </div>
          {execs.map(ex => (
            <div key={ex.id} className="exec-item" onClick={() => nav('execution')}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ed-text)' }}>{ex.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginTop: 2 }}>{ex.target_driver}</div>
                <div className="exec-progress-bar" style={{ width: '100%' }}>
                  <div className="exec-progress-fill" style={{
                    width: `${ex.progress}%`,
                    background: ex.status === 'Waiting' ? 'var(--ed-yellow)' : 'var(--ed-green)'
                  }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 50 }}>
                <div style={{
                  fontSize: 16, fontWeight: 700,
                  color: ex.status === 'Waiting' ? 'var(--ed-yellow)' : 'var(--ed-green)'
                }}>
                  {ex.progress > 0 ? `${ex.progress}%` : '—'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ed-text-muted)' }}>{ex.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Second Row: Approvals + Driver Health ─────────── */}
      <div className="dash-bottom-grid">
        <div className="widget-card">
          <div className="widget-header">
            <h3>Pending Approvals</h3>
            <button className="view-all" onClick={() => nav('approvals')}>
              View Queue <ArrowUpRight size={12} />
            </button>
          </div>
          {approvals.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--ed-text-muted)', fontSize: 12 }}>
              <CheckSquare size={24} style={{ opacity: 0.3, marginBottom: 6 }} /><br />
              Approval queue clean
            </div>
          ) : (
            approvals.map(appr => (
              <div key={appr.id} className="approval-item">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ed-text)' }}>{appr.title}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ed-green)', marginTop: 2 }}>{appr.amount}</div>
                  <div style={{ fontSize: 10, color: 'var(--ed-text-muted)' }}>{appr.system} · {appr.required_role}</div>
                </div>
                <div className="approval-actions">
                  <button className="btn-approve" onClick={() => {
                    const pk = prompt('Enter Passkey:');
                    if (pk !== null) {
                      fetch(`${API}/approvals/${appr.id}/approve`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ passkey: pk })
                      }).then(() => fetchDashboard());
                    }
                  }}>
                    <Check size={12} /> Approve
                  </button>
                  <button className="btn-reject" onClick={() => {
                    if (confirm('Reject this execution?')) {
                      fetch(`${API}/approvals/${appr.id}/reject`, { method: 'POST' })
                        .then(() => fetchDashboard());
                    }
                  }}>
                    <X size={12} /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="widget-card">
          <div className="widget-header">
            <h3>Driver Health</h3>
            <button className="view-all" onClick={() => nav('drivers')}>
              All Drivers <ArrowUpRight size={12} />
            </button>
          </div>
          {drivers.slice(0, 5).map(drv => {
            const healthClass = drv.status === 'Healthy' ? 'healthy' : drv.status === 'Warning' ? 'warning' : 'offline';
            return (
              <div key={drv.id} className="driver-item" onClick={() => nav('systems')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className={`driver-dot ${healthClass}`} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ed-text)' }}>{drv.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--ed-text-muted)' }}>{drv.vendor} · {drv.version}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: healthClass === 'healthy' ? 'var(--ed-green)' : healthClass === 'warning' ? 'var(--ed-yellow)' : 'var(--ed-red)' }}>
                    {drv.status}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ed-text-muted)', fontFamily: 'var(--ed-mono)' }}>{drv.latency_ms}ms</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Third Row: AI Recommendations + Timeline ─────── */}
      <div className="dash-bottom-grid">
        <div className="widget-card">
          <div className="widget-header">
            <h3><Sparkles size={14} style={{ marginRight: 4, color: 'var(--ed-green)' }} />AI Recommendations</h3>
          </div>
          {recs.map(rec => (
            <div key={rec.id} className="rec-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ed-text)' }}>{rec.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', marginTop: 2 }}>{rec.subtitle}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ed-green)', marginTop: 4 }}>
                  {rec.potential_savings}
                </div>
              </div>
              <button className="rec-action-btn" onClick={() => {
                if (rec.action === 'generate_workflow') nav('execution');
                else if (rec.action === 'update_driver') nav('drivers');
                else if (rec.action === 'fix_policy') nav('policies');
              }}>
                {rec.action === 'generate_workflow' ? 'Generate Workflow' :
                 rec.action === 'update_driver' ? 'Update Driver' :
                 'Fix Policy'}
              </button>
            </div>
          ))}
        </div>

        <div className="widget-card">
          <div className="widget-header">
            <h3>Enterprise Timeline</h3>
            <button className="view-all" onClick={() => nav('audit')}>
              Full Audit <ArrowUpRight size={12} />
            </button>
          </div>
          {timeline.map((evt, i) => (
            <div key={i} className="timeline-item">
              <div className="timeline-time">{evt.time}</div>
              <div className="timeline-dot-col">
                <div className="timeline-dot" style={{
                  background: evt.status === 'Completed' ? 'var(--ed-green)' :
                              evt.status === 'Granted' ? 'var(--ed-blue)' :
                              evt.status === 'Healthy' ? 'var(--ed-green)' : 'var(--ed-yellow)'
                }} />
              </div>
              <div>
                <div className="timeline-event">{evt.event}</div>
                <div style={{ fontSize: 10, color: 'var(--ed-text-muted)', textTransform: 'uppercase' }}>{evt.type}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Activity Feed (Full Width) ────────────────────── */}
      <div className="widget-card dash-full-width" style={{ marginBottom: 20 }}>
        <div className="widget-header">
          <h3>Activity Feed</h3>
          <button className="view-all" onClick={() => nav('audit')}>
            Full Log <ArrowUpRight size={12} />
          </button>
        </div>
        {feed.map(item => (
          <div key={item.id} className="feed-row">
            <div className="feed-avatar">
              {item.actor.charAt(0)}
            </div>
            <div className="feed-text">
              <strong>{item.actor}</strong> {item.action} — {item.detail}
            </div>
            <div className="feed-time">{item.timestamp}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EnterpriseDashboard;
