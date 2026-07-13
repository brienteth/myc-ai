import React, { useState, useEffect } from 'react';
import { Shield, Plus, AlertTriangle, CheckCircle2, ArrowRight, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

const Policies = () => {
  const [policies, setPolicies] = useState([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8420/automation/policies')
      .then(res => res.json())
      .then(data => setPolicies(data.policies || []))
      .catch(err => console.error("Failed to load policies:", err));
  }, []);

  const togglePolicy = (id) => {
    setPolicies(policies.map(p => 
      p.id === id ? { ...p, status: p.status === 'Active' ? 'Inactive' : 'Active' } : p
    ));
  };

  return (
    <>
      <div className="auto-header">
        <h1 className="f-serif-italic">Policy Engine</h1>
        <p>Define guardrails, approval thresholds, and security policies for agents</p>
      </div>

      <button className="primary-btn" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Plus size={16} /> Create Policy
      </button>

      <div className="auto-grid" style={{ gridTemplateColumns: '1fr' }}>
        {policies.map(p => (
          <div key={p.id} className="auto-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color={p.status === 'Active' ? 'var(--f-moss)' : 'var(--f-stone)'} />
                <h4 style={{ margin: 0, fontSize: 16 }}>{p.name}</h4>
              </div>
              <button 
                className="icon-btn" 
                onClick={() => togglePolicy(p.id)} 
                title={p.status === 'Active' ? 'Deactivate' : 'Activate'}
                style={{color: p.status === 'Active' ? 'var(--f-moss)' : 'var(--f-stone)'}}
              >
                {p.status === 'Active' ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
            </div>
            
            <div style={{ background: '#111', color: '#ffaa00', padding: '12px 16px', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              IF {p.condition}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--f-deep)', fontWeight: 500 }}>
              <ArrowRight size={14} color="var(--f-soil)" />
              THEN {p.action}
            </div>

            <div style={{fontSize: 11, color: p.status === 'Active' ? 'var(--f-moss)' : 'var(--f-stone)', fontWeight: 500}}>
              Status: {p.status}
            </div>
          </div>
        ))}
        {policies.length === 0 && <p style={{color: 'var(--f-stone)'}}>No policies configured.</p>}
      </div>
    </>
  );
};

export default Policies;
