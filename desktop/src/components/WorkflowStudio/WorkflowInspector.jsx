import React, { useState, useEffect } from 'react';
import { Settings, Info, Key, Activity, Clock } from 'lucide-react';
import './WorkflowStudio.css';

const WorkflowInspector = ({ selectedNode, onUpdateNode, onClose }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [localInputs, setLocalInputs] = useState({});

  useEffect(() => {
    if (selectedNode) {
      setLocalInputs(selectedNode.data?.inputsValue || {});
    } else {
      setLocalInputs({});
    }
  }, [selectedNode?.id]);

  if (!selectedNode) {
    return (
      <div className="workflow-inspector empty">
        <div className="empty-state">
          <Settings size={24} style={{ opacity: 0.5, marginBottom: 12 }} />
          <p>Select a node to inspect</p>
        </div>
      </div>
    );
  }

  const { id, data } = selectedNode;

  const handleInputChange = (name, value) => {
    const nextInputs = { ...localInputs, [name]: value };
    setLocalInputs(nextInputs);
    if (onUpdateNode) {
      onUpdateNode(id, nextInputs);
    }
  };

  return (
    <div className="workflow-inspector">
      <div className="inspector-header">
        <h3>{data?.title || 'Node Properties'}</h3>
      </div>
      
      <div className="inspector-tabs">
        <button className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')}>General</button>
        <button className={activeTab === 'inputs' ? 'active' : ''} onClick={() => setActiveTab('inputs')}>Inputs</button>
        <button className={activeTab === 'outputs' ? 'active' : ''} onClick={() => setActiveTab('outputs')}>Outputs</button>
      </div>

      <div className="inspector-content">
        {activeTab === 'general' && (
          <div className="inspector-pane">
            <div className="prop-group">
              <label>Skill ID</label>
              <div className="prop-val">{data?.id || 'unknown'}</div>
            </div>
            <div className="prop-group">
              <label>Status</label>
              <div className="prop-val" style={{ textTransform: 'capitalize' }}>{data?.status || 'idle'}</div>
            </div>
            <div className="prop-group">
              <label>Duration</label>
              <div className="prop-val">{data?.time || '-'}</div>
            </div>
            <div className="prop-group">
              <label>Permissions</label>
              <div className="prop-val" style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span className="permission-tag">filesystem.read</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inputs' && (
          <div className="inspector-pane">
            {data?.inputs?.map((inp, i) => (
              <div key={i} className="prop-group">
                <label>{inp.name}</label>
                <input 
                  type="text" 
                  className="inspector-input" 
                  placeholder="Enter value or {{variable}}"
                  value={localInputs[inp.name] || ''}
                  onChange={e => handleInputChange(inp.name, e.target.value)}
                />
              </div>
            ))}
            {(!data?.inputs || data.inputs.length === 0) && (
              <p style={{ color: 'var(--f-earth)', fontSize: 13 }}>No inputs required.</p>
            )}
          </div>
        )}

        {activeTab === 'outputs' && (
          <div className="inspector-pane">
            {data?.outputs?.map((out, i) => (
              <div key={i} className="prop-group">
                <label>{out.name}</label>
                <div className="prop-val monospace">typeof String</div>
              </div>
            ))}
            {(!data?.outputs || data.outputs.length === 0) && (
              <p style={{ color: 'var(--f-earth)', fontSize: 13 }}>No outputs emitted.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowInspector;
