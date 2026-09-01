import React, { useState, useEffect } from 'react';
import { 
  Brain, Search, Plus, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, 
  HelpCircle, Eye, Network, BookOpen, Layers, Milestone, Info, X, Check, Edit3, ArrowRight, Sparkles, Database, FileText
} from 'lucide-react';
import './SecondBrain.css';

// ── Initial Mock Data for Second Brain ──────────────────────────────────
const INITIAL_MEMORIES = [
  {
    id: 'mem-1',
    type: 'Decision', // Decision, Experience, Memory, Entity
    title: 'PostgreSQL selected as primary database',
    content: 'PostgreSQL was chosen for local-first enterprise data mapping over Supabase to reduce outbound cloud API cost and enforce sub-10ms query speeds.',
    confidence: 94,
    status: 'Active',
    project: 'Myca OS',
    created: '2026-08-16',
    source: 'Execution Studio (Workflow #8A91)',
    why: 'Explicit developer confirmation, local execution verification metrics, and repeated usage across 4 active micro-services.',
    related: ['Myca OS', 'Database Architecture', 'Memory Controller'],
    history: [
      { date: 'Aug 16, 2026', event: 'Created by Planner Intent Engine' },
      { date: 'Aug 17, 2026', event: 'Referenced by 3 execution DAG runs' }
    ]
  },
  {
    id: 'mem-2',
    type: 'Experience',
    title: 'Supabase latent response rates during load tests',
    content: 'During concurrency spikes, Supabase REST queries exceeded 180ms latency. Shifting query index lookup to local SQLite cache restored speeds to 2.4ms.',
    confidence: 76,
    status: 'Confirmed',
    project: 'Opacus',
    created: '2026-08-15',
    source: 'Colony Mesh Telemetry (Node #402)',
    why: 'System performance log parsing and telemetry anomaly analysis.',
    related: ['Opacus', 'Supabase', 'SQLite', 'Latency Metrics'],
    history: [
      { date: 'Aug 15, 2026', event: 'Analyzed from telemetry outputs' }
    ]
  },
  {
    id: 'mem-3',
    type: 'Decision',
    title: 'QUIC protocol chosen for Colony Mesh transport',
    content: 'QUIC protocol chosen over WebSockets for local-first p2p communication to support seamless connection recovery when client Wi-Fi disconnects.',
    confidence: 96,
    status: 'Active',
    project: 'Myca OS',
    created: '2026-08-14',
    source: 'Architecture discussion (mDNS handshake logs)',
    why: 'P2P reconnect success metrics and package recovery E2E tests.',
    related: ['Myca OS', 'Colony Mesh', 'QUIC', 'Network Recovery'],
    history: [
      { date: 'Aug 14, 2026', event: 'Discovered during local device pairing tests' }
    ]
  },
  {
    id: 'mem-4',
    type: 'Memory',
    title: 'Opacus SaaS pricing tiers locked',
    content: 'Opacus sovereign pricing structure set to $28/mo for developer tier, $280/mo for teams, and custom multi-region deployment licenses.',
    confidence: 88,
    status: 'Active',
    project: 'Opacus',
    created: '2026-08-12',
    source: 'Outbound Gmail response (sales deck prep)',
    why: 'Mentioned 3 times in outbound communications and confirmed by team lead.',
    related: ['Opacus', 'Pricing', 'Salesforce Integration'],
    history: [
      { date: 'Aug 12, 2026', event: 'Extracted from Gmail draft workflow' }
    ]
  },
  {
    id: 'mem-5',
    type: 'Decision',
    title: 'SQLite local cache persistence rule',
    content: 'Store offline UI state changes and local indexing matrices in SQLite, sync periodically via Colony QUIC pipeline once network re-establishes.',
    confidence: 91,
    status: 'Active',
    project: 'Myca OS',
    created: '2026-08-11',
    source: 'File Operations (Local DB check)',
    why: 'Implicit caching strategy parsed from verifier checks.',
    related: ['Myca OS', 'SQLite', 'Offline Caching'],
    history: [
      { date: 'Aug 11, 2026', event: 'Created by local verifier runtime' }
    ]
  }
];

