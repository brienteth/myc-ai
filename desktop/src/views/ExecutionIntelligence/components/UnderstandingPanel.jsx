import React, { useState } from 'react';
import './UnderstandingPanel.css';
import ContractViewer from './ContractViewer';

const UnderstandingPanel = ({ onReset, contractData }) => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="understanding-panel">
      <div className="up-header">
        <h2>I UNDERSTOOD</h2>
        <button className="up-close" onClick={onReset}>✕</button>
      </div>

      <div className="up-tabs">
        <button 
          className={`up-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`up-tab ${activeTab === 'contract' ? 'active' : ''}`}
          onClick={() => setActiveTab('contract')}
        >
          Contract Details
        </button>
      </div>

      <div className="up-content">
        {activeTab === 'overview' ? (
          <>
            <div className="up-section">
              <h3>Goal</h3>
              <p>{contractData?.goal || 'Create a verified competitor intelligence report.'}</p>
            </div>

        <div className="up-section">
          <h3>Myca will:</h3>
          <ul className="up-steps">
            <li><span className="step-num">01</span> Research competitor pricing</li>
            <li><span className="step-num">02</span> Analyze customer complaints</li>
            <li><span className="step-num">03</span> Identify market gaps</li>
            <li><span className="step-num">04</span> Verify findings independently</li>
            <li><span className="step-num">05</span> Synthesize final report</li>
          </ul>
        </div>

        <div className="up-metrics">
          <div className="metric-box">
            <span className="metric-label">Estimated execution</span>
            <span className="metric-value">~3m 20s</span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Parallel tasks</span>
            <span className="metric-value">3</span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Verification</span>
            <span className="metric-value">Required</span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Quality target</span>
            <span className="metric-value">≥ 96</span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Budget</span>
            <span className="metric-value">$0.42 est.</span>
          </div>
        </div>
          </>
        ) : (
          <ContractViewer contract={contractData} />
        )}
      </div>

      <div className="up-actions">
        <button className="up-btn secondary" onClick={onReset}>Edit Plan</button>
        <button className="up-btn secondary" onClick={() => {
          console.log("Simulating plan...", contractData);
          alert("Simulation requested (Integration pending)");
        }}>Simulate</button>
        <button 
          className="up-btn primary" 
          onClick={() => {
            if (contractData?.credentials?.some(c => c.status === 'missing')) {
              alert("BLOCKED: Missing required credential");
              return;
            }
            console.log("Running execution...", contractData);
            alert("Execution started (Integration pending)");
          }}
          disabled={contractData?.credentials?.some(c => c.status === 'missing')}
        >
          {contractData?.credentials?.some(c => c.status === 'missing') ? 'Blocked (Missing Credential)' : 'Run'}
        </button>
      </div>
    </div>
  );
};

export default UnderstandingPanel;
