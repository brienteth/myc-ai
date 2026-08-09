import React, { useEffect } from 'react';
import { Monitor, Smartphone, Server, Laptop, Wifi, Router, Tv, Printer, HardDrive, Globe, Shield } from 'lucide-react';
import MyceliumCanvas from '../components/MyceliumCanvas';
import { useNodes, nodeNickname } from '../hooks/useNodes';
import './Colony.css';

const Devices = () => {
  const { 
    nodes, 
    lanDevices, 
    status, 
    backendOnline, 
    pairingStatus, 
    mobileId, 
    pairingCode,
    approveNode, 
    declineNode,
    revokeNode
  } = useNodes();

  const getIcon = (role) => {
    switch(role) {
      case 'phone': return <Smartphone size={22} />;
      case 'mobile_web': return <Smartphone size={22} />;
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
      const isElectron = /Electron/i.test(navigator.userAgent);
      const isFileProtocol = window.location.protocol === 'file:';
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const backendUrl = (isLocalHost || isElectron || isFileProtocol || !window.location.hostname)
        ? 'http://127.0.0.1:8420' : window.location.origin;
      fetch(`${backendUrl}/lan/scan`, { method: 'POST' }).catch(() => {});
    }
  }, [backendOnline]);

  const pendingNodes = nodes.filter(n => n.status === 'pending');
  const activeNodes = nodes.filter(n => n.status !== 'pending');
  const allDeviceCount = activeNodes.length + lanDevices.length;

  // Render Mobile/Remote client pairing screen
  if (pairingStatus === 'pending' || pairingStatus === 'declined') {
    const code = pairingCode ? String(pairingCode).replace(/(\d{3})(\d{3})/, '$1 $2') : '------';
    return (
      <div className="pairing-overlay">
        <div className="pairing-card">
          <Smartphone size={48} className="pairing-icon" />
          <h2 className="f-serif-italic">Pair Device to Colony</h2>
          <p className="pairing-subtitle">
            To securely connect this mobile device to your Myca cluster, please approve it on your desktop app.
          </p>
          <div className="pairing-code-box">
            <span className="pairing-code-label">SECURITY CODE</span>
            <span className="pairing-code">{code}</span>
          </div>
          {pairingStatus === 'declined' ? (
            <div className="pairing-declined-alert">
              <span>Connection was declined.</span>
              <button onClick={() => window.location.reload()} className="retry-btn">Retry Connection</button>
            </div>
          ) : (
            <div className="pairing-pulse-loader">
              <span className="pulse-dot"></span>
              <span>Waiting for approval on desktop…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

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

      {/* ── Pending Pairing Requests ── */}
      {pendingNodes.length > 0 && (
        <div className="pending-approvals-section">
          <div className="section-label approval-section-label">
            <Smartphone size={14} />
            <span>Pairing Requests</span>
            <span className="section-count alert-count">{pendingNodes.length}</span>
          </div>
          <div className="approval-list">
            {pendingNodes.map(pn => {
              const code = pn.code ? String(pn.code).replace(/(\d{3})(\d{3})/, '$1 $2') : '------';
              return (
                <div key={pn.id} className="approval-card">
                  <div className="approval-card-info">
                    <Smartphone className="approval-device-icon" size={24} />
                    <div>
                      <h4>{pn.name}</h4>
                      <p>Wishes to pair with your cluster • Security Code: <strong className="code-highlight">{code}</strong></p>
                    </div>
                  </div>
                  <div className="approval-actions">
                    <button className="approve-btn" onClick={() => approveNode(pn.id)}>Approve</button>
                    <button className="decline-btn" onClick={() => declineNode(pn.id)}>Decline</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Myca Nodes ── */}
      {activeNodes.length > 0 && (
        <>
          <div className="section-label">
            <Globe size={14} />
            <span>Myca Nodes</span>
            <span className="section-count">{activeNodes.length}</span>
          </div>
          <div className="device-grid">
            {activeNodes.map(n => (
              <div key={n.id} className={`device-card myca-node ${n.status === 'dead' ? 'offline' : (n.status === 'ready' || n.status === 'processing' || n.status === 'approved' ? 'active' : 'sleeping')}`}>
                <div className="device-card-header">
                  {n.isLocal ? <Monitor size={22} /> : getIcon(n.role)}
                  <span className={`device-status ${n.status === 'dead' ? 'offline' : (n.status === 'ready' || n.status === 'processing' || n.status === 'approved' ? 'active' : 'sleeping')}`}>
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
                  <div style={{ marginTop: '8px', padding: '4px 8px', background: 'rgba(46, 107, 69, 0.05)', border: '1px dashed rgba(46, 107, 69, 0.15)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--f-humus)', fontWeight: 500 }}>Mycelium Score</span>
                    <span style={{ fontSize: '11px', color: 'var(--f-moss)', fontWeight: 700, fontFamily: 'var(--f-mono)' }}>
                      {n.mycelium_score?.toFixed(1) || '70.0'}
                    </span>
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

      {/* ── Tensor Parallelism Visualizer ── */}
      <div style={{ background: 'var(--f-parchment)', border: '1px solid var(--f-bark)', borderRadius: '16px', padding: '24px', margin: '24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', color: 'var(--f-deep)', fontFamily: 'var(--f-serif)' }}>Tensor Parallelism & Model Sharding</h3>
            <p style={{ fontSize: '12px', color: 'var(--f-soil)', margin: 0 }}>Model layers automatically split across available network nodes for zero-vram-bottleneck inference.</p>
          </div>
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', background: 'rgba(46, 107, 69, 0.12)', color: 'var(--f-moss)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
            QUIC HTTP/3 Active
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ background: 'var(--f-cream)', border: '1px solid var(--f-bark)', padding: '14px', borderRadius: '10px' }}>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--f-moss)', fontWeight: 600 }}>Local Node (This Device)</div>
            <div style={{ fontSize: '13px', color: 'var(--f-humus)', margin: '4px 0 8px 0', fontWeight: 500 }}>Layers 0 – 16 (Attention Head 0-16)</div>
            <div style={{ height: '4px', background: 'var(--f-moss)', borderRadius: '2px' }} />
          </div>
          <div style={{ background: 'var(--f-cream)', border: '1px solid var(--f-bark)', padding: '14px', borderRadius: '10px' }}>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--f-moss)', fontWeight: 600 }}>
              {nodes.length > 1 ? nodes[1].name : 'Colony Mesh Peer'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--f-humus)', margin: '4px 0 8px 0', fontWeight: 500 }}>Layers 17 – 32 (FeedForward 17-32)</div>
            <div style={{ height: '4px', background: '#3F8C59', borderRadius: '2px' }} />
          </div>
        </div>
      </div>

      {/* ── Trusted Devices ── */}
      {nodes.some(n => n.source === 'trusted_db') && (
        <>
          <div className="section-label">
            <Shield size={14} />
            <span>Trusted Paired Devices</span>
            <span className="section-count">{nodes.filter(n => n.source === 'trusted_db').length}</span>
          </div>
          <div className="device-grid">
            {nodes.filter(n => n.source === 'trusted_db').map(n => (
              <div key={n.id} className={`device-card trusted-device ${n.status === 'connected' ? 'active' : 'offline'}`}>
                <div className="device-card-header">
                  {getIcon(n.role)}
                  <span className={`device-status ${n.status === 'connected' ? 'ready' : 'offline'}`}>
                    {n.status === 'connected' ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="device-info">
                  <h3>{n.name}</h3>
                  <div className="device-metrics">
                    {n.fingerprint && <span style={{ fontSize: '10px', opacity: 0.6 }}>Fingerprint: {n.fingerprint}</span>}
                  </div>
                  <div className="device-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button className="revoke-btn" style={{
                      padding: '4px 8px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '4px',
                      color: '#ef4444',
                      fontSize: '11px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }} onClick={() => revokeNode(n.id)}>Revoke Trust</button>
                  </div>
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
      {backendOnline && status === 'loading' && nodes.length <= 1 && lanDevices.length === 0 && (
        <div className="empty-colony">
          <Wifi size={48} strokeWidth={1} />
          <h3>Scanning your network…</h3>
          <p>Looking for devices on this WiFi / LAN. This takes a few seconds.</p>
        </div>
      )}
      {backendOnline && status !== 'loading' && nodes.length <= 1 && lanDevices.length === 0 && (
        <div className="empty-colony">
          <Wifi size={48} strokeWidth={1} />
          <h3>Only this device found</h3>
          <p>No other Myca nodes or network devices detected. Connect more devices to the same WiFi to grow your Colony.</p>
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

