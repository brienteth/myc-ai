import React from 'react';
import { Monitor, Smartphone, Server, Laptop } from 'lucide-react';
import MyceliumCanvas from '../components/MyceliumCanvas';
import { useNodes, nodeNickname } from '../hooks/useNodes';
import './Colony.css';

const Devices = () => {
  const { nodes } = useNodes();

  const getIcon = (role) => {
    switch(role) {
      case 'edge': return <Smartphone size={24} color="var(--f-earth)" />;
      case 'server': return <Server size={24} color="var(--f-earth)" />;
      case 'laptop': return <Laptop size={24} color="var(--f-earth)" />;
      default: return <Monitor size={24} color="var(--f-earth)" />;
    }
  };

  return (
    <div className="colony-container">
      <div className="colony-header">
        <h1 className="f-serif-italic">Colony</h1>
        <p>Devices in the Mycelium network</p>
      </div>

      <div className="colony-canvas-wrapper">
        <MyceliumCanvas nodeCount={nodes.length > 0 ? nodes.length * 3 + 10 : 25} connectDist={100} pulseEvery={2000} speed={0.1} />
      </div>

      <div className="device-grid">
        {nodes.map(n => (
          <div key={n.id} className={`device-card ${n.status === 'dead' ? 'offline' : (n.status === 'ready' || n.status === 'processing' ? 'active' : 'sleeping')}`}>
            <div className="device-card-header">
              {getIcon(n.role)}
              <span className={`device-status ${n.status === 'dead' ? 'offline' : (n.status === 'ready' || n.status === 'processing' ? 'active' : 'sleeping')}`}>
                {n.status}
              </span>
            </div>
            <div className="device-info">
              <h3>{n.name}</h3>
              <div className="device-metrics">
                <span>{n.load_pct?.toFixed(0) || 0}% load</span>
                <span>{n.tokens_per_second?.toFixed(1) || 0} tok/s</span>
                <span>{n.latency ? n.latency + 'ms' : 'local'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="avoidance-card">
        <div className="big-num f-serif-italic">35%</div>
        <div className="avoid-text">
          <h3>queries answered from cache</h3>
          <p>Model never executed. Compute saved.</p>
        </div>
      </div>
    </div>
  );
};

export default Devices;
