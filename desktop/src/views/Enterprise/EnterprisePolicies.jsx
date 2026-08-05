import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Lock, Plus, AlertCircle, FileText, ToggleLeft, ToggleRight, Layers, Sliders } from 'lucide-react';
import './Enterprise.css';

const DEFAULT_POLICIES = [
  {
    id: 'POL-101',
    name: 'Single Transaction Payout Cap ($50,000)',
    category: 'BUDGET & FINANCE',
    rule: 'Block any automated driver payout exceeding $50,000 without multi-sig Passkey authorization.',
    status: 'ACTIVE',
    enforced_count: 1420,
    compliance_framework: 'SOX & Internal Controls',
  },
  {
    id: 'POL-102',
    name: 'GDPR / Data Sovereignty Region Lock',
    category: 'COMPLIANCE & PRIVACY',
    rule: 'Restrict customer PII dataset transfers strictly to EU / On-Premise Sovereign Storage nodes.',
    status: 'ACTIVE',
    enforced_count: 8940,
    compliance_framework: 'GDPR Article 44',
  },
  {
    id: 'POL-103',
    name: 'Zero Cloud Storage Egress Constraint',
    category: 'SOVEREIGNTY & INFRA',
    rule: 'Prohibit raw telemetry export to external third-party cloud S3/AWS endpoints.',
    status: 'ACTIVE',
    enforced_count: 2410,
    compliance_framework: 'ISO 27001 / Sovereign Stack',
  },
  {
    id: 'POL-104',
    name: 'Production Schema Mutation Lockdown',
    category: 'SECURITY & GOVERNANCE',
    rule: 'DDL ALTER / DROP table queries require Lead DBA Passkey verification.',
    status: 'ACTIVE',
    enforced_count: 312,
    compliance_framework: 'ISO 27001 A.12.1.2',
  }
];

