import React, { useState } from 'react';
import { Terminal, Activity, BrainCircuit } from 'lucide-react';
import './WorkflowStudio.css';

const WorkflowDebugger = ({ logs, isExecuting }) => {
  const [activeTab, setActiveTab] = useState('timeline');

  return (
    <div className="workflow-debugger">
      <div className="debugger-header">
        <div className={`debugger-tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
          <Activity size={14} /> Execution Timeline
        </div>
        <div className={`debugger-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          <Terminal size={14} /> Execution Log
        </div>
        <div className={`debugger-tab ${activeTab === 'planner' ? 'active' : ''}`} onClick={() => setActiveTab('planner')}>
          <BrainCircuit size={14} /> Planner Decisions
        </div>
      </div>
      
      <div className="debugger-content">
        {activeTab === 'logs' && (
          <div className="logs-container">
            {logs.map((log, i) => (
              <div key={i} className="log-line">
                <span className="log-time">[{log.time}]</span>
                <span className={`log-${log.type}`}>{log.msg}</span>
              </div>
            ))}
            {isExecuting && (
              <div className="log-line" style={{opacity: 0.5}}>
                <span className="log-time">[{new Date().toLocaleTimeString()}]</span>
                <span className="log-info">Streaming node outputs...</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="timeline-container">
            <p style={{color: 'var(--f-earth)', fontSize: 13, marginBottom: 12}}>Visual timeline of parallel execution nodes</p>
            <div className="timeline-track">
              <div className="track-label">Read File</div>
              <div className="track-bar" style={{ width: '20%', left: '0%', background: 'var(--f-stone)' }}></div>
            </div>
            <div className="timeline-track">
              <div className="track-label">Summarize</div>
              <div className="track-bar" style={{ width: '40%', left: '25%', background: 'var(--f-moss)' }}></div>
            </div>
            <div className="timeline-track">
              <div className="track-label">Translate</div>
              <div className="track-bar" style={{ width: '30%', left: '25%', background: 'var(--f-sand)' }}></div>
            </div>
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="planner-container">
            <div className="decision-card">
              <h4>Need: Summarize PDF</h4>
              <div className="decision-flow">
                <div>Selected <strong>pdf.read</strong></div>
                <div>Selected <strong>ai.summarize</strong></div>
                <div style={{color: 'var(--f-earth)'}}>Skipped <strong>ocr.extract</strong> (PDF contains text)</div>
              </div>
              <p style={{fontSize: 12, marginTop: 8}}>Confidence: High (98%)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowDebugger;
