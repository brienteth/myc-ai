import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, Check, AlertCircle, Clock, Zap, Globe, Folder, Terminal, Image as ImageIcon } from 'lucide-react';
import './WorkflowStudio.css';

const CATEGORY_ICONS = {
  'Browser': Globe,
  'Filesystem': Folder,
  'AI': Terminal,
  'Vision': ImageIcon
};

const SkillNode = ({ data, isConnectable }) => {
  const { title, description, category, status, time, warnings, cost, inputs, outputs } = data;
  const Icon = CATEGORY_ICONS[category] || Zap;

  return (
    <div className={`skill-node status-${status || 'idle'}`}>
      <div className="skill-node-header">
        <div className="skill-node-icon">
          <Icon size={16} />
        </div>
        <div className="skill-node-title">{title || 'Unknown Skill'}</div>
        <div className="skill-node-status-icon">
          {status === 'running' && <div className="status-spinner" />}
          {status === 'completed' && <Check size={14} color="var(--f-alive)" />}
          {status === 'failed' && <AlertCircle size={14} color="var(--f-dead)" />}
        </div>
      </div>

      <div className="skill-node-handles">
        {/* Render input handles on the left */}
        <div className="handles-left">
          {inputs && inputs.map((input, idx) => (
            <div key={input.name} className="handle-row">
              <Handle
                type="target"
                position={Position.Left}
                id={`in-${input.name}`}
                isConnectable={isConnectable}
                className="myc-handle target"
                style={{ top: `${(idx + 1) * 20 + 20}px` }}
              />
              <span className="handle-label in">{input.name}</span>
            </div>
          ))}
        </div>

        {/* Render output handles on the right */}
        <div className="handles-right">
          {outputs && outputs.map((output, idx) => (
            <div key={output.name} className="handle-row right">
              <span className="handle-label out">{output.name}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`out-${output.name}`}
                isConnectable={isConnectable}
                className="myc-handle source"
                style={{ top: `${(idx + 1) * 20 + 20}px` }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="skill-node-footer">
        <div className="skill-node-meta">
          <span className="node-badge">{data.offline ? '✓ Offline' : '☁ Cloud'}</span>
        </div>
        <div className="skill-node-meta" style={{marginLeft: 'auto'}}>
          <Clock size={12} /> {time || data.latency || '0ms'}
        </div>
      </div>
    </div>
  );
};

export default memo(SkillNode);
