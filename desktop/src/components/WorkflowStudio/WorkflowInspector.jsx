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
      top: 20,
      right: 20,
      width: 360,
      background: 'var(--f-bark, #141424)',
      border: '1px solid var(--f-spore, #2e6b45)',
      borderRadius: 14,
      boxShadow: '0 16px 32px rgba(0,0,0,0.45)',
      color: 'var(--f-linen, #f0f0f0)',
      zIndex: 99,
      overflow: 'hidden',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: '1px solid var(--f-soil, #3a3a4c)',
        background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={18} color="#00e87a" />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#00e87a' }}>{data?.title || 'Node Properties'}</h3>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--f-earth)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--f-soil)', background: '#0a0a14' }}>
        <button 
          onClick={() => setActiveTab('inputs')}
          style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
            color: activeTab === 'inputs' ? '#00e87a' : 'var(--f-earth)',
            borderBottom: activeTab === 'inputs' ? '2px solid #00e87a' : 'none',
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}
        >
          Inputs
        </button>
        <button 
          onClick={() => setActiveTab('general')}
          style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
            color: activeTab === 'general' ? '#00e87a' : 'var(--f-earth)',
            borderBottom: activeTab === 'general' ? '2px solid #00e87a' : 'none',
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}
        >
          General
        </button>
      </div>

      <div style={{ padding: 18, maxHeight: 380, overflowY: 'auto' }}>
        {activeTab === 'inputs' && (
          <div>
            {data?.inputs?.map((inp, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--f-earth)', marginBottom: 6 }}>
                  {inp.name.toUpperCase()}
                </label>
                <input 
                  type="text" 
                  placeholder={`Enter ${inp.name} or {{variable}}`}
                  value={localInputs[inp.name] || ''}
                  onChange={e => handleInputChange(inp.name, e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    background: '#0a0a14', border: '1px solid var(--f-soil)',
                    color: '#fff', fontSize: 13, outline: 'none'
                  }}
                />
              </div>
            ))}
            {(!data?.inputs || data.inputs.length === 0) && (
              <p style={{ color: 'var(--f-earth)', fontSize: 13, margin: 0 }}>No dynamic inputs required for this node.</p>
            )}
          </div>
        )}

        {activeTab === 'general' && (
          <div style={{ fontSize: 13 }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--f-earth)' }}>Node ID:</span>
              <code style={{ color: '#00e87a' }}>{id}</code>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--f-earth)' }}>Status:</span>
              <span style={{ color: data?.status === 'completed' ? '#00e87a' : '#ffb703', fontWeight: 600, textTransform: 'capitalize' }}>
                {data?.status || 'idle'}
              </span>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--f-earth)' }}>Category:</span>
              <span>{data?.category || 'Primitive'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowInspector;
