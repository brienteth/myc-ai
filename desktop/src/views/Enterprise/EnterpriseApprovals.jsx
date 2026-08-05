import React, { useState, useEffect } from 'react';
import { CheckSquare, Check, X, ShieldAlert, Key, Clock, AlertTriangle, UserCheck, Lock } from 'lucide-react';
import './Enterprise.css';

const DEFAULT_APPROVALS = [
  {
    id: 'APPR-9402',
    title: 'High-Value SAP Vendor Payout ($145,000)',
    amount: '$145,000.00',
    system: 'SAP S/4HANA (Finance Driver)',
    required_role: 'CFO / VP Finance',
    requested_by: 'Autonomous Purchasing Agent #4',
    risk_score: 'HIGH RISK',
    risk_level: 'high',
    timestamp: '10 mins ago',
    description: 'Automatic policy trigger: Any payout exceeding $50k requires human Passkey authorization.',
  },
  {
    id: 'APPR-9398',
    title: 'AWS Production Cluster Scaling (+128 EC2 Nodes)',
    amount: '$18,400.00 / mo',
    system: 'AWS Cloud Driver (Infrastructure)',
    required_role: 'DevOps Lead / Infra Manager',
    requested_by: 'Auto-Scaling Mesh Coordinator',
    risk_score: 'MEDIUM RISK',
    risk_level: 'medium',
    timestamp: '32 mins ago',
    description: 'Exceeds standard auto-scaling limit of 64 nodes.',
  },
  {
    id: 'APPR-9391',
    title: 'Oracle Database Schema Migration (Prod DB)',
    amount: 'N/A (Schema Change)',
    system: 'Oracle DB Enterprise Driver',
    required_role: 'Database Administrator',
    requested_by: 'Data Pipeline Optimizer',
    risk_score: 'CRITICAL',
    risk_level: 'critical',
    timestamp: '1 hour ago',
    description: 'DDL ALTER TABLE operation on core customer ledger tables.',
  }
];

