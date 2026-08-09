import React, { useState } from 'react';
import './IntentComposer.css';

const IntentComposer = ({ onBuildPlan, isPlanning }) => {
  const [intent, setIntent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (intent.trim() && !isPlanning) {
      onBuildPlan(intent);
    }
  };

  return (
    <div className="intent-composer-wrapper">
      <form onSubmit={handleSubmit} className="intent-form">
        <textarea
          className="intent-input"
          placeholder="Research our 5 competitors, verify pricing, compare customer complaints and create a report."
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          disabled={isPlanning}
          rows={4}
        />
        <div className="intent-actions">
          <button 
            type="submit" 
            className="build-plan-button"
            disabled={!intent.trim() || isPlanning}
          >
            {isPlanning ? 'Building Execution Plan...' : 'Build Execution Plan'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default IntentComposer;
