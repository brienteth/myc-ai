import React, { useState, useEffect } from 'react';
import { CheckSquare, Check, X, Key, ShieldAlert } from 'lucide-react';
import './Enterprise.css';

const EnterpriseApprovals = () => {
  const [approvals, setApprovals] = useState([]);

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = () => {
    fetch('http://127.0.0.1:8420/enterprise/approvals')
      .then(res => res.json())
      .then(data => setApprovals(data.pending_approvals || []))
      .catch(err => console.error("Failed to load approvals:", err));
  };

  const handleApprove = async (approvalId) => {
    const passkey = prompt("Enter Passkey or Employee PIN to authorize execution:");
    if (passkey === null) return;

    try {
      const res = await fetch(`http://127.0.0.1:8420/enterprise/approvals/${approvalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey })
      });
      if (res.ok) {
        alert("Execution approved! Event 'ApprovalGranted' emitted to Approval Bus.");
        fetchApprovals();
      }
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleReject = async (approvalId) => {
    if (!confirm("Reject this execution request?")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8420/enterprise/approvals/${approvalId}/reject`, {
        method: 'POST'
      });
      if (res.ok) {
        alert("Execution rejected. Event 'ApprovalRejected' emitted.");
        fetchApprovals();
      }
    } catch (err) {
      alert(`Reject error: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--e-serif)', fontSize: 22, margin: '0 0 4px 0', color: 'var(--e-text)' }}>Approval Queue (Event-Driven Approval Bus)</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--e-subtext)' }}>High-risk execution steps automatically paused by Policy Engine awaiting Human authorization.</p>
      </div>

      {approvals.length === 0 ? (
        <div style={{ background: '#ffffff', border: '1px solid var(--e-border)', borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <CheckSquare size={36} color="var(--e-moss)" style={{ opacity: 0.4, marginBottom: 12 }} />
          <h3 style={{ fontFamily: 'var(--e-serif)', margin: '0 0 6px 0', color: 'var(--e-text)' }}>Approval Queue Clean</h3>
          <p style={{ fontSize: 13, color: 'var(--e-subtext)', margin: 0 }}>No pending execution approval requests.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {approvals.map(appr => (
            <div key={appr.id} style={{ background: '#ffffff', border: '1px solid var(--e-border)', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, background: 'rgba(255, 170, 0, 0.15)', color: '#b37700', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                  {appr.risk_score}
                </span>
                <span style={{ fontSize: 11, color: 'var(--e-subtext)', fontFamily: 'var(--e-mono)' }}>{appr.id}</span>
              </div>

              <h4 style={{ margin: '0 0 6px 0', fontSize: 16, color: 'var(--e-text)' }}>{appr.title}</h4>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--e-moss)', marginBottom: 10 }}>{appr.amount}</div>

              <div style={{ fontSize: 12, color: 'var(--e-subtext)', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--e-panel-bg)', padding: 10, borderRadius: 8, marginBottom: 16 }}>
                <div>Target Driver: <strong>{appr.system}</strong></div>
                <div>Required Role: <strong>{appr.required_role}</strong></div>
                <div>Requested By: <strong>{appr.requested_by}</strong></div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => handleApprove(appr.id)} style={{ flex: 1, padding: '9px', background: 'var(--e-moss)', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Check size={16} /> Approve (Passkey)
                </button>
                <button onClick={() => handleReject(appr.id)} style={{ flex: 1, padding: '9px', background: 'var(--e-panel-bg)', border: '1px solid var(--e-border)', color: '#d93838', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <X size={16} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnterpriseApprovals;