const INITIAL_INBOX = [
  {
    id: 'inbox-1',
    type: 'Decision',
    title: 'Migrate local vector index to Qdrant',
    detail: 'Candidate suggests migrating local Chroma DB vectors to Qdrant for faster local-first hybrid keyword searches.',
    source: 'Conversation with developer — Today 9:44 PM',
    confidence: 82,
    context: '"We might need to shift to Qdrant next week because Chroma is having memory leaks on large indexing threads."'
  },
  {
    id: 'inbox-2',
    type: 'Experience',
    title: 'Ollama Qwen-3B latency increase in multi-device routing',
    detail: 'Observation shows local inference engine experienced 45ms time-to-first-token degradation during simultaneous mobile scans.',
    source: 'Telemetry scan — 1 hour ago',
    confidence: 64,
    context: 'Performance log: TTFT spiked from 12ms to 57ms on device m_ff913c4'
  }
];

const INITIAL_CONFLICTS = [
  {
    id: 'conflict-1',
    title: 'Database selection mismatch for Myca OS core',
    project: 'Myca OS',
    decisionA: {
      id: 'A',
      title: 'Use PostgreSQL as primary DB',
      date: 'Aug 10, 2026',
      confidence: 91,
      source: 'Architecture meeting notes'
    },
    decisionB: {
      id: 'B',
      title: 'Move core persistence entirely to SQLite',
      date: 'Aug 15, 2026',
      confidence: 87,
      source: 'Execution #192 verifier output'
    }
  }
];

const KNOWLEDGE_GRAPH_NODES = [
  { id: 'Myca OS', x: 250, y: 120, type: 'project', description: 'Primary OS layer core' },
  { id: 'Opacus', x: 450, y: 120, type: 'project', description: 'Enterprise digital twin system' },
  { id: 'PostgreSQL', x: 120, y: 220, type: 'entity', description: 'Primary relational backend' },
  { id: 'SQLite', x: 280, y: 240, type: 'entity', description: 'Local-first offline cache store' },
  { id: 'Colony Mesh', x: 380, y: 280, type: 'entity', description: 'QUIC-based P2P overlay' },
  { id: 'Execution Studio', x: 550, y: 220, type: 'entity', description: 'Workflow compilation registry' },
  { id: 'Memory Controller', x: 180, y: 320, type: 'entity', description: 'Second brain retrieval module' }
];

const KNOWLEDGE_GRAPH_EDGES = [
  { from: 'Myca OS', to: 'PostgreSQL', label: 'Primary DB' },
  { from: 'Myca OS', to: 'SQLite', label: 'Local Cache' },
  { from: 'Myca OS', to: 'Colony Mesh', label: 'P2P Overlay' },
  { from: 'Opacus', to: 'Colony Mesh', label: 'Telemetry Sync' },
  { from: 'Opacus', to: 'Execution Studio', label: 'Workflow Engine' },
  { from: 'SQLite', to: 'Memory Controller', label: 'Context Feed' },
  { from: 'PostgreSQL', to: 'Memory Controller', label: 'Active Memory' }
];

