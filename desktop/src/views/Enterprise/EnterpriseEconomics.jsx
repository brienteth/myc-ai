import React, { useState, useEffect } from 'react';
import './EnterpriseEconomics.css';
import executionIntelligenceService from '../ExecutionIntelligence/services/executionIntelligenceService';

const EnterpriseEconomics = () => {
  const [metrics, setMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchEconomics = async () => {
      try {
        const backendUrl = typeof window !== 'undefined' && window.getBackendUrl ? window.getBackendUrl() : `${window.getBackendUrl ? window.getBackendUrl() : 'http://127.0.0.1:8420'}`;
        const response = await fetch(`${backendUrl}/execution/intelligence/economics`);
        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to load economics data", err);
      }
    };
    fetchEconomics();
  }, []);

  if (!metrics) {
    return <div className="economics-loading">Loading Ledger Data...</div>;
  }

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(val);

  return (
    <div className="enterprise-economics">
      <header className="eco-header">
        <h1>ECONOMICS</h1>
        <div className="eco-nav">
          {['overview', 'usage', 'execution costs', 'compute', 'drivers', 'savings', 'billing', 'invoices'].map(tab => (
            <button 
              key={tab} 
              className={`eco-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab ? tab.charAt(0).toUpperCase() + tab.slice(1) : ''}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'overview' && (
        <div className="eco-content">
          <div className="eco-kpi-grid">
            <div className="eco-kpi-card">
              <span className="kpi-label">Monthly Spend</span>
              <span className="kpi-value">{formatCurrency(metrics.monthlySpend)}</span>
              <span className="kpi-delta down">↓ {metrics.spendDelta}%</span>
            </div>
            <div className="eco-kpi-card">
              <span className="kpi-label">Execution Volume</span>
              <span className="kpi-value">{formatNumber(metrics.executionVolume)}</span>
              <span className="kpi-delta up">↑ {metrics.volumeDelta}%</span>
            </div>
            <div className="eco-kpi-card highlight">
              <span className="kpi-label">Customer Savings</span>
              <span className="kpi-value">{formatCurrency(metrics.customerSavings)}</span>
              <span className="kpi-delta up">↑ {metrics.savingsDelta}%</span>
            </div>
            <div className="eco-kpi-card success">
              <span className="kpi-label">Gross Value Created</span>
              <span className="kpi-value">{formatCurrency(metrics.grossValueCreated)}</span>
            </div>
          </div>

          <div className="eco-breakdown">
            <h3>SPEND BREAKDOWN</h3>
            <div className="breakdown-grid">
              <div className="bd-card">
                <span className="bd-label">PLATFORM</span>
                <span className="bd-value">{formatCurrency(metrics.breakdown.platform)}</span>
              </div>
              <div className="bd-card">
                <span className="bd-label">EXECUTION</span>
                <span className="bd-value">{formatCurrency(metrics.breakdown.execution)}</span>
              </div>
              <div className="bd-card">
                <span className="bd-label">COMPUTE</span>
                <span className="bd-value">{formatCurrency(metrics.breakdown.compute)}</span>
              </div>
              <div className="bd-card">
                <span className="bd-label">DRIVERS</span>
                <span className="bd-value">{formatCurrency(metrics.breakdown.drivers)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'savings' && (
        <div className="eco-content">
          <div className="savings-hero">
            <div className="sh-box">
              <span className="sh-label">Previous Enterprise Stack</span>
              <span className="sh-value">$1,000,000 / month</span>
            </div>
            <div className="sh-box">
              <span className="sh-label">Myca Operating Cost</span>
              <span className="sh-value">{formatCurrency(metrics.monthlySpend)} / month</span>
            </div>
            <div className="sh-box highlight">
              <span className="sh-label">Verified Savings</span>
              <span className="sh-value">{formatCurrency(metrics.customerSavings)} / month</span>
            </div>
          </div>

          <div className="savings-list">
            <h3>VERIFIED SAVINGS CLAIMS</h3>
            <table className="savings-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Baseline</th>
                  <th>After Myca</th>
                  <th>Value</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {(metrics.savings?.claims || []).map((claim, idx) => (
                  <tr key={idx}>
                    <td>{claim.source}</td>
                    <td>{claim.baseline}</td>
                    <td>{claim.after_myca}</td>
                    <td className="verified-val">{formatCurrency(claim.verified_value)}</td>
                    <td>{claim.confidence * 100}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {activeTab === 'compute' && (
        <div className="eco-content">
          <div className="runtime-grid">
            <div className="rt-card">
              <h3>LOCAL</h3>
              <p className="rt-executions">1,842,912 executions</p>
              <p className="rt-cost">$0 infrastructure allocation</p>
            </div>
            <div className="rt-card">
              <h3>COLONY</h3>
              <p className="rt-executions">842,102 executions</p>
              <p className="rt-cost">$4,821</p>
            </div>
            <div className="rt-card">
              <h3>0G COMPUTE</h3>
              <p className="rt-executions">4,182,920 executions</p>
              <p className="rt-cost">$18,402</p>
            </div>
            <div className="rt-card">
              <h3>ENTERPRISE GPU</h3>
              <p className="rt-executions">12,431 executions</p>
              <p className="rt-cost">$7,820</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseEconomics;
