import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BrainCircuit, MessageSquare, Terminal, Package, CheckCircle2 } from 'lucide-react';
import './WorkflowStudio.css';

const SystemNode = ({ data }) => {
  const getIcon = () => {
    switch (data.type) {
      case 'need': return <MessageSquare size={18} color="var(--f-stone)" />;
      case 'planner': return <BrainCircuit size={18} color="var(--f-moss)" />;
      case 'graph': return <Terminal size={18} color="var(--f-earth)" />;
      case 'artifacts': return <Package size={18} color="var(--f-soil)" />;
      case 'done': return <CheckCircle2 size={18} color="var(--f-alive)" />;
      default: return null;
    }
  };

  const getStyle = () => {
    switch (data.type) {
      case 'need': 
        return { background: 'var(--f-cream)', border: '1px solid var(--f-bark)' };
      case 'planner': 
        return { background: 'var(--f-linen)', border: '1px solid var(--f-moss)' };
      case 'graph': 
        return { background: 'var(--f-parchment)', border: '1px dashed var(--f-earth)' };
      case 'artifacts': 
        return { background: 'var(--f-cream)', border: '1px solid var(--f-soil)' };
      case 'done': 
        return { background: 'var(--f-linen)', border: '1px solid var(--f-alive)', color: 'var(--f-alive)' };
      default: 
        return { background: 'var(--f-cream)' };
    }
  };

  return (
    <div className={`system-node ${data.type}`} style={{
      ...getStyle(),
      padding: '12px 16px',
      borderRadius: '8px',
      minWidth: '180px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      position: 'relative'
    }}>
      {/* Dynamic handles based on type */}
      {data.type !== 'need' && <Handle type="target" position={Position.Top} />}
      {data.type !== 'done' && <Handle type="source" position={Position.Bottom} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
        {getIcon()}
        <span>{data.label}</span>
      </div>
      
      {data.description && (
        <div style={{ fontSize: '11px', color: 'var(--f-stone)', lineHeight: 1.4, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {data.description}
        </div>
      )}
      
      {data.status === 'running' && (
        <div className="pulsing-glow" style={{
          position: 'absolute', inset: -2, borderRadius: 10, zIndex: -1,
          border: '2px solid var(--f-moss)', opacity: 0.5, animation: 'pulse 1.5s infinite'
        }} />
      )}
    </div>
  );
};

export default SystemNode;
