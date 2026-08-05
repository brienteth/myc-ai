import React, { useState, useEffect } from 'react';
import { Key, ShieldCheck, Lock, RefreshCw, Link as LinkIcon, Server, Shield, Bitcoin, Database, Activity, History } from 'lucide-react';
import './Enterprise.css';

const EnterpriseSecrets = () => {
  const [activeTab, setActiveTab] = useState('vault');
  const [overview, setOverview] = useState(null);
  const [vault, setVault] = useState([]);
  const [connections, setConnections] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [sshKeys, setSshKeys] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [rotation, setRotation] = useState([]);
  const [audit, setAudit] = useState([]);
  const [live, setLive] = useState(null);

  const [selectedSecret, setSelectedSecret] = useState(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8420/enterprise/secrets/overview').then(r=>r.json()).then(d=>setOverview(d.overview)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/secrets/vault').then(r=>r.json()).then(d=>setVault(d.vault)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/secrets/connections').then(r=>r.json()).then(d=>setConnections(d.connections)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/secrets/certificates').then(r=>r.json()).then(d=>setCertificates(d.certificates)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/secrets/ssh').then(r=>r.json()).then(d=>setSshKeys(d.ssh)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/secrets/wallets').then(r=>r.json()).then(d=>setWallets(d.wallets)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/secrets/rotation').then(r=>r.json()).then(d=>setRotation(d.rotation)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/secrets/audit').then(r=>r.json()).then(d=>setAudit(d.audit)).catch(e=>console.error(e));
    fetch('http://127.0.0.1:8420/enterprise/secrets/live').then(r=>r.json()).then(d=>setLive(d.live)).catch(e=>console.error(e));
    
    const intv = setInterval(() => {
      fetch('http://127.0.0.1:8420/enterprise/secrets/live').then(r=>r.json()).then(d=>setLive(d.live)).catch(e=>console.error(e));
    }, 2000);
    return () => clearInterval(intv);
  }, []);

  return (
    <div className="secrets-container">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--ed-serif)', fontSize: 24, margin: '0 0 6px 0', color: 'var(--ed-text)' }}>OS-Native Secrets Vault</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ed-text-muted)' }}>Encrypted credentials stored in OS Keychains. Plaintext is never exposed to the frontend.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="exec-btn secondary"><Shield size={14} /> Security Scan</button>
          <button className="exec-btn primary"><Key size={14} /> New Secret</button>
        </div>
      </div>

      {/* Top KPI Grid */}
      {overview && (
        <div className="analytics-kpi-grid">
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-title">Total Secrets</div>
            <div className="analytics-kpi-value">{overview.total_secrets}</div>
            <div className="analytics-kpi-trend up">{overview.healthy} Healthy</div>
          </div>
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-title">Expiring Soon</div>
            <div className="analytics-kpi-value" style={{color:'var(--ed-yellow)'}}>{overview.expiring_soon}</div>
            <div className="analytics-kpi-trend">Rotation Required</div>
          </div>
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-title">Compromised</div>
            <div className="analytics-kpi-value" style={{color: overview.compromised > 0 ? 'var(--ed-red)' : 'var(--ed-green)'}}>{overview.compromised}</div>
            <div className={`analytics-kpi-trend ${overview.compromised === 0 ? 'up' : 'down'}`}>Zero Trust Enforced</div>
          </div>
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-title">Encryption Engine</div>
            <div className="analytics-kpi-value" style={{fontSize: 20}}>{overview.encryption}</div>
            <div className="analytics-kpi-trend">Hardware Backed</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="analytics-tabs">
        <div className={`analytics-tab ${activeTab === 'vault' ? 'active' : ''}`} onClick={() => setActiveTab('vault')}>Vault</div>
        <div className={`analytics-tab ${activeTab === 'connections' ? 'active' : ''}`} onClick={() => setActiveTab('connections')}>Connections</div>
        <div className={`analytics-tab ${activeTab === 'certificates' ? 'active' : ''}`} onClick={() => setActiveTab('certificates')}>Certificates</div>
        <div className={`analytics-tab ${activeTab === 'ssh' ? 'active' : ''}`} onClick={() => setActiveTab('ssh')}>SSH Keys</div>
        <div className={`analytics-tab ${activeTab === 'wallets' ? 'active' : ''}`} onClick={() => setActiveTab('wallets')}>Wallets</div>
        <div className={`analytics-tab ${activeTab === 'rotation' ? 'active' : ''}`} onClick={() => setActiveTab('rotation')}>Rotation</div>
        <div className={`analytics-tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Access Audit</div>
      </div>

      {/* Tab Content: Vault */}
      {activeTab === 'vault' && (
        <div className="secrets-table-wrap">
          <table className="secrets-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Environment</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {vault.map(sec => (
                <tr key={sec.id} onClick={() => setSelectedSecret(sec)}>
                  <td style={{fontWeight:600}}><Key size={14} style={{marginRight:8, color:'var(--ed-text-muted)'}}/>{sec.name}</td>
                  <td><span className="secrets-type-badge">{sec.type}</span></td>
                  <td>{sec.env}</td>
                  <td>{sec.owner}</td>
                  <td><span className={`secrets-status-badge ${sec.status === 'Healthy' ? 'healthy' : 'restricted'}`}>{sec.status}</span></td>
                  <td style={{fontFamily:'var(--ed-mono)'}}>{sec.expires}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content: Connections */}
      {activeTab === 'connections' && (
        <div className="crypto-card-grid">
          {connections.map((conn, i) => (
            <div key={i} className="crypto-card">
              <div className="crypto-card-header">
                <div>
                  <div className="crypto-card-title">{conn.name}</div>
                  <div className="crypto-card-sub">{conn.desc}</div>
                </div>
                <div className="crypto-card-icon"><LinkIcon size={16} color="var(--ed-accent)"/></div>
              </div>
              <div className="crypto-card-body">
                <span className={`secrets-status-badge ${conn.status.includes('Active') || conn.status.includes('Connected') || conn.status.includes('Valid') || conn.status.includes('Healthy') || conn.status.includes('Installed') ? 'healthy' : ''}`}>{conn.status}</span>
              </div>
              <div className="crypto-card-actions">
                <button className="crypto-card-btn">Test</button>
                <button className="crypto-card-btn">Reconnect</button>
                <button className="crypto-card-btn">Logs</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: Certificates */}
      {activeTab === 'certificates' && (
        <div className="crypto-card-grid">
          {certificates.map((cert, i) => (
            <div key={i} className="crypto-card">
              <div className="crypto-card-header">
                <div>
                  <div className="crypto-card-title">{cert.domain}</div>
                  <div className="crypto-card-sub">{cert.type}</div>
                </div>
                <div className="crypto-card-icon"><ShieldCheck size={16} color="var(--ed-green)"/></div>
              </div>
              <div className="crypto-card-body">
                <div className="crypto-card-row"><span className="lbl">Issuer</span><span className="val">{cert.issuer}</span></div>
                <div className="crypto-card-row"><span className="lbl">Expires</span><span className="val">{cert.expires}</span></div>
                <div style={{marginTop: 8}}>
                  <span className={`secrets-status-badge ${cert.status === 'Healthy' ? 'healthy' : 'restricted'}`}>{cert.status}</span>
                </div>
              </div>
              <div className="crypto-card-actions">
                <button className="crypto-card-btn">Renew</button>
                <button className="crypto-card-btn">Replace</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: SSH Keys */}
      {activeTab === 'ssh' && (
        <div className="crypto-card-grid">
          {sshKeys.map((ssh, i) => (
            <div key={i} className="crypto-card">
              <div className="crypto-card-header">
                <div>
                  <div className="crypto-card-title">{ssh.name}</div>
                  <div className="crypto-card-sub">{ssh.permissions}</div>
                </div>
                <div className="crypto-card-icon"><Server size={16} color="var(--ed-yellow)"/></div>
              </div>
              <div className="crypto-card-body">
                <div className="crypto-card-row" style={{flexDirection:'column'}}>
                  <span className="lbl" style={{marginBottom:4}}>Fingerprint</span>
                  <span className="val" style={{fontSize:10, wordBreak:'break-all'}}>{ssh.fingerprint}</span>
                </div>
                <div className="crypto-card-row" style={{marginTop:12}}><span className="lbl">Last Used</span><span className="val">{ssh.used}</span></div>
              </div>
              <div className="crypto-card-actions">
                <button className="crypto-card-btn">Rotate</button>
                <button className="crypto-card-btn">Disable</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: Wallets */}
      {activeTab === 'wallets' && (
        <div className="crypto-card-grid">
          {wallets.map((wallet, i) => (
            <div key={i} className="crypto-card">
              <div className="crypto-card-header">
                <div>
                  <div className="crypto-card-title">{wallet.name}</div>
                  <div className="crypto-card-sub">{wallet.chain}</div>
                </div>
                <div className="crypto-card-icon"><Bitcoin size={16} color="#f7931a"/></div>
              </div>
              <div className="crypto-card-body">
                <div className="crypto-card-row" style={{flexDirection:'column'}}>
                  <span className="lbl" style={{marginBottom:4}}>Address</span>
                  <span className="val" style={{fontSize:11}}>{wallet.address}</span>
                </div>
                <div className="crypto-card-row" style={{marginTop:12}}><span className="lbl">Balance</span><span className="val" style={{color:'var(--ed-green)'}}>{wallet.balance}</span></div>
                <div className="crypto-card-row"><span className="lbl">Policy</span><span className="val">{wallet.policy}</span></div>
                <div className="crypto-card-row"><span className="lbl">Signers</span><span className="val">{wallet.signers}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: Rotation & Audit */}
      {(activeTab === 'rotation' || activeTab === 'audit') && (
        <div className="secrets-table-wrap">
          {activeTab === 'rotation' && (
            <table className="secrets-table">
              <thead>
                <tr>
                  <th>Secret Target</th>
                  <th>Type</th>
                  <th>Rotation Due</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rotation.map((rot, i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600}}><RefreshCw size={14} style={{marginRight:8, color:'var(--ed-text-muted)'}}/>{rot.name}</td>
                    <td><span className="secrets-type-badge">{rot.type}</span></td>
                    <td style={{color: rot.due.includes('Tomorrow') || rot.due.includes('Days') ? 'var(--ed-yellow)' : 'var(--ed-text)'}}>{rot.due}</td>
                    <td><button className="crypto-card-btn">Rotate Now</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {activeTab === 'audit' && (
            <table className="secrets-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User / Entity</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((aud, i) => (
                  <tr key={i}>
                    <td style={{fontFamily:'var(--ed-mono)'}}>{aud.time}</td>
                    <td>{aud.user}</td>
                    <td style={{fontWeight:600, color:'var(--ed-text)'}}>{aud.action}</td>
                    <td>{aud.target}</td>
                    <td><span className={`secrets-status-badge ${aud.status === 'Success' ? 'healthy' : 'restricted'}`}>{aud.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Live Dashboard Strip */}
      {live && (
        <div className="analytics-live-strip">
          <div className="live-metric">
            <div className="live-metric-lbl">Vault Health</div>
            <div className="live-metric-val"><div className="live-indicator"></div> {live.vault}</div>
          </div>
          <div className="live-metric">
            <div className="live-metric-lbl">Live Connections</div>
            <div className="live-metric-val" style={{color:'var(--ed-text)'}}>{live.connections}</div>
          </div>
          <div className="live-metric">
            <div className="live-metric-lbl">Auth Failures</div>
            <div className="live-metric-val" style={{color: live.auth_failures > 0 ? 'var(--ed-red)' : 'var(--ed-text)'}}>{live.auth_failures}</div>
          </div>
          <div className="live-metric">
            <div className="live-metric-lbl">Requests / Sec</div>
            <div className="live-metric-val" style={{color:'var(--ed-text)'}}>{live.requests_per_sec}</div>
          </div>
        </div>
      )}

      {/* Secret Detail Modal */}
      {selectedSecret && (
        <div className="vault-modal-overlay" onClick={() => setSelectedSecret(null)}>
          <div className="vault-modal" onClick={e => e.stopPropagation()}>
            <div className="vault-modal-header">
              <h3 className="vault-modal-title">{selectedSecret.name}</h3>
              <button className="vault-modal-close" onClick={() => setSelectedSecret(null)}>✕</button>
            </div>
            <div className="vault-modal-body">
              <div className="vault-field-group">
                <div className="vault-field"><div className="vault-field-label">Environment</div><div className="vault-field-value">{selectedSecret.env}</div></div>
                <div className="vault-field"><div className="vault-field-label">Owner</div><div className="vault-field-value">{selectedSecret.owner}</div></div>
              </div>
              <div className="vault-field-group">
                <div className="vault-field"><div className="vault-field-label">Expiration</div><div className="vault-field-value">{selectedSecret.expires}</div></div>
                <div className="vault-field"><div className="vault-field-label">Rotation</div><div className="vault-field-value">{selectedSecret.rotation_policy}</div></div>
              </div>
              <div className="vault-field">
                <div className="vault-field-label">Usage</div>
                <div className="vault-field-value">{selectedSecret.usage}</div>
              </div>
              <div className="vault-field">
                <div className="vault-field-label">Permissions</div>
                <div className="vault-field-value" style={{display:'flex', gap:8, marginTop:4}}>
                  {selectedSecret.permissions.map(p => <span key={p} className="secrets-type-badge">{p}</span>)}
                </div>
              </div>
              <div className="vault-payload-box">
                Payload: ••••••••••••••••••••••••••••••
              </div>
            </div>
            <div className="vault-modal-footer">
              <button className="exec-btn secondary" onClick={() => setSelectedSecret(null)}>Close</button>
              <div style={{display:'flex', gap:10}}>
                <button className="exec-btn secondary">Copy URI</button>
                <button className="exec-btn primary" onClick={() => alert("Requires biometric / hardware key auth to reveal plaintext.")}>Reveal</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EnterpriseSecrets;
