import React, { useCallback, useState } from 'react';
import ReactFlow, { 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState,
  addEdge
} from 'reactflow';
import 'reactflow/dist/style.css';
import AgentNode from './AgentNode';
import DependencyEdge from './DependencyEdge';
import './AgentGraph.css';

const nodeTypes = {
  agentNode: AgentNode,
};

const edgeTypes = {
  dependencyEdge: DependencyEdge,
};

const initialNodes = [
  { id: 'intent', position: { x: 400, y: 50 }, data: { label: 'Intent' }, type: 'default' },
  { id: 'agent-1', position: { x: 200, y: 200 }, data: { title: 'Pricing Agent', status: 'Running', runtime: 'Local', cost: '$0.01' }, type: 'agentNode' },
  { id: 'agent-2', position: { x: 400, y: 200 }, data: { title: 'Reviews Agent', status: 'Running', runtime: '0G Compute', cost: '$0.02' }, type: 'agentNode' },
  { id: 'agent-3', position: { x: 600, y: 200 }, data: { title: 'Market Agent', status: 'Running', runtime: 'Colony', cost: '$0.03' }, type: 'agentNode' },
  { id: 'verifier', position: { x: 400, y: 350 }, data: { label: 'Multi-Verifier' }, type: 'default' },
  { id: 'synthesis', position: { x: 400, y: 450 }, data: { label: 'Synthesis' }, type: 'default' },
];

const initialEdges = [
  { id: 'e1', source: 'intent', target: 'agent-1', type: 'smoothstep', animated: true },
  { id: 'e2', source: 'intent', target: 'agent-2', type: 'smoothstep', animated: true },
  { id: 'e3', source: 'intent', target: 'agent-3', type: 'smoothstep', animated: true },
  { id: 'e4', source: 'agent-1', target: 'verifier', type: 'smoothstep', animated: true },
  { id: 'e5', source: 'agent-2', target: 'verifier', type: 'smoothstep', animated: true },
  { id: 'e6', source: 'agent-3', target: 'verifier', type: 'smoothstep', animated: true },
  { id: 'e7', source: 'verifier', target: 'synthesis', type: 'smoothstep', animated: true },
  // Fake edge example
  { id: 'e-fake', source: 'agent-1', target: 'agent-2', type: 'dependencyEdge', data: { isFake: true, reason: 'Reviews Agent does not consume Pricing Agent output' } },
];

const AgentGraph = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleEdgeRemove = (edgeId) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  };

  return (
    <div className="agent-graph-wrapper">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Controls />
        <MiniMap nodeStrokeColor={(n) => {
          if (n.type === 'agentNode') return '#2E6B45';
          return '#17251C';
        }} nodeColor={(n) => {
          return '#FAF8F3';
        }} />
        <Background color="#DDD7CB" gap={16} />
      </ReactFlow>
    </div>
  );
};

export default AgentGraph;