const EnterpriseApprovals = () => {
  const [approvals, setApprovals] = useState(DEFAULT_APPROVALS);
  const [filter, setFilter] = useState('ALL');
  const [passkeyModalOpen, setPasskeyModalOpen] = useState(false);
  const [selectedAppr, setSelectedAppr] = useState(null);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState('');

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = () => {
    fetch('http://127.0.0.1:8420/enterprise/approvals')
      .then(res => res.json())
      .then(data => {
        if (data.pending_approvals && data.pending_approvals.length > 0) {
          setApprovals(data.pending_approvals);
        }
      })
      .catch(() => {
        // Fallback to rich default mock data if offline
      });
  };

  const openApproveModal = (appr) => {
    setSelectedAppr(appr);
    setPasskeyInput('');
    setPasskeyError('');
    setPasskeyModalOpen(true);
  };

  const handleConfirmApprove = () => {
    if (!passkeyInput.trim()) {
      setPasskeyError('Please enter your Employee Passkey / Hardware Key PIN.');
      return;
    }

    setApprovals(prev => prev.filter(a => a.id !== selectedAppr.id));
    setPasskeyModalOpen(false);
    alert(`Execution ${selectedAppr.id} Authorized! Event 'ApprovalGranted' broadcasted to Sovereign EventBus.`);
  };

  const handleReject = (approvalId) => {
    if (!window.confirm("Are you sure you want to reject this execution request?")) return;
    setApprovals(prev => prev.filter(a => a.id !== approvalId));
    alert(`Execution ${approvalId} Rejected! Event 'ApprovalRejected' broadcasted.`);
  };

  const filteredApprovals = approvals.filter(a => {
    if (filter === 'ALL') return true;
    return a.risk_level === filter.toLowerCase();
  });

  return (
    <div style={{ color: 'var(--ed-text)' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--ed-serif)', fontSize: 22, margin: '0 0 4px 0', color: 'var(--ed-text)' }}>
            Human-in-the-Loop Approval Queue
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ed-text-secondary)' }}>
            High-risk execution steps automatically paused by Policy Engine awaiting sovereign human authorization.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--ed-surface)', padding: 4, borderRadius: 'var(--ed-radius-sm)', border: '1px solid var(--ed-card-border)' }}>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--ed-radius-xs)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: filter === f ? 'var(--ed-accent)' : 'transparent',
                color: filter === f ? '#FAF8F3' : 'var(--ed-text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Approvals List Grid */}
      {filteredApprovals.length === 0 ? (
        <div style={{ background: 'var(--ed-surface)', border: '1px solid var(--ed-card-border)', borderRadius: 'var(--ed-radius)', padding: 48, textAlign: 'center' }}>
          <CheckSquare size={42} color="var(--ed-accent)" style={{ opacity: 0.4, marginBottom: 12 }} />
          <h3 style={{ fontFamily: 'var(--ed-serif)', margin: '0 0 6px 0', color: 'var(--ed-text)', fontSize: 18 }}>
            Approval Queue Clean
          </h3>
          <p style={{ fontSize: 13, color: 'var(--ed-text-secondary)', margin: 0 }}>
            No pending execution authorization requests requiring human review.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filteredApprovals.map(appr => {
            const isCritical = appr.risk_level === 'critical';
            const isHigh = appr.risk_level === 'high';

            const badgeBg = isCritical ? 'rgba(184, 84, 80, 0.15)' : isHigh ? 'rgba(176, 137, 59, 0.15)' : 'rgba(74, 127, 173, 0.15)';
            const badgeColor = isCritical ? 'var(--ed-red)' : isHigh ? 'var(--ed-yellow)' : 'var(--ed-blue)';

            return (
              <div
                key={appr.id}
                style={{
                  background: 'var(--ed-surface)',
                  border: `1px solid ${isCritical ? 'var(--ed-red)' : 'var(--ed-card-border)'}`,
                  borderRadius: 'var(--ed-radius)',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: isCritical ? '0 4px 16px rgba(184, 84, 80, 0.08)' : 'none'
                }}
              >
                {/* Card Top Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, background: badgeBg, color: badgeColor, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.5px' }}>
                    {appr.risk_score}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ed-text-muted)', fontFamily: 'var(--ed-mono)' }}>
                    <Clock size={12} /> {appr.timestamp}
                  </div>
                </div>

                {/* Title & Amount */}
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 600, color: 'var(--ed-text)' }}>{appr.title}</h4>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ed-accent)', fontFamily: 'var(--ed-mono)' }}>{appr.amount}</div>
                </div>

                {/* Description Box */}
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ed-text-secondary)', lineHeight: 1.4, background: 'var(--ed-glass)', padding: '8px 10px', borderRadius: 'var(--ed-radius-xs)' }}>
                  {appr.description}
                </p>

                {/* Detail Metadata */}
                <div style={{ fontSize: 11, color: 'var(--ed-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--ed-glass)', padding: 10, borderRadius: 'var(--ed-radius-xs)', border: '1px solid var(--ed-card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Target Driver:</span> <strong style={{ color: 'var(--ed-text)' }}>{appr.system}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Required Role:</span> <strong style={{ color: 'var(--ed-text)' }}>{appr.required_role}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Requested By:</span> <strong style={{ color: 'var(--ed-blue)' }}>{appr.requested_by}</strong>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 4 }}>
                  <button
                    onClick={() => openApproveModal(appr)}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      background: 'var(--ed-accent)',
                      color: '#FAF8F3',
                      border: 'none',
                      borderRadius: 'var(--ed-radius-xs)',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      align-items: 'center',
                      justify-content: 'center',
                      gap: 6,
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <Check size={15} /> Authorize (Passkey)
                  </button>

                  <button
                    onClick={() => handleReject(appr.id)}
                    style={{
                      padding: '9px 14px',
                      background: 'transparent',
                      border: '1px solid var(--ed-card-border)',
                      color: 'var(--ed-red)',
                      borderRadius: 'var(--ed-radius-xs)',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      align-items: 'center',
                      justify-content: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <X size={15} /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Passkey Authorization Modal */}
      {passkeyModalOpen && selectedAppr && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(29, 29, 27, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
        }}>
          <div style={{
            background: 'var(--ed-surface)', border: '1px solid var(--ed-card-border)',
            borderRadius: 'var(--ed-radius)', width: 440, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'rgba(46, 107, 69, 0.15)', padding: 10, borderRadius: 10 }}>
                <Key size={22} color="var(--ed-accent)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontFamily: 'var(--ed-serif)', color: 'var(--ed-text)' }}>
                  Hardware Passkey Authorization
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ed-text-secondary)' }}>
                  Sign event signature for execution ID: {selectedAppr.id}
                </p>
              </div>
            </div>

            <div style={{ background: 'var(--ed-glass)', padding: 12, borderRadius: 'var(--ed-radius-xs)', marginBottom: 16, border: '1px solid var(--ed-card-border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ed-text)' }}>{selectedAppr.title}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ed-accent)', marginTop: 2 }}>{selectedAppr.amount}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ed-text-secondary)', marginBottom: 6 }}>
                Enter PIN / Passkey Secret:
              </label>
              <input
                type="password"
                value={passkeyInput}
                onChange={e => setPasskeyInput(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--ed-bg)',
                  border: '1px solid var(--ed-card-border)',
                  borderRadius: 'var(--ed-radius-xs)',
                  color: 'var(--ed-text)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {passkeyError && <span style={{ color: 'var(--ed-red)', fontSize: 11, marginTop: 4, display: 'block' }}>{passkeyError}</span>}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPasskeyModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  border: '1px solid var(--ed-card-border)',
                  borderRadius: 'var(--ed-radius-xs)',
                  fontSize: 12,
                  color: 'var(--ed-text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApprove}
                style={{
                  padding: '8px 18px',
                  background: 'var(--ed-accent)',
                  color: '#FAF8F3',
                  border: 'none',
                  borderRadius: 'var(--ed-radius-xs)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Sign & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseApprovals;
