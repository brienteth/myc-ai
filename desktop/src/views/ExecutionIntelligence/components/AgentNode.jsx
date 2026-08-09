import React from 'react';
import { Handle, Position } from 'reactflow';
import './AgentNode.css';

const AgentNode = ({ data }) => {
  return (
    <div className="agent-node">
      <Handle type="target" position={Position.Top} className="node-handle" />
      
      <div className="agent-header">
        <span className="agent-status-dot running"></span>
        <span className="agent-title">{data.title}</span>
      </div>
      
      <div className="agent-body">
        <div className="agent-meta">
          <span className="meta-label">Status</span>
          <span className="meta-value status-running">{data.status}</span>
        </div>
        <div className="agent-meta">
          <span className="meta-label">Runtime</span>
          <span className="meta-value">{data.runtime}</span>
        </div>
        <div className="agent-meta">
          <span className="meta-label">Cost</span>
          <span className="meta-value">{data.cost}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
};

export default AgentNode;
