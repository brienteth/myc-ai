import React, { useState } from 'react';
import './ExecutionIntelligence.css';
import IntentComposer from './components/IntentComposer';
import UnderstandingPanel from './components/UnderstandingPanel';
import executionIntelligenceService from './services/executionIntelligenceService';

const ExecutionIntelligence = () => {
  const [planState, setPlanState] = useState('idle'); // 'idle', 'planning', 'understood'
  const [contractData, setContractData] = useState(null);
  const [error, setError] = useState(null);

  const handleBuildPlan = async (intent) => {
    setPlanState('planning');
    setError(null);
    try {
      const response = await executionIntelligenceService.planExecution(intent);
      setContractData(response.contract || {
        intent,
        goal: "Create a verified competitor intelligence report.",
        inputs: ["competitor_list"],
        credentials: [{ name: "Web Search", status: "ready" }, { name: "telegram_bot_token", status: "missing" }],
        capabilities: ["research.search", "data.extract", "report.generate"],
        agentCount: 3,
        dependencyCount: 3,
        parallelLevels: 2,
        verificationRequired: true,
        qualityTarget: 96,
        budget: "1.00",
        maxIterations: 8,
        runtimePolicy: "AUTO",
        approvalRequired: false
      });
      setPlanState('understood');
    } catch (err) {
      console.error(err);
      setError("Failed to build execution plan.");
      setPlanState('idle');
    }
  };

  return (
    <div className="execution-intelligence-container">
      <header className="ei-header">
        <div className="ei-brand">
          <h1>MYCA EXECUTION INTELLIGENCE</h1>
          <span className="status-badge ready">● READY</span>
        </div>
      </header>

      <main className="ei-main">
        {planState === 'idle' || planState === 'planning' ? (
          <div className="ei-hero">
            <h2>What do you want Myca to accomplish?</h2>
            {error && <div className="ei-error">{error}</div>}
            <IntentComposer 
              onBuildPlan={handleBuildPlan} 
              isPlanning={planState === 'planning'} 
            />
            
            {planState === 'idle' && (
              <div className="ei-recent">
                <h3>Recent Executions</h3>
                <ul className="recent-list">
                  <li>
                    <span className="recent-title">● Competitor Research</span>
                    <span className="recent-score">94 / 100</span>
                    <span className="recent-status success">SUCCESS</span>
                  </li>
                  <li>
                    <span className="recent-title">● Weekly Sales Report</span>
                    <span className="recent-score">98 / 100</span>
                    <span className="recent-status success">SUCCESS</span>
                  </li>
                  <li>
                    <span className="recent-title">● Invoice Reconciliation</span>
                    <span className="recent-score">97 / 100</span>
                    <span className="recent-status success">SUCCESS</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <UnderstandingPanel 
            onReset={() => setPlanState('idle')} 
            contractData={contractData}
          />
        )}
      </main>
    </div>
  );
};

export default ExecutionIntelligence;
