import React, { useState, useEffect } from 'react';
import { Settings, X, Key, ShieldCheck, Lock, AlertCircle } from 'lucide-react';
import './WorkflowStudio.css';

const WorkflowInspector = ({ selectedNode, onUpdateNode, onClose }) => {
  const [activeTab, setActiveTab] = useState('inputs');
  const [localInputs, setLocalInputs] = useState({});

  useEffect(() => {
    if (selectedNode) {
      setLocalInputs(selectedNode.data?.inputsValue || {});
    } else {
      setLocalInputs({});
    }
  }, [selectedNode?.id]);

  if (!selectedNode) return null;

  const { id, data } = selectedNode;

  const handleInputChange = (name, value) => {
    const nextInputs = { ...localInputs, [name]: value };
    setLocalInputs(nextInputs);
    if (onUpdateNode) {
      onUpdateNode(id, nextInputs);
    }
  };

  // Derive inputs & credentials from manifest if available
  const skillId = data?.title || id;
  const manifest = data?.manifest || {};
  const requiredInputs = manifest.required_inputs || data?.inputs || [];
  const optionalInputs = manifest.optional_inputs || [];
  const requiredCredentials = manifest.required_credentials || [];

  return (
    <div style={{
      position: 'absolute',
      top: 24,
      right: 24,
      width: 400,
      background: 'linear-gradient(145deg, rgba(20, 22, 34, 0.95) 0%, rgba(12, 14, 24, 0.98) 100%)',
      border: '1px solid rgba(0, 232, 122, 0.35)',
      borderRadius: 16,
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 232, 122, 0.12)',
      color: '#f4f4f6',
      zIndex: 999,
      overflow: 'hidden',
      backdropFilter: 'blur(16px)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(0, 232, 122, 0.15)',
        background: 'rgba(0, 232, 122, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={18} color="#00e87a" />
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#00e87a', letterSpacing: '-0.2px' }}>
              {data?.title || 'Node Properties'}
            </h3>
            <span style={{ fontSize: 11, color: '#a0a0b2', fontFamily: 'monospace' }}>{skillId}</span>
          </div>
        </div>
        <button 
          onClick={onClose} 
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: 6, color: '#a0a0b2', cursor: 'pointer', display: 'flex'
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#090b14' }}>
        <button 
          onClick={() => setActiveTab('inputs')}
          style={{
            flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
            color: activeTab === 'inputs' ? '#00e87a' : '#a0a0b2',
            borderBottom: activeTab === 'inputs' ? '2px solid #00e87a' : '2px solid transparent',
            fontSize: 11, fontWeight: 700, cursor: 'pointer'
          }}
        >
          INPUTS & CREDENTIALS
        </button>
        <button 
          onClick={() => setActiveTab('general')}
          style={{
            flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
            color: activeTab === 'general' ? '#00e87a' : '#a0a0b2',
            borderBottom: activeTab === 'general' ? '2px solid #00e87a' : '2px solid transparent',
            fontSize: 11, fontWeight: 700, cursor: 'pointer'
          }}
        >
          MANIFEST & CAPABILITY
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: 20, maxHeight: 420, overflowY: 'auto' }}>
        {activeTab === 'inputs' && (
          <div>
            {/* Required Credentials Section */}
            {requiredCredentials.length > 0 && (
              <div style={{ marginBottom: 20, padding: 12, background: 'rgba(255, 170, 0, 0.08)', borderRadius: 10, border: '1px solid rgba(255, 170, 0, 0.25)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ffb703', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
                  <Key size={13} /> Required Secret Credentials:
                </div>
                {requiredCredentials.map((cred, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#ffc300', marginBottom: 4 }}>
                      {cred} <span style={{ color: '#ff4d4d' }}>*</span>
                    </label>
                    <input 
                      type="password" 
                      placeholder={`Secret Vault key for ${cred}`}
                      value={localInputs[cred] || ''}
                      onChange={e => handleInputChange(cred, e.target.value)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        background: '#090b14', border: '1px solid rgba(255, 195, 0, 0.3)',
                        color: '#ffffff', fontSize: 12, outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Input Parameters Section */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#00e87a', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Skill Parameters:
            </div>

            {requiredInputs.map((inp, i) => {
              const paramName = typeof inp === 'string' ? inp : inp.name;
              const paramType = typeof inp === 'object' ? inp.type : 'string';
              const paramDesc = typeof inp === 'object' ? inp.description : '';

              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#00e87a' }}>
                      {paramName} <span style={{ color: '#ff4d4d' }}>*</span>
                    </label>
                    {paramDesc && <span style={{ fontSize: 10, color: '#a0a0b2' }}>{paramDesc}</span>}
                  </div>

                  {paramType === 'textarea' ? (
                    <textarea
                      rows={3}
                      placeholder={`Value for ${paramName} or {{variables}}`}
                      value={localInputs[paramName] || ''}
                      onChange={e => handleInputChange(paramName, e.target.value)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        background: '#090b14', border: '1px solid rgba(0, 232, 122, 0.25)',
                        color: '#ffffff', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                        fontFamily: 'sans-serif'
                      }}
                    />
                  ) : (
                    <input 
                      type={paramType === 'password' ? 'password' : 'text'}
                      placeholder={`Value for ${paramName}`}
                      value={localInputs[paramName] || ''}
                      onChange={e => handleInputChange(paramName, e.target.value)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        background: '#090b14', border: '1px solid rgba(0, 232, 122, 0.25)',
                        color: '#ffffff', fontSize: 12, outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  )}
                </div>
              );
            })}

            {requiredInputs.length === 0 && requiredCredentials.length === 0 && (
              <p style={{ color: '#a0a0b2', fontSize: 12, margin: 0, fontStyle: 'italic' }}>No configurable input parameters required.</p>
            )}
          </div>
        )}

        {activeTab === 'general' && (
          <div style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0b2' }}>Node ID:</span>
              <code style={{ color: '#00e87a', background: 'rgba(0,232,122,0.1)', padding: '2px 6px', borderRadius: 4 }}>{id}</code>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0b2' }}>Status:</span>
              <span style={{ color: data?.status === 'completed' ? '#00e87a' : '#ffb703', fontWeight: 700, textTransform: 'uppercase' }}>
                {data?.status || 'idle'}
              </span>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0b2' }}>Runtime Target:</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{manifest.runtime || 'network'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowInspector;
