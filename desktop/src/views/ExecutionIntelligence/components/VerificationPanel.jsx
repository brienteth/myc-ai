import React from 'react';
import './VerificationPanel.css';

const VerificationPanel = () => {
  return (
    <div className="verification-panel">
      <div className="vp-header">
        <h3>VERIFICATION</h3>
        <span className="vp-finding-id">Finding #14</span>
      </div>

      <div className="vp-checks">
        <div className="vp-check pass">
          <span className="check-label">Correctness</span>
          <span className="check-icon">✓</span>
        </div>
        <div className="vp-check pass">
          <span className="check-label">Freshness</span>
          <span className="check-icon">✓</span>
        </div>
        <div className="vp-check fail">
          <span className="check-label">Source Validity</span>
          <span className="check-icon">✕</span>
        </div>
      </div>

      <div className="vp-verdict-section">
        <span className="vp-label">Verdict</span>
        <div className="vp-verdict reject">REJECT</div>
      </div>

      <div className="vp-reason-section">
        <span className="vp-label">Reason:</span>
        <p className="vp-reason-text">Source does not support the claim.</p>
      </div>

      <div className="vp-action-section">
        <span className="vp-label">Action</span>
        <button className="vp-action-btn">Repair Agent</button>
      </div>
    </div>
  );
};

export default VerificationPanel;
