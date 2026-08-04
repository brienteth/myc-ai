import React, { useState, useEffect } from 'react';
import { Target, Zap, TrendingUp, Cpu, Server, Activity, ArrowRight, DollarSign, CloudLightning, FileText, CheckCircle, Clock } from 'lucide-react';
import './Enterprise.css';

const EnterpriseAnalytics = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [score, setScore] = useState(null);
  const [roi, setRoi] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [intelligence, setIntelligence] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [live, setLive] = useState(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8420/enterprise/analytics/overview').then(r=>r.json()).then(d=>setOverview(d.overview)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/analytics/score').then(r=>r.json()).then(d=>setScore(d.score)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/analytics/roi').then(r=>r.json()).then(d=>setRoi(d.roi)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/analytics/workflows').then(r=>r.json()).then(d=>setWorkflows(d.workflows)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/analytics/departments').then(r=>r.json()).then(d=>setDepartments(d.departments)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/analytics/intelligence').then(r=>r.json()).then(d=>setIntelligence(d.intelligence)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/analytics/energy-cost').then(r=>r.json()).then(d=>setEnergy(d.energy_cost)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/analytics/live').then(r=>r.json()).then(d=>setLive(d.live)).catch(e=>console.error(e));
    
    // Simulate live data updates
    const intv = setInterval(() => {
      fetch('http://127.0.0.1:8420/enterprise/analytics/live').then(r=>r.json()).then(d=>setLive(d.live)).catch(e=>console.error(e));
    }, 2000);
    return () => clearInterval(intv);
  }, []);

  return (
    <div className="analytics-container">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--ed-serif)', fontSize: 24, margin: '0 0 6px 0', color: 'var(--ed-text)' }}>Execution Intelligence Center</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ed-text-muted)' }}>AI-Native performance, ROI, bottlenecks and forecasting.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="exec-btn secondary"><FileText size={14} /> Weekly Report</button>
          <button className="exec-btn primary"><TrendingUp size={14} /> Board Presentation</button>
        </div>
      </div>

      {/* Top KPI Grid */}
      {overview && (
        <div className="analytics-kpi-grid">
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-title">Monthly ROI</div>
            <div className="analytics-kpi-value">{overview.monthly_roi.value}</div>
            <div className={`analytics-kpi-trend ${overview.monthly_roi.trend}`}>↑ {overview.monthly_roi.pct} vs last month</div>
          </div>
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-title">Hours Saved</div>
            <div className="analytics-kpi-value">{overview.hours_saved.value}</div>
            <div className={`analytics-kpi-trend ${overview.hours_saved.trend}`}>↑ {overview.hours_saved.pct} vs last month</div>
          </div>
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-title">Automated Tasks</div>
            <div className="analytics-kpi-value">{overview.automated_tasks.value}</div>
            <div className={`analytics-kpi-trend ${overview.automated_tasks.trend}`}>↑ {overview.automated_tasks.pct} vs last month</div>
          </div>
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-title">Average Runtime</div>
            <div className="analytics-kpi-value">{overview.avg_runtime.value}</div>
            <div className={`analytics-kpi-trend ${overview.avg_runtime.trend}`}>↓ {overview.avg_runtime.pct} vs last month</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="analytics-tabs">
        <div className={`analytics-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</div>
        <div className={`analytics-tab ${activeTab === 'intelligence' ? 'active' : ''}`} onClick={() => setActiveTab('intelligence')}>AI Intelligence</div>
        <div className={`analytics-tab ${activeTab === 'roi' ? 'active' : ''}`} onClick={() => setActiveTab('roi')}>ROI & Departments</div>
        <div className={`analytics-tab ${activeTab === 'energy' ? 'active' : ''}`} onClick={() => setActiveTab('energy')}>Energy & Costs</div>
      </div>

      {/* Tab Content: Overview */}
      {activeTab === 'overview' && (
        <div className="analytics-two-col">
          {/* Execution Score */}
          <div className="analytics-panel">
            <div className="analytics-panel-title"><Target size={18} color="var(--ed-accent)"/> Company Execution Score</div>
            {score && (
              <>
                <div className="score-gauge-container">
                  <div className="score-gauge" style={{background: `conic-gradient(var(--ed-accent) ${score.overall}%, var(--ed-border) 0)`}}>
                    <div className="score-value">{score.overall}</div>
                  </div>
                </div>
                <div className="score-metrics">
                  {score.breakdown.map((b, i) => (
                    <div key={i} className="score-metric-row">
                      <span className="lbl">{b.metric}</span>
                      <span className="val">{b.score}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Workflow Insights */}
          <div className="analytics-panel">
            <div className="analytics-panel-title"><Activity size={18} color="var(--ed-accent)"/> Top Automated Workflows</div>
            {workflows.map((wf, i) => (
              <div key={i} className="analytics-data-row">
                <div className="analytics-data-left">
                  <div className="analytics-data-name">{wf.name}</div>
                  <div className="analytics-data-sub">Runs: {wf.runs} • Success: {wf.success}</div>
                </div>
                <div className="analytics-data-right">
                  <div>{wf.time_saved} saved</div>
                  <div style={{fontSize: 11, color:'var(--ed-text-muted)', marginTop:2}}>{wf.money_saved}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Intelligence */}
      {activeTab === 'intelligence' && intelligence && (
        <div className="analytics-two-col">
          <div className="analytics-panel">
            <div className="analytics-panel-title"><Zap size={18} color="#a371f7"/> AI Recommendations</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom: 24}}>
              <div>
                <div style={{fontSize:11, color:'var(--ed-text-muted)', fontWeight:600}}>PLANS GENERATED</div>
                <div style={{fontSize:20, fontWeight:700}}>{intelligence.planner_stats.generated}</div>
              </div>
              <div>
                <div style={{fontSize:11, color:'var(--ed-text-muted)', fontWeight:600}}>ACCEPTED</div>
                <div style={{fontSize:20, fontWeight:700, color:'var(--ed-green)'}}>{intelligence.planner_stats.accepted}</div>
              </div>
            </div>
            
            <div style={{fontSize:12, fontWeight:700, color:'var(--ed-text-muted)', marginBottom:12}}>OPTIMIZATION SUGGESTIONS</div>
            {intelligence.optimizations.map((opt, i) => (
              <div key={i} className="ai-recommendation-card">
                <Zap size={14} className="ai-recommendation-icon" />
                <div>
                  <div className="ai-recommendation-title">{opt.action}</div>
                  <div className="ai-recommendation-desc">{opt.target}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="analytics-panel">
            <div className="analytics-panel-title"><Clock size={18} color="var(--ed-accent)"/> Bottleneck Analysis</div>
            <div style={{fontSize:12, color:'var(--ed-text-muted)', marginBottom:16}}>Average runtime breakdown across Execution Graph.</div>
            {intelligence.bottlenecks.map((bn, i) => (
              <div key={i} className="analytics-data-row" style={{background: bn.is_bottleneck ? 'rgba(248, 81, 73, 0.05)' : 'transparent', padding: bn.is_bottleneck ? '12px' : '12px 0'}}>
                <div className="analytics-data-left">
                  <div className="analytics-data-name" style={{color: bn.is_bottleneck ? 'var(--ed-red)' : 'var(--ed-text)'}}>{bn.node}</div>
                </div>
                <div className="analytics-data-right" style={{color: bn.is_bottleneck ? 'var(--ed-red)' : 'var(--ed-accent)'}}>
                  {bn.time}
                  {bn.is_bottleneck && <div style={{fontSize:10, color:'var(--ed-red)', fontWeight:800, marginTop:4}}>BOTTLENECK FOUND</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: ROI & Departments */}
      {activeTab === 'roi' && roi && departments && (
        <div className="analytics-two-col">
          <div className="analytics-panel">
            <div className="analytics-panel-title"><DollarSign size={18} color="var(--ed-green)"/> Value Created (This Month)</div>
            <div style={{fontSize: 42, fontWeight:800, fontFamily: 'var(--ed-mono)', color: 'var(--ed-green)', marginBottom: 24}}>
              {roi.this_month.total_enterprise_value}
            </div>
            <div className="analytics-data-row">
              <div className="analytics-data-left"><div className="analytics-data-name">Estimated Salary Savings</div></div>
              <div className="analytics-data-right">{roi.this_month.estimated_salary_savings}</div>
            </div>
            <div className="analytics-data-row">
              <div className="analytics-data-left"><div className="analytics-data-name">Software Licenses Reduced</div></div>
              <div className="analytics-data-right">{roi.this_month.software_licenses_reduced}</div>
            </div>
            <div className="analytics-data-row">
              <div className="analytics-data-left"><div className="analytics-data-name">Manual Hours Eliminated</div></div>
              <div className="analytics-data-right">{roi.this_month.manual_hours_eliminated} hrs</div>
            </div>
          </div>

          <div className="analytics-panel">
            <div className="analytics-panel-title"><Server size={18} color="var(--ed-accent)"/> Department Automation</div>
            {departments.map((dep, i) => (
              <div key={i} style={{marginBottom: 16}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:600, marginBottom:6}}>
                  <span>{dep.dept}</span>
                  <span style={{color:'var(--ed-text-muted)'}}>{dep.automated}% Automated</span>
                </div>
                <div className="analytics-progress-wrap">
                  <div className="analytics-progress-fill" style={{width: `${dep.automated}%`}}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Energy */}
      {activeTab === 'energy' && energy && (
        <div className="analytics-two-col">
          <div className="analytics-panel">
            <div className="analytics-panel-title"><CloudLightning size={18} color="var(--ed-yellow)"/> Energy & Compute</div>
            <div className="analytics-data-row">
              <div className="analytics-data-left">
                <div className="analytics-data-name">Desktop GPU (Local)</div>
                <div className="analytics-data-sub">Local inferencing on this machine</div>
              </div>
              <div className="analytics-data-right" style={{color:'var(--ed-text)'}}>{energy.energy.desktop_gpu}</div>
            </div>
            <div className="analytics-data-row">
              <div className="analytics-data-left">
                <div className="analytics-data-name">Home Cluster</div>
                <div className="analytics-data-sub">Remote internal network</div>
              </div>
              <div className="analytics-data-right" style={{color:'var(--ed-text)'}}>{energy.energy.home_cluster}</div>
            </div>
            <div className="analytics-data-row">
              <div className="analytics-data-left">
                <div className="analytics-data-name">Cloud APIs</div>
                <div className="analytics-data-sub">OpenAI, Anthropic, GCP</div>
              </div>
              <div className="analytics-data-right" style={{color:'var(--ed-text)'}}>{energy.energy.cloud}</div>
            </div>
            <div style={{marginTop:24, padding:16, background:'rgba(46, 160, 67, 0.1)', borderRadius:8, border:'1px solid rgba(46, 160, 67, 0.2)', color:'var(--ed-green)'}}>
              <div style={{fontSize:11, fontWeight:700, marginBottom:4}}>ENERGY SAVED (VS CLOUD-ONLY)</div>
              <div style={{fontSize:24, fontWeight:800}}>{energy.energy.energy_saved}</div>
            </div>
          </div>

          <div className="analytics-panel">
            <div className="analytics-panel-title"><DollarSign size={18} color="var(--ed-accent)"/> Cost Distribution</div>
            <div className="analytics-data-row">
              <div className="analytics-data-left"><div className="analytics-data-name">Local GPU Energy</div></div>
              <div className="analytics-data-right">{energy.cost.gpu}</div>
            </div>
            <div className="analytics-data-row">
              <div className="analytics-data-left"><div className="analytics-data-name">LLM APIs</div></div>
              <div className="analytics-data-right">{energy.cost.llm}</div>
            </div>
            <div className="analytics-data-row">
              <div className="analytics-data-left"><div className="analytics-data-name">SaaS Driver APIs</div></div>
              <div className="analytics-data-right">{energy.cost.drivers}</div>
            </div>
            <div className="analytics-data-row">
              <div className="analytics-data-left"><div className="analytics-data-name">Cloud Storage</div></div>
              <div className="analytics-data-right">{energy.cost.storage}</div>
            </div>
          </div>
        </div>
      )}

      {/* Live Dashboard Strip */}
      {live && (
        <div className="analytics-live-strip">
          <div className="live-metric">
            <div className="live-metric-lbl">Status</div>
            <div className="live-metric-val"><div className="live-indicator"></div> LIVE</div>
          </div>
          <div className="live-metric">
            <div className="live-metric-lbl">Active Workflows</div>
            <div className="live-metric-val" style={{color:'var(--ed-text)'}}>{live.workflows_running}</div>
          </div>
          <div className="live-metric">
            <div className="live-metric-lbl">Active Drivers</div>
            <div className="live-metric-val" style={{color:'var(--ed-text)'}}>{live.drivers_active}</div>
          </div>
          <div className="live-metric">
            <div className="live-metric-lbl">Events / Sec</div>
            <div className="live-metric-val" style={{color:'var(--ed-text)'}}>{live.events_per_sec}</div>
          </div>
          <div style={{flex: 1}}></div>
          <div className="live-metric" style={{textAlign:'right'}}>
            <div className="live-metric-lbl">CPU / GPU</div>
            <div className="live-metric-val" style={{color:'var(--ed-text-muted)'}}>
              <Cpu size={14}/> {live.cpu} <span style={{margin:'0 6px'}}>|</span> {live.gpu}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EnterpriseAnalytics;
