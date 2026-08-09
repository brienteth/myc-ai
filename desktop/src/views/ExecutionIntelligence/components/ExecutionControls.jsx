import React from 'react';
import './ExecutionControls.css';

const ExecutionControls = ({ status, onPause, onResume, onCancel, approvalData, onApprove, onReject }) => {
  return (
    <div className="execution-controls">
      {status === 'WAITING_APPROVAL' && approvalData && (
        <div className="approval-panel">
          <div className="ap-header">
            <h3>{approvalData.type} APPROVAL REQUIRED</h3>
            <span className="ap-risk high">HIGH RISK</span>
          </div>
          
          <div className="ap-content">
            <div className="ap-meta">
              <span className="ap-label">Amount</span>
              <span className="ap-value">{approvalData.amount}</span>
            </div>
            <div className="ap-meta">
              <span className="ap-label">Destination</span>
              <span className="ap-value">{approvalData.destination}</span>
            </div>
            <div className="ap-meta">
              <span className="ap-label">Reason</span>
              <span className="ap-value">{approvalData.reason}</span>
            </div>
            <div className="ap-meta">
              <span className="ap-label">Policy</span>
              <span className="ap-value">{approvalData.policy}</span>
            </div>
          </div>

          <div className="ap-actions">
            <button className="ap-btn reject" onClick={onReject}>Reject</button>
            <button className="ap-btn approve" onClick={onApprove}>Approve with Passkey</button>
          </div>
        </div>
      )}

      {status === 'RUNNING' && (
        <div className="ec-actions">
          <button className="ec-btn pause" onClick={onPause}>⏸ Pause Execution</button>
          <button className="ec-btn cancel" onClick={onCancel}>⏹ Cancel</button>
        </div>
      )}

      {status === 'PAUSED' && (
        <div className="ec-actions">
          <div className="ec-status-info">
            <span className="ec-dot paused"></span>
            <span>Checkpoint saved. Ready to resume.</span>
          </div>
          <button className="ec-btn resume" onClick={onResume}>▶ Resume from Checkpoint</button>
        </div>
      )}
    </div>
  );
};

export default ExecutionControls;
