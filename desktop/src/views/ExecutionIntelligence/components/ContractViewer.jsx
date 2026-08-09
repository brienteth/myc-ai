import React from 'react';
import './ContractViewer.css';

const ContractViewer = ({ contract }) => {
  if (!contract) return null;

  return (
    <div className="contract-viewer">
      <div className="cv-header">
        <h3>EXECUTION CONTRACT</h3>
      </div>
      
      <div className="cv-content">
        <div className="cv-section intent-section">
          <span className="cv-label">Intent</span>
          <p className="cv-value-large">"{contract.intent}"</p>
        </div>

        <div className="cv-grid">
          <div className="cv-section">
            <span className="cv-label">Inputs</span>
            <ul className="cv-list">
              {contract.inputs?.map((input, i) => (
                <li key={i}><span className="check">✓</span> {input}</li>
              ))}
            </ul>
          </div>

          <div className="cv-section">
            <span className="cv-label">Credentials</span>
            <ul className="cv-list">
              {contract.credentials?.map((cred, i) => (
                <li key={i} className={cred.status === 'missing' ? 'missing-cred' : ''}>
                  <span className="check">{cred.status === 'missing' ? '✕' : '✓'}</span> {cred.name}
                </li>
              ))}
            </ul>
          </div>

          <div className="cv-section">
            <span className="cv-label">Capabilities</span>
            <ul className="cv-list">
              {contract.capabilities?.map((cap, i) => (
                <li key={i}>{cap}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="cv-metrics-grid">
          <div className="cv-metric">
            <span className="cv-label">Agents</span>
            <span className="cv-value">{contract.agentCount || 0}</span>
          </div>
          <div className="cv-metric">
            <span className="cv-label">Dependencies</span>
            <span className="cv-value">{contract.dependencyCount || 0}</span>
          </div>
          <div className="cv-metric">
            <span className="cv-label">Parallel levels</span>
            <span className="cv-value">{contract.parallelLevels || 1}</span>
          </div>
          <div className="cv-metric">
            <span className="cv-label">Verification</span>
            <span className="cv-value">{contract.verificationRequired ? 'Required' : 'None'}</span>
          </div>
          <div className="cv-metric">
            <span className="cv-label">Success criteria</span>
            <span className="cv-value">Quality ≥ {contract.qualityTarget || 90}</span>
          </div>
          <div className="cv-metric">
            <span className="cv-label">Budget</span>
            <span className="cv-value">${contract.budget || '0.00'}</span>
          </div>
          <div className="cv-metric">
            <span className="cv-label">Max iterations</span>
            <span className="cv-value">{contract.maxIterations || 1}</span>
          </div>
          <div className="cv-metric">
            <span className="cv-label">Runtime policy</span>
            <span className="cv-value">{contract.runtimePolicy || 'AUTO'}</span>
          </div>
          <div className="cv-metric">
            <span className="cv-label">Approval</span>
            <span className="cv-value">{contract.approvalRequired ? 'Required' : 'Not required'}</span>
          </div>
        </div>

        <div className="cv-economics">
          <div className="cve-header">EXECUTION ECONOMICS</div>
          <div className="cve-grid">
            <div className="cve-box">
              <span className="cve-label">Estimated</span>
              <span className="cve-value">${contract.estimatedCost?.toFixed(2) || '0.84'}</span>
            </div>
            <div className="cve-box">
              <span className="cve-label">Maximum</span>
              <span className="cve-value">${contract.budget || '1.00'}</span>
            </div>
            <div className="cve-box">
              <span className="cve-label">Actual</span>
              <span className="cve-value highlight">${contract.actualCost?.toFixed(2) || '---'}</span>
            </div>
            <div className="cve-box">
              <span className="cve-label">Saved vs estimate</span>
              <span className="cve-value success">
                {contract.actualCost ? `$${(contract.estimatedCost - contract.actualCost).toFixed(2)}` : '---'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractViewer;
