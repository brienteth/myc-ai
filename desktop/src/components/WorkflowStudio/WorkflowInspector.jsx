import React, { useState, useEffect } from 'react';
import { Settings, X, Cpu, Layers } from 'lucide-react';
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

  return (
    <div style={{
      position: 'absolute',
      top: 24,
      right: 24,
      width: 380,
      background: 'linear-gradient(145deg, rgba(20, 22, 34, 0.95) 0%, rgba(12, 14, 24, 0.98) 100%)',
      border: '1px solid rgba(0, 232, 122, 0.3)',
      borderRadius: 16,
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 232, 122, 0.1)',
      color: '#f4f4f6',
      zIndex: 999,
      overflow: 'hidden',
      backdropFilter: 'blur(16px)'
    }}>
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
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#00e87a', letterSpacing: '-0.2px' }}>
            {data?.title || 'Node Properties'}
          </h3>
        </div>
        <button 
          onClick={onClose} 
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: 6, color: '#a0a0b2', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#090b14' }}>
        <button 
          onClick={() => setActiveTab('inputs')}
          style={{
            flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
            color: activeTab === 'inputs' ? '#00e87a' : '#a0a0b2',
            borderBottom: activeTab === 'inputs' ? '2px solid #00e87a' : '2px solid transparent',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease'
          }}
        >
          INPUT PARAMETERS
        </button>
        <button 
          onClick={() => setActiveTab('general')}
          style={{
            flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
            color: activeTab === 'general' ? '#00e87a' : '#a0a0b2',
            borderBottom: activeTab === 'general' ? '2px solid #00e87a' : '2px solid transparent',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease'
          }}
        >
          GENERAL INFO
        </button>
      </div>

      <div style={{ padding: 20, maxHeight: 400, overflowY: 'auto' }}>
        {activeTab === 'inputs' && (
          <div>
            {data?.inputs?.map((inp, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#00e87a', textTransform: 'uppercase', tracking: '0.5px', marginBottom: 6 }}>
                  {inp.name}
                </label>
                <input 
                  type="text" 
                  placeholder={`Set ${inp.name} or {{variable}}`}
                  value={localInputs[inp.name] || ''}
                  onChange={e => handleInputChange(inp.name, e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    background: '#090b14', border: '1px solid rgba(0, 232, 122, 0.25)',
                    color: '#ffffff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={e => e.target.style.borderColor = '#00e87a'}
                  onBlur={e => e.target.style.borderColor = 'rgba(0, 232, 122, 0.25)'}
                />
              </div>
            ))}
            {(!data?.inputs || data.inputs.length === 0) && (
              <p style={{ color: '#a0a0b2', fontSize: 13, margin: 0, fontStyle: 'italic' }}>No configurable inputs required for this node.</p>
            )}
          </div>
        )}

        {activeTab === 'general' && (
          <div style={{ fontSize: 13 }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#a0a0b2' }}>Node Identifier:</span>
              <code style={{ color: '#00e87a', background: 'rgba(0,232,122,0.1)', padding: '2px 8px', borderRadius: 4 }}>{id}</code>
            </div>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#a0a0b2' }}>Execution Status:</span>
              <span style={{
                color: data?.status === 'completed' ? '#00e87a' : '#ffb703',
                fontWeight: 700, textTransform: 'uppercase', fontSize: 11,
                background: data?.status === 'completed' ? 'rgba(0,232,122,0.12)' : 'rgba(255,183,3,0.12)',
                padding: '3px 8px', borderRadius: 4
              }}>
                {data?.status || 'idle'}
              </span>
            </div>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#a0a0b2' }}>Skill Category:</span>
              <span style={{ color: '#f4f4f6', fontWeight: 600 }}>{data?.category || 'Primitive'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowInspector;