const SecondBrain = () => {
  const [activeTab, setActiveTab] = useState('overview'); // overview, memories, decisions, experiences, projects, entities, graph, inbox, conflicts
  const [memories, setMemories] = useState(INITIAL_MEMORIES);
  const [inbox, setInbox] = useState(INITIAL_INBOX);
  const [conflicts, setConflicts] = useState(INITIAL_CONFLICTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemory, setSelectedMemory] = useState(null);
  
  // Custom Memory Creator State (AI-native)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Decision');
  const [newContent, setNewContent] = useState('');
  const [newProject, setNewProject] = useState('Myca OS');
  const [newRelated, setNewRelated] = useState('');

  // Confidence UI formatter
  const getConfidenceUI = (score) => {
    if (score >= 90) return { label: 'Confirmed', class: 'c-high', dots: '●●●●●' };
    if (score >= 70) return { label: 'High confidence', class: 'c-medium-high', dots: '●●●●○' };
    if (score >= 50) return { label: 'Needs review', class: 'c-medium', dots: '●●●○○' };
    return { label: 'Uncertain', class: 'c-low', dots: '●●○○○' };
  };

  const handleAddMemory = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newMem = {
      id: `mem-${Date.now()}`,
      type: newType,
      title: newTitle.trim(),
      content: newContent.trim(),
      confidence: 100, // Explicit user memories always start at 100% confidence
      status: 'Active',
      project: newProject,
      created: new Date().toISOString().split('T')[0],
      source: 'User Input',
      why: 'Manually logged by user directly to the registry.',
      related: newRelated.split(',').map(r => r.trim()).filter(Boolean),
      history: [{ date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), event: 'Created by User' }]
    };

    setMemories([newMem, ...memories]);
    setNewTitle('');
    setNewContent('');
    setNewRelated('');
    setShowAddForm(false);
  };

  // Inbox operations
  const acceptInboxItem = (id) => {
    const item = inbox.find(x => x.id === id);
    if (!item) return;

    const newMem = {
      id: `mem-${Date.now()}`,
      type: item.type,
      title: item.title,
      content: item.detail,
      confidence: item.confidence,
      status: 'Active',
      project: 'Myca OS',
      created: new Date().toISOString().split('T')[0],
      source: item.source,
      why: `Extracted with ${item.confidence}% confidence from source context.`,
      related: ['Inbox Import'],
      history: [{ date: 'Today', event: 'Approved from Inbox Queue' }]
    };

    setMemories([newMem, ...memories]);
    setInbox(inbox.filter(x => x.id !== id));
  };

  const rejectInboxItem = (id) => {
    setInbox(inbox.filter(x => x.id !== id));
  };

  // Conflict resolution
  const resolveConflict = (conflictId, choice) => {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    if (choice === 'A' || choice === 'B') {
      const selectedDecision = choice === 'A' ? conflict.decisionA : conflict.decisionB;
      const newMem = {
        id: `mem-${Date.now()}`,
        type: 'Decision',
        title: selectedDecision.title,
        content: `Resolved conflict in favor of: ${selectedDecision.title}. Provenance: ${selectedDecision.source}`,
        confidence: 95,
        status: 'Active',
        project: conflict.project,
        created: new Date().toISOString().split('T')[0],
        source: `Conflict Resolution (Choice ${choice})`,
        why: 'Manually resolved by user.',
        related: [conflict.project],
        history: [{ date: 'Today', event: 'Conflict resolved by user choice' }]
      };
      setMemories([newMem, ...memories]);
    } else if (choice === 'both') {
      // Keep both in different contexts
      const newMem = {
        id: `mem-${Date.now()}`,
        type: 'Decision',
        title: `${conflict.decisionA.title} & ${conflict.decisionB.title}`,
        content: `Both databases maintained for Myca OS under separate contexts (e.g. Postgres for local-first syncing, SQLite for offline browser cache).`,
        confidence: 90,
        status: 'Active',
        project: conflict.project,
        created: new Date().toISOString().split('T')[0],
        source: 'Conflict Resolution (Context Split)',
        why: 'Both decisions validated for distinct scopes.',
        related: [conflict.project],
        history: [{ date: 'Today', event: 'Split scopes approved' }]
      };
      setMemories([newMem, ...memories]);
    }

    setConflicts(conflicts.filter(c => c.id !== conflictId));
  };

  // Filter memories list based on active tab and search query
  const filteredMemories = (memories || []).filter(m => {
    if (!m) return false;
    const typeLower = (m.type || '').toLowerCase();
    const matchesTab = 
      activeTab === 'memories' || 
      (activeTab === 'decisions' && typeLower === 'decision') ||
      (activeTab === 'experiences' && typeLower === 'experience') ||
      (activeTab === 'projects' && m.project) ||
      (activeTab === 'entities' && (typeLower === 'entity' || typeLower === 'memory'));
      
    const query = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !query || 
      (m.title || '').toLowerCase().includes(query) ||
      (m.content || '').toLowerCase().includes(query) ||
      (m.project || '').toLowerCase().includes(query) ||
      (m.source || '').toLowerCase().includes(query) ||
      (m.related || []).some(r => (r || '').toLowerCase().includes(query));

    return matchesTab && matchesSearch;
  });

  return (
    <div className="second-brain-app">
      {/* ── INTERNAL SIDEBAR NAVIGATION ── */}
      <div className="brain-sidebar">
        <div className="brain-sidebar-header">
          <Brain size={20} className="brain-icon-spin" />
          <span>Myca OS Brain</span>
        </div>
        <div className="brain-sidebar-menu">
          <div className="menu-group">WORKSPACE</div>
          <button className={`menu-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <Layers size={14} /> Overview
          </button>
          <button className={`menu-item ${activeTab === 'memories' ? 'active' : ''}`} onClick={() => setActiveTab('memories')}>
            <BookOpen size={14} /> Memories ({memories.length})
          </button>
          <button className={`menu-item ${activeTab === 'decisions' ? 'active' : ''}`} onClick={() => setActiveTab('decisions')}>
            <Milestone size={14} /> Decisions ({memories.filter(m => m.type === 'Decision').length})
          </button>
          <button className={`menu-item ${activeTab === 'experiences' ? 'active' : ''}`} onClick={() => setActiveTab('experiences')}>
            <Sparkles size={14} /> Experiences ({memories.filter(m => m.type === 'Experience').length})
          </button>

          <div className="menu-group" style={{ marginTop: 16 }}>STRUCTURE</div>
          <button className={`menu-item ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>
            <FileText size={14} /> Projects
          </button>
          <button className={`menu-item ${activeTab === 'entities' ? 'active' : ''}`} onClick={() => setActiveTab('entities')}>
            <Database size={14} /> Entities
          </button>
          <button className={`menu-item ${activeTab === 'graph' ? 'active' : ''}`} onClick={() => setActiveTab('graph')}>
            <Network size={14} /> Knowledge Graph
          </button>

          <div className="menu-group" style={{ marginTop: 16 }}>QUEUES</div>
          <button className={`menu-item ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')}>
            <Eye size={14} /> Inbox Queue {inbox.length > 0 && <span className="menu-badge amber">{inbox.length}</span>}
          </button>
          <button className={`menu-item ${activeTab === 'conflicts' ? 'active' : ''}`} onClick={() => setActiveTab('conflicts')}>
            <AlertTriangle size={14} /> Conflicts {conflicts.length > 0 && <span className="menu-badge red">{conflicts.length}</span>}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="brain-content-area">
        {/* Top search and metadata bar */}
        <div className="brain-topbar">
          <div className="search-box">
            <Search size={15} color="var(--f-stone)" />
            <input 
              type="text" 
              placeholder="Search your brain (semantic query: 'what database did we select last week?')..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="add-memory-btn" onClick={() => setShowAddForm(true)}>
            <Plus size={14} /> Record Manual Memory
          </button>
        </div>

        {/* ── Tab Content Renderer ── */}

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="tab-pane-fade">
            <div className="brain-hero-banner">
              <h2>🧠 Personal Knowledge Operating System</h2>
              <p>Myca automatically extracts structured memory, architectural decisions, and integration experiences from background workflows and telemetry.</p>
            </div>

            <div className="overview-stats-grid">
              <div className="stat-card" onClick={() => setActiveTab('memories')}>
                <span className="count">{memories.length}</span>
                <span className="label">Registered Memories</span>
              </div>
              <div className="stat-card" onClick={() => setActiveTab('decisions')}>
                <span className="count">{memories.filter(m => m.type === 'Decision').length}</span>
                <span className="label">Decisions Declared</span>
              </div>
              <div className="stat-card" onClick={() => setActiveTab('experiences')}>
                <span className="count">{memories.filter(m => m.type === 'Experience').length}</span>
                <span className="label">Observed Experiences</span>
              </div>
              <div className="stat-card" onClick={() => setActiveTab('graph')}>
                <span className="count">{KNOWLEDGE_GRAPH_NODES.length}</span>
                <span className="label">Graph Entities</span>
              </div>
            </div>

            <div className="split-widgets-grid">
              {/* Recently Learned Widget */}
              <div className="widget-box">
                <h3>Recently Learned Contexts</h3>
                <div className="learned-list">
                  {memories.slice(0, 3).map(m => (
                    <div key={m.id} className="learned-item" onClick={() => setSelectedMemory(m)}>
                      <div className="learned-badge">{m.type}</div>
                      <div className="learned-details">
                        <h4>{m.title}</h4>
                        <p>{m.content.substring(0, 70)}...</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Needs Attention Widget */}
              <div className="widget-box">
                <h3>Needs Attention / Inbox Queue</h3>
                <div className="attention-list">
                  {inbox.length > 0 ? (
                    inbox.map(item => (
                      <div key={item.id} className="attention-item" onClick={() => setActiveTab('inbox')}>
                        <AlertTriangle size={16} color="#d29922" />
                        <div className="attention-details">
                          <h4>Inbox proposal: {item.title}</h4>
                          <span>Requires durability verification · {item.confidence}% confidence</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="clean-state">
                      <CheckCircle2 size={32} color="#3fb950" />
                      <p>Hafıza kuyruğu temiz. Çelişkili bilgi tespit edilmedi.</p>
                    </div>
                  )}
                  {conflicts.map(c => (
                    <div key={c.id} className="attention-item conflict" onClick={() => setActiveTab('conflicts')}>
                      <ShieldCheck size={16} color="#f85149" />
                      <div className="attention-details">
                        <h4>Knowledge Conflict: {c.title}</h4>
                        <span>Disagreement between decisions. Click to resolve.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Preview of Knowledge Graph */}
            <div className="widget-box" style={{ marginTop: 24 }}>
              <div className="widget-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3>Interactive Knowledge Connections</h3>
                <button className="view-all-link" onClick={() => setActiveTab('graph')}>Explore full graph →</button>
              </div>
              <div className="mini-graph-canvas" onClick={() => setActiveTab('graph')}>
                <div className="graph-info-overlay">
                  <Network size={16} style={{ marginRight: 6 }} /> Click to open interactive canvas node explorer
                </div>
                <div className="mini-node project">Myca OS</div>
                <div className="mini-connector">──</div>
                <div className="mini-node entity">PostgreSQL</div>
                <div className="mini-connector">──</div>
                <div className="mini-node entity">Memory Controller</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: GRAPH VIEW (ReactFlow/Interactive SVG replacement) */}
        {activeTab === 'graph' && (
          <div className="tab-pane-fade">
            <div className="graph-workspace">
              <div className="graph-workspace-header">
                <h3>Sovereign Knowledge Link Map</h3>
                <p>Click on any node to view detailed memory linkage, type mappings, and execution history.</p>
              </div>
              
              <div className="interactive-canvas">
                <svg className="graph-svg" width="100%" height="400">
                  {/* Draw edges/lines */}
                  {KNOWLEDGE_GRAPH_EDGES.map((edge, idx) => {
                    const fromNode = KNOWLEDGE_GRAPH_NODES.find(n => n.id === edge.from);
                    const toNode = KNOWLEDGE_GRAPH_NODES.find(n => n.id === edge.to);
                    if (!fromNode || !toNode) return null;
                    return (
                      <g key={idx}>
                        <line 
                          x1={fromNode.x} 
                          y1={fromNode.y} 
                          x2={toNode.x} 
                          y2={toNode.y} 
                          className="graph-line"
                        />
                        <text 
                          x={(fromNode.x + toNode.x) / 2} 
                          y={(fromNode.y + toNode.y) / 2 - 5}
                          className="edge-label"
                        >
                          {edge.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Draw nodes */}
                  {KNOWLEDGE_GRAPH_NODES.map(node => (
                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`} style={{ cursor: 'pointer' }} onClick={() => {
                      const match = memories.find(m => m.title.toLowerCase().includes(node.id.toLowerCase()) || m.related.includes(node.id));
                      if (match) setSelectedMemory(match);
                    }}>
                      <circle 
                        r={node.type === 'project' ? 24 : 18} 
                        className={`node-circle ${node.type}`} 
                      />
                      <text 
                        y="35" 
                        textAnchor="middle" 
                        className="node-text"
                      >
                        {node.id}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: INBOX QUEUE (Öğrenme Kuyruğu) */}
        {activeTab === 'inbox' && (
          <div className="tab-pane-fade">
            <div className="pane-section-header">
              <h3>📥 Brain Learning Queue (Inbox)</h3>
              <p>Myca lists candidate memories parsed from telemetry logs or developer chat inputs. Approve items to commit them permanently to the Second Brain index.</p>
            </div>

            {inbox.length === 0 ? (
              <div className="empty-inbox-state">
                <CheckCircle2 size={48} color="#3fb950" />
                <h4>Queue completely verified</h4>
                <p>No candidate memories are currently waiting for confirmation.</p>
              </div>
            ) : (
              <div className="inbox-cards-list">
                {inbox.map(item => (
                  <div key={item.id} className="inbox-queue-card">
                    <div className="inbox-card-top">
                      <div className="inbox-card-title-block">
                        <span className="inbox-badge-type">{item.type}</span>
                        <h4>{item.title}</h4>
                      </div>
                      <div className="inbox-confidence-badge">
                        Confidence: <strong className="amber-text">{item.confidence}%</strong>
                      </div>
                    </div>
                    
                    <p className="inbox-detail">{item.detail}</p>
                    
                    <div className="inbox-source-quote">
                      <span className="quote-label">SOURCE DIALOG / LOG:</span>
                      <p>"{item.context}"</p>
                      <span className="source-origin">Detected via: {item.source}</span>
                    </div>

                    <div className="inbox-actions">
                      <button className="inbox-btn approve" onClick={() => acceptInboxItem(item.id)}>
                        <Check size={14} /> Commit to Memory
                      </button>
                      <button className="inbox-btn ignore" onClick={() => rejectInboxItem(item.id)}>
                        <X size={14} /> Ignore / Discard
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: CONFLICTS RESOLUTION SCREEN */}
        {activeTab === 'conflicts' && (
          <div className="tab-pane-fade">
            <div className="pane-section-header">
              <h3>⚠️ Active Knowledge Conflicts</h3>
              <p>When two memories or system decisions disagree, Myca flags them for explicit user resolution.</p>
            </div>

            {conflicts.length === 0 ? (
              <div className="empty-inbox-state">
                <ShieldCheck size={48} color="#3fb950" />
                <h4>All systems aligned</h4>
                <p>No knowledge conflicts were detected inside the database.</p>
              </div>
            ) : (
              <div className="conflicts-list">
                {conflicts.map(c => (
                  <div key={c.id} className="conflict-resolution-card">
                    <div className="conflict-header-row">
                      <span className="conflict-label">CONFLICT IN PROJECT: {c.project.toUpperCase()}</span>
                      <h3>{c.title}</h3>
                    </div>

                    <div className="conflict-split-pane">
                      {/* Decision A */}
                      <div className="decision-option-box">
                        <div className="option-title">DECISION A</div>
                        <h4>{c.decisionA.title}</h4>
                        <div className="option-meta">
                          <span>Logged: {c.decisionA.date}</span>
                          <span>Confidence: <strong>{c.decisionA.confidence}%</strong></span>
                          <span>Source: {c.decisionA.source}</span>
                        </div>
                        <button className="btn-resolve-option" onClick={() => resolveConflict(c.id, 'A')}>
                          Select Decision A
                        </button>
                      </div>

                      <div className="conflict-divider">VS</div>

                      {/* Decision B */}
                      <div className="decision-option-box">
                        <div className="option-title">DECISION B</div>
                        <h4>{c.decisionB.title}</h4>
                        <div className="option-meta">
                          <span>Logged: {c.decisionB.date}</span>
                          <span>Confidence: <strong>{c.decisionB.confidence}%</strong></span>
                          <span>Source: {c.decisionB.source}</span>
                        </div>
                        <button className="btn-resolve-option" onClick={() => resolveConflict(c.id, 'B')}>
                          Select Decision B
                        </button>
                      </div>
                    </div>

                    <div className="conflict-footer-actions">
                      <button className="btn-secondary" onClick={() => resolveConflict(c.id, 'both')}>
                        Both — Apply in different scopes
                      </button>
                      <button className="btn-secondary" onClick={() => resolveConflict(c.id, 'ignore')}>
                        Let Myca investigate background E2E runs
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Memories lists (Memories, Decisions, Experiences, Projects, Entities) */}
        {activeTab !== 'overview' && activeTab !== 'graph' && activeTab !== 'inbox' && activeTab !== 'conflicts' && (
          <div className="tab-pane-fade">
            <div className="section-tab-title">
              <h3>{((activeTab || 'overview')).charAt(0).toUpperCase() + ((activeTab || 'overview')).slice(1)} Index</h3>
              <p>Commit context for automated execution planning and cognitive DAG building.</p>
            </div>

            {filteredMemories.length === 0 ? (
              <div className="empty-state-search">
                <Search size={28} />
                <p>No memories match the active view and query filter.</p>
              </div>
            ) : (
              <div className="memories-cards-grid">
                {filteredMemories.map(m => {
                  const conf = getConfidenceUI(m.confidence);
                  return (
                    <div key={m.id} className="memory-card" onClick={() => setSelectedMemory(m)}>
                      <div className="memory-card-header-row">
                        <span className={`memory-type-pill ${m.type.toLowerCase()}`}>{m.type}</span>
                        <div className={`confidence-display ${conf.class}`} title={conf.label}>
                          <span className="dots">{conf.dots}</span>
                          <span className="lbl">{conf.label}</span>
                        </div>
                      </div>
                      
                      <h4 className="memory-card-title">{m.title}</h4>
                      <p className="memory-card-content">{m.content.substring(0, 120)}...</p>

                      <div className="memory-card-footer">
                        <span className="project">{m.project}</span>
                        <span className="date">{m.created}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MANUAL RECORD FORM MODAL ── */}
      {showAddForm && (
        <div className="memory-modal-overlay" onClick={() => setShowAddForm(false)}>
          <form onSubmit={handleAddMemory} className="memory-modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record Manual Memory State</h3>
              <button className="close-btn" type="button" onClick={() => setShowAddForm(false)}><X size={16} /></button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Memory / Decision Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Postgres selected as primary DB" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-row-split">
                <div className="form-group">
                  <label>Type</label>
                  <select value={newType} onChange={e => setNewType(e.target.value)}>
                    <option value="Decision">Decision</option>
                    <option value="Experience">Experience</option>
                    <option value="Memory">Memory</option>
                    <option value="Entity">Entity</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Project Scope</label>
                  <select value={newProject} onChange={e => setNewProject(e.target.value)}>
                    <option value="Myca OS">Myca OS</option>
                    <option value="Opacus">Opacus</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Memory Content / Details</label>
                <textarea 
                  placeholder="Provide precise details of the knowledge context..."
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  required
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>Related Entities (comma separated)</label>
                <input 
                  type="text" 
                  placeholder="e.g. SQLite, Database, Caching" 
                  value={newRelated}
                  onChange={e => setNewRelated(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" type="button" onClick={() => setShowAddForm(false)}>Cancel</button>
              <button className="btn-primary" type="submit">Commit to Brain</button>
            </div>
          </form>
        </div>
      )}

      {/* ── AI-NATIVE PROVENANCE DETAILS DRAWER ── */}
      {selectedMemory && (
        <div className="drawer-overlay" onClick={() => setSelectedMemory(null)}>
          <div className="drawer-container" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title-block">
                <span className={`drawer-type-badge ${selectedMemory.type.toLowerCase()}`}>{selectedMemory.type}</span>
                <h3>{selectedMemory.title}</h3>
              </div>
              <button className="close-btn" onClick={() => setSelectedMemory(null)}><X size={18} /></button>
            </div>

            <div className="drawer-body">
              {/* Context Summary */}
              <div className="drawer-section">
                <label>SUMMARY</label>
                <p className="main-content-text">{selectedMemory.content}</p>
              </div>

              {/* Provenance Metadata */}
              <div className="drawer-metadata-grid">
                <div className="meta-item">
                  <span className="lbl">TYPE</span>
                  <span className="val">{selectedMemory.type}</span>
                </div>
                <div className="meta-item">
                  <span className="lbl">PROJECT</span>
                  <span className="val">{selectedMemory.project}</span>
                </div>
                <div className="meta-item">
                  <span className="lbl">CREATED</span>
                  <span className="val">{selectedMemory.created}</span>
                </div>
                <div className="meta-item">
                  <span className="lbl">STATUS</span>
                  <span className="val-badge green">{selectedMemory.status}</span>
                </div>
              </div>

              {/* Confidence System Metrics */}
              <div className="drawer-section">
                <label>CONFIDENCE & DURABILITY</label>
                <div className="confidence-details-box">
                  <div className="score-row">
                    <span className="score-label">Confidence:</span>
                    <strong className="score-value">{selectedMemory.confidence}%</strong>
                  </div>
                  <div className="provenance-detail">
                    <Info size={13} style={{ marginRight: 6 }} />
                    {selectedMemory.why}
                  </div>
                </div>
              </div>

              {/* Provenance Source */}
              <div className="drawer-section">
                <label>WHERE DID MYCA LEARN THIS? (PROVENANCE)</label>
                <div className="provenance-source-box">
                  <span className="source-label">Source Origin:</span>
                  <strong className="source-value">{selectedMemory.source}</strong>
                </div>
              </div>

              {/* Related tags */}
              <div className="drawer-section">
                <label>RELATED ENTITIES & CONTEXTS</label>
                <div className="drawer-related-chips">
                  {(selectedMemory.related || []).map(r => (
                    <span key={r} className="related-chip" onClick={() => {
                      setSearchQuery(r);
                      setActiveTab('memories');
                      setSelectedMemory(null);
                    }}>
                      #{r}
                    </span>
                  ))}
                </div>
              </div>

              {/* History events */}
              <div className="drawer-section">
                <label>HISTORY & USAGE LOGS</label>
                <div className="history-timeline">
                  {(selectedMemory.history || []).map((h, i) => (
                    <div key={i} className="history-row">
                      <span className="date">{h.date}</span>
                      <span className="event">{h.event}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <button className="btn-secondary" onClick={() => setSelectedMemory(null)}>Archive Memory</button>
              <button className="btn-primary" onClick={() => setSelectedMemory(null)}>Confirm / Verify</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecondBrain;
