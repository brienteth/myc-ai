import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Lock } from 'lucide-react';
import './Enterprise.css';

const EnterprisePolicies = () => {
  const [policies, setPolicies] = useState([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8420/enterprise/policies')
      .then(res => res.json())
      .then(data => setPolicies(data.policies || []))
      .catch(err => console.error("Failed to load policies:", err));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--e-serif)', fontSize: 22, margin: '0 0 4px 0', color: 'var(--e-text)' }}>Enterprise Policy Engine</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--e-subtext)' }}>Enforces Budget, Compliance (GDPR, SOX, ISO27001), Country & Identity constraints prior to Driver execution.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
        {policies.map(pol => (
          <div key={pol.id} style={{ background: '#ffffff', border: '1px solid var(--e-border)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, background: 'rgba(46, 107, 69, 0.1)', color: 'var(--e-moss)', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                {pol.category}
              </span>
              <span className="status-badge healthy"><CheckCircle2 size={12} inline="true" /> {pol.status}</span>
            </div>

            <h4 style={{ margin: '0 0 6px 0', fontSize: 16, color: 'var(--e-text)' }}>{pol.name}</h4>
            <p style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--e-subtext)', lineHeight: 1.4 }}>{pol.rule}</p>

            <div style={{ fontSize: 11, color: 'var(--e-subtext)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--e-border)', paddingTop: 10 }}>
              <span>Total Enforcements:</span>
              <strong style={{ color: 'var(--e-moss)' }}>{pol.enforced_count} Executions Checked</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EnterprisePolicies;
