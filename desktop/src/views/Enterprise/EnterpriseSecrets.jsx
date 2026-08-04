import React, { useState, useEffect } from 'react';
import { Key, ShieldCheck, Lock, RefreshCw } from 'lucide-react';
import './Enterprise.css';

const EnterpriseSecrets = () => {
  const [secrets, setSecrets] = useState([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8420/enterprise/secrets')
      .then(res => res.json())
      .then(data => setSecrets(data.secrets || []))
      .catch(err => console.error("Failed to load secrets:", err));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--e-serif)', fontSize: 22, margin: '0 0 4px 0', color: 'var(--e-text)' }}>OS-Native Secrets Vault & Keyring</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--e-subtext)' }}>Encrypted credentials stored in OS Keyrings (macOS Keychain / Windows Credential Manager). SQLite holds metadata only.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
        {secrets.map(sec => (
          <div key={sec.id} style={{ background: '#ffffff', border: '1px solid var(--e-border)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, background: 'rgba(0, 232, 122, 0.15)', color: '#008a47', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                {sec.status}
              </span>
              <Lock size={14} color="var(--e-moss)" />
            </div>

            <h4 style={{ margin: '0 0 4px 0', fontSize: 16, color: 'var(--e-text)' }}>{sec.name}</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--e-subtext)' }}>Provider: <strong>{sec.provider}</strong></p>

            <div style={{ fontSize: 12, background: 'var(--e-panel-bg)', padding: 10, borderRadius: 8, fontFamily: 'var(--e-mono)', color: 'var(--e-subtext)', marginBottom: 14 }}>
              Payload: •••••••••••••••••••••
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--e-subtext)' }}>
              <span>Rotated: {sec.last_rotated}</span>
              <button onClick={() => alert(`Rotated ${sec.name}`)} style={{ border: 'none', background: 'transparent', color: 'var(--e-moss)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <RefreshCw size={12} /> Rotate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EnterpriseSecrets;