const EnterprisePolicies = () => {
  const [policies, setPolicies] = useState(DEFAULT_POLICIES);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newPolicy, setNewPolicy] = useState({ name: '', category: 'COMPLIANCE & PRIVACY', rule: '', compliance_framework: '' });

  useEffect(() => {
    fetch('http://127.0.0.1:8420/enterprise/policies')
      .then(res => res.json())
      .then(data => {
        if (data.policies && data.policies.length > 0) {
          setPolicies(data.policies);
        }
      })
      .catch(() => {
        // Fallback to rich default mock dataset if offline
      });
  }, []);

  const togglePolicyStatus = (id) => {
    setPolicies(prev => prev.map(p => {
      if (p.id === id) {
        const nextStatus = p.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        return { ...p, status: nextStatus };
      }
      return p;
    }));
  };

  const handleCreatePolicy = (e) => {
    e.preventDefault();
    if (!newPolicy.name || !newPolicy.rule) return;

    const created = {
      id: `POL-${Math.floor(100 + Math.random() * 900)}`,
      name: newPolicy.name,
      category: newPolicy.category,
      rule: newPolicy.rule,
      status: 'ACTIVE',
      enforced_count: 0,
      compliance_framework: newPolicy.compliance_framework || 'Internal Governance',
    };

    setPolicies([created, ...policies]);
    setNewPolicy({ name: '', category: 'COMPLIANCE & PRIVACY', rule: '', compliance_framework: '' });
    setModalOpen(false);
  };

  const filteredPolicies = policies.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase()) ||
    p.rule.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ color: 'var(--ed-text)' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--ed-serif)', fontSize: 22, margin: '0 0 4px 0', color: 'var(--ed-text)' }}>
            Enterprise Policy Engine
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ed-text-secondary)' }}>
            Enforces Budget, Compliance (GDPR, SOX, ISO27001) & Data Sovereignty constraints prior to Driver execution.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search policies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '6px 12px',
              background: 'var(--ed-surface)',
              border: '1px solid var(--ed-card-border)',
              borderRadius: 'var(--ed-radius-xs)',
              color: 'var(--ed-text)',
              fontSize: 12,
              outline: 'none',
              width: 180
            }}
          />

          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: '6px 14px',
              background: 'var(--ed-accent)',
              color: '#FAF8F3',
              border: 'none',
              borderRadius: 'var(--ed-radius-xs)',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Plus size={15} /> Add Policy Rule
          </button>
        </div>
      </div>

      {/* Grid of Policy Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {filteredPolicies.map(pol => {
          const isActive = pol.status === 'ACTIVE';

          return (
            <div
              key={pol.id}
              style={{
                background: 'var(--ed-surface)',
                border: '1px solid var(--ed-card-border)',
                borderRadius: 'var(--ed-radius)',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                opacity: isActive ? 1 : 0.65,
                transition: 'all 0.15s ease'
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, background: 'rgba(46, 107, 69, 0.12)', color: 'var(--ed-accent)', padding: '3px 8px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.4px' }}>
                  {pol.category}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? 'var(--ed-green)' : 'var(--ed-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> {pol.status}
                  </span>
                  <button
                    onClick={() => togglePolicyStatus(pol.id)}
                    title="Toggle Policy Status"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: isActive ? 'var(--ed-accent)' : 'var(--ed-text-muted)', padding: 0 }}
                  >
                    {isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                </div>
              </div>

              {/* Policy Name & Rule */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 600, color: 'var(--ed-text)' }}>{pol.name}</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ed-text-secondary)', lineHeight: 1.45, background: 'var(--ed-glass)', padding: 10, borderRadius: 'var(--ed-radius-xs)', border: '1px solid var(--ed-card-border)' }}>
                  {pol.rule}
                </p>
              </div>

              {/* Bottom Footer Details */}
              <div style={{ fontSize: 11, color: 'var(--ed-text-muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--ed-card-border)', paddingTop: 10, marginTop: 'auto' }}>
                <span>Framework: <strong style={{ color: 'var(--ed-text-secondary)' }}>{pol.compliance_framework}</strong></span>
                <span style={{ color: 'var(--ed-accent)', fontWeight: 600 }}>{pol.enforced_count.toLocaleString()} Checks</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Policy Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(29, 29, 27, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
        }}>
          <div style={{
            background: 'var(--ed-surface)', border: '1px solid var(--ed-card-border)',
            borderRadius: 'var(--ed-radius)', width: 460, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontFamily: 'var(--ed-serif)', color: 'var(--ed-text)' }}>
              Create Sovereign Policy Rule
            </h3>

            <form onSubmit={handleCreatePolicy} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ed-text-secondary)', marginBottom: 4 }}>
                  Policy Name:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS Auto-scaling Budget Ceiling"
                  value={newPolicy.name}
                  onChange={e => setNewPolicy({ ...newPolicy, name: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'var(--ed-bg)',
                    border: '1px solid var(--ed-card-border)', borderRadius: 'var(--ed-radius-xs)',
                    color: 'var(--ed-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ed-text-secondary)', marginBottom: 4 }}>
                  Category:
                </label>
                <select
                  value={newPolicy.category}
                  onChange={e => setNewPolicy({ ...newPolicy, category: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'var(--ed-bg)',
                    border: '1px solid var(--ed-card-border)', borderRadius: 'var(--ed-radius-xs)',
                    color: 'var(--ed-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                  }}
                >
                  <option value="BUDGET & FINANCE">BUDGET & FINANCE</option>
                  <option value="COMPLIANCE & PRIVACY">COMPLIANCE & PRIVACY</option>
                  <option value="SOVEREIGNTY & INFRA">SOVEREIGNTY & INFRA</option>
                  <option value="SECURITY & GOVERNANCE">SECURITY & GOVERNANCE</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ed-text-secondary)', marginBottom: 4 }}>
                  Policy Rule Description:
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Specify constraints enforced before execution..."
                  value={newPolicy.rule}
                  onChange={e => setNewPolicy({ ...newPolicy, rule: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'var(--ed-bg)',
                    border: '1px solid var(--ed-card-border)', borderRadius: 'var(--ed-radius-xs)',
                    color: 'var(--ed-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'var(--ed-sans)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ed-text-secondary)', marginBottom: 4 }}>
                  Compliance Framework Reference:
                </label>
                <input
                  type="text"
                  placeholder="e.g. SOC2 / ISO 27001 / GDPR Art. 32"
                  value={newPolicy.compliance_framework}
                  onChange={e => setNewPolicy({ ...newPolicy, compliance_framework: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'var(--ed-bg)',
                    border: '1px solid var(--ed-card-border)', borderRadius: 'var(--ed-radius-xs)',
                    color: 'var(--ed-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '8px 14px', background: 'transparent',
                    border: '1px solid var(--ed-card-border)', borderRadius: 'var(--ed-radius-xs)',
                    fontSize: 12, color: 'var(--ed-text-secondary)', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px', background: 'var(--ed-accent)',
                    color: '#FAF8F3', border: 'none', borderRadius: 'var(--ed-radius-xs)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Save Policy Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterprisePolicies;
