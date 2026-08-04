import React, { useEffect } from 'react';
import { Monitor, Smartphone, Server, Laptop, Wifi, Router, Tv, Printer, HardDrive, Globe } from 'lucide-react';
import MyceliumCanvas from '../components/MyceliumCanvas';
import { useNodes, nodeNickname } from '../hooks/useNodes';
import './Colony.css';

const Devices = () => {
  const { nodes, lanDevices, status, backendOnline } = useNodes();

  const getIcon = (role) => {
    switch(role) {
      case 'phone': return <Smartphone size={22} />;
      case 'server': return <Server size={22} />;
      case 'laptop': return <Laptop size={22} />;
      case 'router': return <Router size={22} />;
      case 'iot': return <Tv size={22} />;
      case 'desktop': return <Monitor size={22} />;
      default: return <HardDrive size={22} />;
    }
  };

  // Trigger a manual LAN scan when backend comes online
  useEffect(() => {
    if (backendOnline) {
      fetch('http://127.0.0.1:8420/lan/scan', { method: 'POST' }).catch(() => {});
    }
  }, [backendOnline]);

  const allDeviceCount = nodes.length + lanDevices.length;

  return (
    <div className="colony-container">
      <div className="colony-header">
        <h1 className="f-serif-italic">Colony</h1>
        <p>
          {!backendOnline
            ? 'Booting AI engine…'
            : status === 'connected'
              ? `${allDeviceCount} device${allDeviceCount !== 1 ? 's' : ''} on this network`
              : status === 'loading'
                ? 'Scanning local network…'
                : `${allDeviceCount} device${allDeviceCount !== 1 ? 's' : ''} on this network`}
        </p>
      </div>

      <div className="colony-canvas-wrapper">
        <MyceliumCanvas nodeCount={allDeviceCount > 0 ? allDeviceCount * 3 + 10 : 25} connectDist={100} pulseEvery={2000} speed={0.1} />
      </div>

      {/* ── Myca Nodes ── */}
      {nodes.length > 0 && (
        <>
          <div className="section-label">
            <Globe size={14} />
            <span>Myca Nodes</span>
            <span className="section-count">{nodes.length}</span>
          </div>
          <div className="device-grid">
            {nodes.map(n => (
              <div key={n.id} className={`device-card myca-node ${n.status === 'dead' ? 'offline' : (n.status === 'ready' || n.status === 'processing' ? 'active' : 'sleeping')}`}>
                <div className="device-card-header">
                  {n.isLocal ? <Monitor size={22} /> : getIcon(n.role)}
                  <span className={`device-status ${n.status === 'dead' ? 'offline' : (n.status === 'ready' || n.status === 'processing' ? 'active' : 'sleeping')}`}>
                    {n.isLocal ? 'this device' : n.status}
                  </span>
                </div>
                <div className="device-info">
                  <h3>{n.name}</h3>
                  <div className="device-metrics">
                    <span>{n.load_pct?.toFixed(0) || 0}% load</span>
                    <span>{n.tokens_per_second?.toFixed(1) || 0} tok/s</span>
                    <span>{n.latency ? n.latency + 'ms' : 'local'}</span>
                  </div>
                  {n.source && (
                    <div className={`device-source ${n.source === 'h3_global' ? 'global' : 'local'}`}>
                      {n.source === 'h3_global' ? 'H3 Global' : 'LAN / mDNS'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── LAN Devices ── */}
      {lanDevices.length > 0 && (
        <>
          <div className="section-label">
            <Wifi size={14} />
            <span>Network Devices</span>
            <span className="section-count">{lanDevices.length}</span>
          </div>
          <div className="device-grid">
            {lanDevices.map(d => (
              <div key={d.id} className="device-card lan-device active">
                <div className="device-card-header">
                  {getIcon(d.role)}
                  <span className="device-status lan">
                    {d.role}
                  </span>
                </div>
                <div className="device-info">
                  <h3>{d.name}</h3>
                  <div className="device-metrics">
                    <span>{d.ip}</span>
                    {d.mac && <span>{d.mac}</span>}
                  </div>
                  <div className="device-source local">WiFi / LAN</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!backendOnline && nodes.length === 0 && (
        <div className="empty-colony">
          <Server size={48} strokeWidth={1} />
          <h3>Starting Myca backend…</h3>
          <p>Loading AI model and scanning your network. This may take up to a minute.</p>
        </div>
      )}
      {backendOnline && nodes.length <= 1 && lanDevices.length === 0 && (
        <div className="empty-colony">
          <Wifi size={48} strokeWidth={1} />
          <h3>Scanning your network…</h3>
          <p>Looking for devices on this WiFi / LAN. This takes a few seconds.</p>
        </div>
      )}

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
