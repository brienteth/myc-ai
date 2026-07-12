import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Server } from 'lucide-react';
import { useNodes } from '../hooks/useNodes';
import './Devices.css';

const Devices = () => {
  const { nodes, status, activeInferenceNode } = useNodes();
  const [computeStats, setComputeStats] = useState(null);

  // Fetch compute avoidance stats every 10s
  useEffect(() => {
    const fetchStats = () => {
      fetch('http://127.0.0.1:8420/compute/stats')
        .then(r => r.json())
        .then(setComputeStats)
        .catch(() => {});
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const getIcon = (role, name) => {
    if (name.toLowerCase().includes('telefon')) return <Smartphone size={24} />;
    if (role === 'storage') return <Server size={24} />;
    return <Monitor size={24} />;
  };

  const getStatusText = (n) => {
    if (n.status === 'dead') return 'Offline';
    if (n.id === activeInferenceNode) return 'Active (Generating)';
    return 'Standby';
  };

  const avoidRate = computeStats?.avoidance_rate
    ? parseFloat(computeStats.avoidance_rate)
    : 0;
  const everyN = avoidRate > 0 && avoidRate < 100
    ? Math.round(1 / (avoidRate / 100))
    : null;

  return (
    <div className="devices-container">
      <div className="devices-header">
        <h1>Your Network</h1>
        <p>Devices connected to your Home Cluster</p>
      </div>

      {/* Compute Avoidance Card */}
      {computeStats && (
        <div className="compute-avoidance-card">
          <div className="avoidance-header">
            <span className="avoidance-icon">⚡</span>
            <span className="avoidance-title">Execution Analytics</span>
          </div>
          <div className="avoidance-stats">
            <div className="avoidance-main">
              <div className="avoidance-rate">{computeStats.avoidance_rate}</div>
              <div className="avoidance-label">Compute Avoided</div>
            </div>
            <div className="avoidance-details">
              <div className="avoidance-detail">
                <span className="detail-value">{computeStats.energy_saved}u</span>
                <span className="detail-label">Energy Saved</span>
              </div>
              <div className="avoidance-detail">
                <span className="detail-value">{computeStats.gpu_seconds_saved}</span>
                <span className="detail-label">GPU Sec Saved</span>
              </div>
              <div className="avoidance-detail">
                <span className="detail-value">{computeStats.average_latency_ms}ms</span>
                <span className="detail-label">Avg Latency</span>
              </div>
              <div className="avoidance-detail">
                <span className="detail-value">{computeStats.reused_experiences}</span>
                <span className="detail-label">Experiences Reused</span>
              </div>
            </div>
            <div className="avoidance-details" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                <div className="avoidance-detail">
                  <span className="detail-value">{computeStats.local_execution_pct}</span>
                  <span className="detail-label">Local Exec</span>
                </div>
                <div className="avoidance-detail">
                  <span className="detail-value">{computeStats.network_execution_pct}</span>
                  <span className="detail-label">Network Exec</span>
                </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="network-canvas">
        <div className="graph-placeholder">
          {nodes.slice(0, 3).map((n, i) => {
            const positions = ['center', 'top-left', 'bottom-right'];
            const pos = positions[i] || 'center';
            return (
              <div key={n.id} className={`node ${pos} ${n.id === activeInferenceNode ? 'pulsing' : ''}`}>
                {n.name}
              </div>
            );
          })}
          {activeInferenceNode && <div className="beam active"></div>}
        </div>
      </div>
      
      <div className="device-cards">
        {nodes.map(n => {
          const isActive = n.id === activeInferenceNode;
          const isDead = n.status === 'dead';
          
          return (
            <div key={n.id} className={`device-card ${isActive ? 'active-node' : ''} ${isDead ? 'dead-node' : ''}`}>
              <div className="device-icon">{getIcon(n.role, n.name)}</div>
              <div className="device-info">
                <div className="device-info-header">
                  <h3>{n.name} {n.isLocal && '(Bu Cihaz)'}</h3>
                  {isActive && <span className="badge-active">Active</span>}
                  {!isActive && n.tokens_per_second > 0 && !isDead && (
                    <span className="badge-tps">{n.tokens_per_second} tok/s</span>
                  )}
                </div>
                <p className={`status ${isDead ? 'sleeping' : isActive ? 'healthy' : 'idle'}`}>
                  {getStatusText(n)}
                </p>
                
                {!isDead && (
                  <div className="load-bar-container">
                    <div className="load-bar-label">Load: {n.load_pct}%</div>
                    <div className="load-bar-bg">
                      <div 
                        className="load-bar-fill" 
                        style={{ 
                          width: `${n.load_pct}%`,
                          background: n.load_pct > 85 ? 'var(--error)' : 'var(--accent)'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Devices;
