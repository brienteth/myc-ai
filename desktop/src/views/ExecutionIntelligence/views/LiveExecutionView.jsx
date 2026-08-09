import React from 'react';
import './LiveExecutionView.css';
import AgentGraph from './AgentGraph';
import ExecutionTimeline from './ExecutionTimeline';
import BudgetPanel from './BudgetPanel';
import LoopPanel from './LoopPanel';
import VerificationPanel from './VerificationPanel';

const LiveExecutionView = () => {
  return (
    <div className="live-execution-view">
      <div className="lev-main">
        <div className="lev-header">
          <div className="lev-title">
            <h2>EXECUTION #8F21</h2>
            <span className="status-badge running">● RUNNING</span>
          </div>
          <div className="lev-stats">
            <div className="stat">
              <span className="stat-label">Elapsed</span>
              <span className="stat-value">18.4s</span>
            </div>
            <div className="stat">
              <span className="stat-label">Agents</span>
              <span className="stat-value">7</span>
            </div>
            <div className="stat">
              <span className="stat-label">Completed</span>
              <span className="stat-value">4</span>
            </div>
            <div className="stat">
              <span className="stat-label">Running</span>
              <span className="stat-value running-val">2</span>
            </div>
          </div>
        </div>
        
        <div className="lev-graph-container">
          <AgentGraph />
        </div>
      </div>

      <div className="lev-sidebar">
        <BudgetPanel />
        <div className="lev-inspectors">
          {/* Example of active panels based on current execution state */}
          <LoopPanel />
          <VerificationPanel />
        </div>
        <ExecutionTimeline />
      </div>
    </div>
  );
};

export default LiveExecutionView;
