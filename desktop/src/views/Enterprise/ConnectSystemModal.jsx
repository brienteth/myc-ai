import React, { useState } from 'react';
import { X, Check, Loader2, Server, ShieldCheck, Cpu, Zap, Database } from 'lucide-react';

const AVAILABLE_SYSTEMS = [
  { id: 'sap', name: 'SAP S/4HANA', vendor: 'SAP SE', category: 'ERP', icon: 'SAP' },
  { id: 'oracle', name: 'Oracle ERP Cloud', vendor: 'Oracle Corp', category: 'ERP', icon: 'ORA' },
  { id: 'salesforce', name: 'Salesforce CRM', vendor: 'Salesforce Inc', category: 'CRM', icon: 'SF' },
  { id: 'netsuite', name: 'Oracle NetSuite', vendor: 'Oracle', category: 'ERP', icon: 'NS' },
  { id: 'dynamics', name: 'Microsoft Dynamics 365', vendor: 'Microsoft', category: 'ERP', icon: 'D365' },
  { id: 'hubspot', name: 'HubSpot CRM', vendor: 'HubSpot', category: 'CRM', icon: 'HS' },
  { id: 'slack', name: 'Slack Enterprise Grid', vendor: 'Salesforce', category: 'Cloud', icon: 'SLK' },
  { id: 'github', name: 'GitHub Enterprise Server', vendor: 'Microsoft', category: 'Cloud', icon: 'GH' },
  { id: 'stripe', name: 'Stripe Billing & Payments', vendor: 'Stripe Inc', category: 'Finance', icon: 'STR' },
  { id: 'google', name: 'Google Workspace Enterprise', vendor: 'Google', category: 'Cloud', icon: 'GWS' },
  { id: 'custom', name: 'Custom REST / gRPC Gateway', vendor: 'Internal', category: 'Custom', icon: 'API' }
];

const ConnectSystemModal = ({ isOpen, onClose, onConnected }) => {
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [step, setStep] = useState(0); // 0: select, 1: connecting steps, 2: done

  const stepsList = [
    'Installing Driver Package...',
    'Authenticating with Provider...',
    'Performing System Health Check...',
    'Discovering Capabilities...',
    'Indexing Schema & Objects...',
    'System Ready & Registered'
  ];

  if (!isOpen) return null;

  const handleStartConnect = async () => {
    if (!selectedSystem) return;
    setConnecting(true);
    setStep(1);

    for (let i = 0; i < stepsList.length; i++) {
      setStep(i + 1);
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      await fetch('http://127.0.0.1:8420/enterprise/systems/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_type: selectedSystem.name })
      });
    } catch (e) {
      console.error(e);
    }

    setConnecting(false);
    if (onConnected) onConnected();
    onClose();
  };

  return (
    <div className="connect-modal-overlay" onClick={onClose}>
      <div className="connect-modal" onClick={e => e.stopPropagation()}>
        <div className="connect-modal-header">
          <h3>Connect System Provider</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ed-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="connect-modal-body">
          {connecting ? (
            <div style={{ padding: '30px 20px', textAlign: 'center' }}>
              <Loader2 size={32} className="spin" style={{ color: 'var(--ed-green)', marginBottom: 16 }} />
              <h4 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Connecting {selectedSystem?.name}</h4>
              <div style={{ fontSize: 13, color: 'var(--ed-green)', fontWeight: 600 }}>
                {stepsList[step - 1] || 'Initializing...'}
              </div>
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                {stepsList.map((s, idx) => (
                  <div key={idx} style={{
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: idx + 1 < step ? 'var(--ed-green)' : idx + 1 === step ? 'var(--ed-text)' : 'var(--ed-text-muted)'
                  }}>
                    {idx + 1 < step ? <Check size={13} color="var(--ed-green)" /> : <span style={{ width: 13, height: 13, display: 'inline-block' }} />}
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--ed-text-secondary)' }}>
                Select an enterprise software provider. Myca will register it as a System Provider in the Digital Infrastructure Layer.
              </p>
              {AVAILABLE_SYSTEMS.map(sys => (
                <div
                  key={sys.id}
                  className={`connect-system-option ${selectedSystem?.id === sys.id ? 'selected' : ''}`}
                  onClick={() => setSelectedSystem(sys)}
                >
                  <div className="connect-system-icon">{sys.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ed-text)' }}>{sys.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--ed-text-muted)' }}>{sys.vendor} · {sys.category}</div>
                  </div>
                  {selectedSystem?.id === sys.id && <Check size={16} color="var(--ed-green)" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="connect-modal-footer">
          <button className="dash-btn" onClick={onClose} disabled={connecting}>Cancel</button>
          <button
            className="dash-btn dash-btn-primary"
            onClick={handleStartConnect}
            disabled={!selectedSystem || connecting}
          >
            Connect System
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectSystemModal;
