import React, { useState, useEffect } from 'react';
import { Brain, Pin, Bookmark, Database, Sparkles, Save, RotateCcw, CheckCircle, FileText } from 'lucide-react';
import './SecondBrain.css';

const SecondBrain = () => {
  const [workingMemory, setWorkingMemory] = useState({
    activeTask: 'Multi-Agent Execution Planning (Planner v3)',
    parameters: '9 Agents Active · Quality Scorer ≥96/100',
    focus: 'Deterministic Intent Graph Compilation'
  });

  const [pinnedItems, setPinnedItems] = useState([
    { id: 1, title: 'Myca Sovereign Stack Specification v1.0', type: 'Architecture', date: 'Just now' },
    { id: 2, title: 'Planner v3 Multi-Agent Quality Score Contract', type: 'Specification', date: 'Today' }
  ]);

  const [handoverLog, setHandoverLog] = useState(() => {
    return localStorage.getItem('myca_handover_state') || 'No saved handover state.';
  });

  const [handoverSummary, setHandoverSummary] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const handleSaveHandover = () => {
    if (!handoverSummary.trim()) return;
    const timestamp = new Date().toLocaleString();
    const newState = `[${timestamp}] Handover Saved:\nSummary: ${handoverSummary}\nActive Context: ${workingMemory.activeTask}\nStatus: Execution Bus Ready`;
    localStorage.setItem('myca_handover_state', newState);
    setHandoverLog(newState);
    setHandoverSummary('');
    setSaveStatus('Handover state persisted successfully!');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const handleResumeHandover = () => {
    const saved = localStorage.getItem('myca_handover_state');
    if (saved) {
      setHandoverLog(saved);
      setSaveStatus('Handover state resumed into active memory context.');
      setTimeout(() => setSaveStatus(''), 3000);
    } else {
      setSaveStatus('No previous handover checkpoint found.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  return (
    <div className="second-brain-container">
      <div className="brain-header">
        <div className="brain-title-area">
          <Brain className="brain-icon" size={28} />
          <div>
            <h1>🧠 Second Brain & Experience Memory</h1>
            <p>Local-First Persistent Context, Semantic Indices, and Session Handover Manager</p>
          </div>
        </div>
        <div className="brain-badge">100% Localhost Sync</div>
      </div>

      {saveStatus && (
        <div className="save-status-banner">
          <CheckCircle size={16} /> {saveStatus}
        </div>
      )}

      {/* Grid of Memory Layers */}
      <div className="memory-grid">
        {/* Working Memory */}
        <div className="memory-card">
          <div className="card-header">
            <Sparkles size={18} className="header-icon moss" />
            <h3>Working Memory (Active Context)</h3>
          </div>
          <div className="memory-content mono">
            <div><strong>Active Task:</strong> {workingMemory.activeTask}</div>
            <div><strong>Parameters:</strong> {workingMemory.parameters}</div>
            <div><strong>Current Focus:</strong> {workingMemory.focus}</div>
          </div>
        </div>

        {/* Pinned Context */}
        <div className="memory-card">
          <div className="card-header">
            <Pin size={18} className="header-icon gold" />
            <h3>Pinned Context (Developer Context)</h3>
          </div>
          <div className="memory-content">
            {pinnedItems.map(item => (
              <div key={item.id} className="pinned-item">
                <FileText size={14} />
                <span>{item.title}</span>
                <span className="pinned-tag">{item.type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Long-Term Memory */}
        <div className="memory-card">
          <div className="card-header">
            <Database size={18} className="header-icon blue" />
            <h3>Long-Term Memory (Semantic Indices)</h3>
          </div>
          <div className="memory-content">
            <div><strong>Vector Space Dimension:</strong> 384 (MiniLM-L6)</div>
            <div><strong>Indexed Entities:</strong> 12,483 nodes</div>
            <div><strong>Graph Database:</strong> SQLite + Memory-Backed Merkle DAG</div>
          </div>
        </div>

        {/* Experience Memory */}
        <div className="memory-card">
          <div className="card-header">
            <Bookmark size={18} className="header-icon green" />
            <h3>Experience & Learnings</h3>
          </div>
          <div className="memory-content mono small">
            <div>✓ Executed 142 DAG plans (98.4% success)</div>
            <div>✓ Automated repair loop resolved 6 parameter mismatches</div>
            <div>✓ Local LLM inference speed: 45 tok/s (Local MLX)</div>
          </div>
        </div>
      </div>

      {/* Handover Manager */}
      <div className="handover-section">
        <div className="section-title">
          <Save size={20} />
          <h2>Handover State Manager (Session Continuity)</h2>
        </div>
        <p className="section-desc">Save active work session summary to resume execution state across app reloads.</p>

        <div className="handover-controls">
          <input
            type="text"
            className="handover-input"
            placeholder="Enter session handover summary (e.g., API layer verified, starting frontend integration)..."
            value={handoverSummary}
            onChange={(e) => setHandoverSummary(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveHandover()}
          />
          <button className="btn-primary" onClick={handleSaveHandover}>
            <Save size={16} /> Save Handover
          </button>
          <button className="btn-secondary" onClick={handleResumeHandover}>
            <RotateCcw size={16} /> Resume Session
          </button>
        </div>

        <div className="handover-log-box">
          <div className="log-title">PERSISTED HANDOVER STATE LOG</div>
          <pre className="log-content">{handoverLog}</pre>
        </div>
      </div>
    </div>
  );
};

export default SecondBrain;
