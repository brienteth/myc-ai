import React from 'react';
import './LoopPanel.css';

const LoopPanel = () => {
  return (
    <div className="loop-panel">
      <div className="lp-header">
        <h3>EXECUTION LOOP</h3>
      </div>
      
      <div className="lp-section">
        <div className="lp-meta">
          <span className="lp-label">Goal</span>
          <span className="lp-value">Quality ≥ 96</span>
        </div>
        <div className="lp-meta">
          <span className="lp-label">Iteration</span>
          <span className="lp-value">3 / 8</span>
        </div>
        <div className="lp-meta">
          <span className="lp-label">Current Score</span>
          <span className="lp-value score-warning">92</span>
        </div>
      </div>

      <div className="lp-section">
        <span className="lp-label">Weakest criterion</span>
        <div className="lp-criterion">Source validity</div>
      </div>

      <div className="lp-section action-section">
        <span className="lp-label">Action</span>
        <p className="lp-action-text">Repairing verification node...</p>
        
        <div className="lp-progress-bar">
          <div className="lp-progress-fill" style={{ width: '75%' }}></div>
        </div>
        <span className="lp-progress-text">75%</span>
      </div>

      <div className="lp-history">
        <h4>Iteration History</h4>
        <ul className="lp-history-list">
          <li><span>Iteration 1</span> <span className="score">81</span></li>
          <li><span>Iteration 2</span> <span className="score">89</span></li>
          <li className="current"><span>Iteration 3</span> <span className="score">92</span></li>
        </ul>
      </div>
    </div>
  );
};

export default LoopPanel;
