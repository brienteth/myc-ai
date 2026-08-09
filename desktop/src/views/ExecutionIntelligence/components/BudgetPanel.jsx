import React from 'react';
import './BudgetPanel.css';

const BudgetPanel = () => {
  return (
    <div className="budget-panel">
      <div className="bp-header">
        <h3>EXECUTION BUDGET</h3>
      </div>
      
      <div className="bp-metrics">
        <div className="bp-metric">
          <span className="bp-label">Tokens</span>
          <div className="bp-bar-container">
            <div className="bp-bar-fill warning" style={{ width: '42%' }}></div>
          </div>
          <span className="bp-value">42,180 / 100,000</span>
        </div>

        <div className="bp-metric">
          <span className="bp-label">Compute</span>
          <div className="bp-bar-container">
            <div className="bp-bar-fill safe" style={{ width: '34%' }}></div>
          </div>
          <span className="bp-value">$0.34 / $1.00</span>
        </div>

        <div className="bp-metric">
          <span className="bp-label">Time</span>
          <div className="bp-bar-container">
            <div className="bp-bar-fill safe" style={{ width: '14%' }}></div>
          </div>
          <span className="bp-value">43s / 5m</span>
        </div>

        <div className="bp-metric">
          <span className="bp-label">Iterations</span>
          <div className="bp-bar-container">
            <div className="bp-bar-fill warning" style={{ width: '37%' }}></div>
          </div>
          <span className="bp-value">3 / 8</span>
        </div>
      </div>
    </div>
  );
};

export default BudgetPanel;
