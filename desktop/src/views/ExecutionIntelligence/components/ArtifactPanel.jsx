import React from 'react';
import './ArtifactPanel.css';

const ArtifactPanel = ({ quality, iterations, duration, cost, artifacts = [] }) => {
  return (
    <div className="artifact-panel">
      <div className="art-header">
        <h3>EXECUTION COMPLETE</h3>
      </div>
      
      <div className="art-metrics">
        <div className="art-metric">
          <span className="art-label">Quality</span>
          <span className="art-value success">{quality} / 100</span>
        </div>
        <div className="art-metric">
          <span className="art-label">Iterations</span>
          <span className="art-value">{iterations}</span>
        </div>
        <div className="art-metric">
          <span className="art-label">Duration</span>
          <span className="art-value">{duration}</span>
        </div>
        <div className="art-metric">
          <span className="art-label">Cost</span>
          <span className="art-value">{cost}</span>
        </div>
      </div>

      <div className="art-files">
        <h4>Artifacts</h4>
        <ul className="art-file-list">
          {artifacts.map((file, idx) => (
            <li key={idx}>
              <span className="file-icon">📄</span>
              <span className="file-name">{file}</span>
              <button className="file-action">View</button>
            </li>
          ))}
          {/* Default mock if empty */}
          {artifacts.length === 0 && (
            <>
              <li>
                <span className="file-icon">📄</span>
                <span className="file-name">competitor_report.md</span>
                <button className="file-action">View</button>
              </li>
              <li>
                <span className="file-icon">📄</span>
                <span className="file-name">sources.json</span>
                <button className="file-action">View</button>
              </li>
              <li>
                <span className="file-icon">📄</span>
                <span className="file-name">execution_receipt.json</span>
                <button className="file-action">View</button>
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

export default ArtifactPanel;
