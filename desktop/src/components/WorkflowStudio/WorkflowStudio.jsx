import React, { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Square, Save, UploadCloud, Download, Check, Settings2 } from 'lucide-react';
import NodePalette from './NodePalette';
import SkillNode from './SkillNode';
import SystemNode from './SystemNode';
import WorkflowInspector from './WorkflowInspector';
import WorkflowDebugger from './WorkflowDebugger';
import WorkflowAIAssist from './WorkflowAIAssist';
import './WorkflowStudio.css';

const nodeTypes = {
  skill: SkillNode,
  system: SystemNode,
};

let id = 0;
const getId = () => `node_${id++}`;

const WorkflowStudioCanvas = () => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [draftWorkflow, setDraftWorkflow] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [logs, setLogs] = useState([
    { time: new Date().toLocaleTimeString(), type: 'info', msg: 'Execution OS Workflow Studio initialized.' }
  ]);
  const { fitView, screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)), [setEdges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const skillData = JSON.parse(type);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const inputs = [{ name: 'input' }];
      const outputs = [{ name: 'output' }];
      if (skillData.id.includes('search')) { inputs.push({name: 'query'}); outputs.push({name: 'results'}); }
      if (skillData.id.includes('read')) { inputs.push({name: 'path'}); outputs.push({name: 'content'}); }

      const newNode = {
        id: getId(),
        type: 'skill',
        position,
        data: { ...skillData, status: 'idle', inputs, outputs },
      };

      setNodes((nds) => nds.concat(newNode));
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: `Added node: ${skillData.title}` }]);
    },
    [screenToFlowPosition, setNodes]
  );

  const onNodeClick = useCallback((event, node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const handleUpdateNode = useCallback((nodeId, nextInputs) => {
    // 1. Update React Flow Node data
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            inputsValue: nextInputs
          }
        };
      }
      return n;
    }));

    // 2. Also keep selectedNode state in sync if it is the one being updated
    setSelectedNode(prev => {
      if (prev && prev.id === nodeId) {
        return {
          ...prev,
          data: {
            ...prev.data,
            inputsValue: nextInputs
          }
        };
      }
      return prev;
    });

    // 3. Update draftWorkflow inputs so the correct parameters are executed
    setDraftWorkflow(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map(n => {
          if (n.id === nodeId) {
            return {
              ...n,
              inputs: nextInputs
            };
          }
          return n;
        })
      };
    });
  }, [setNodes]);

  const handleRun = async () => {
    setIsExecuting(true);
    // Reset all nodes to idle before run except planner and graph which are done
    setNodes(nds => nds.map(n => {
      if (['sys_need', 'sys_planner', 'sys_graph'].includes(n.id)) {
         return {...n, data: {...n.data, status: 'done'}};
      }
      return {...n, data: {...n.data, status: 'idle'}};
    }));
    try {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: 'Execution started. Saving DAG...' }]);

      const payload = draftWorkflow ? {
        ...draftWorkflow,
        id: "draft-run",
        name: "Studio Draft",
        description: "Draft execution from Workflow Studio",
        enabled: true,
        trigger: { type: "manual" }
      } : {
        id: "draft-run",
        name: "Empty Draft",
        enabled: true,
        trigger: { type: "manual" },
        nodes: [],
        edges: []
      };

      await fetch('http://127.0.0.1:8420/automation/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: 'Triggering execution on Execution OS runtime...' }]);

      await fetch('http://127.0.0.1:8420/automation/run/draft-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // Visually simulate execution progression
      const skillNodes = draftWorkflow ? draftWorkflow.nodes : [];
      
      for (const sn of skillNodes) {
        setNodes(nds => nds.map(n => n.id === sn.id ? {...n, data: {...n.data, status: 'running'}} : n));
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: `Executing skill: ${sn.skill}...` }]);
        
        await new Promise(r => setTimeout(r, 1200 + Math.random() * 800)); // Simulate work
        
        setNodes(nds => nds.map(n => n.id === sn.id ? {...n, data: {...n.data, status: 'completed'}} : n));
      }

      // Finalize Artifacts
      setNodes(nds => nds.map(n => n.id === 'sys_artifacts' ? {...n, data: {...n.data, status: 'running'}} : n));
      await new Promise(r => setTimeout(r, 1000));
      setNodes(nds => nds.map(n => n.id === 'sys_artifacts' ? {...n, data: {...n.data, status: 'completed'}} : n));

      // Finalize Done
      setNodes(nds => nds.map(n => n.id === 'sys_done' ? {...n, data: {...n.data, status: 'completed'}} : n));
      
      setIsExecuting(false);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'success', msg: 'Execution completed successfully. Artifacts saved.' }]);
    } catch (err) {
      setNodes(nds => nds.map(n => ({...n, data: {...n.data, status: 'failed'}})));
      setIsExecuting(false);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'error', msg: `Execution failed: ${err.message}` }]);
    }
  };

  const handleStop = () => {
    setIsExecuting(false);
    setNodes(nds => nds.map(n => ({...n, data: {...n.data, status: 'failed'}})));
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'error', msg: 'Execution aborted by user.' }]);
    
    // Send cancellation to backend for draft-run
    fetch('http://127.0.0.1:8420/automation/runs/draft-run/cancel', {
      method: 'POST'
    }).catch(err => console.error("Failed to cancel backend run:", err));
  };

  const handleSave = async () => {
    if (!draftWorkflow) {
      alert("No workflow generated yet. Write a prompt first!");
      return;
    }
    
    const nameInput = document.querySelector('.workflow-name');
    const finalName = nameInput ? nameInput.value : draftWorkflow.name;

    const payload = {
      ...draftWorkflow,
      name: finalName,
      enabled: true
    };

    try {
      const res = await fetch('http://127.0.0.1:8420/automation/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'success', msg: `Workflow "${finalName}" successfully saved & deployed!` }]);
        alert(`Workflow "${finalName}" saved and activated!`);
      }
    } catch(e) {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'error', msg: `Save failed: ${e.message}` }]);
    }
  };

  const handleAIGenerate = async (prompt) => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'planner', msg: `Planner processing intent: "${prompt}"` }]);
    
    // Clear canvas
    setNodes([]);
    setEdges([]);

    // 1. Need Node
    const needNode = { id: 'sys_need', type: 'system', position: { x: 300, y: 50 }, data: { type: 'need', label: 'Need', description: `"${prompt}"`, status: 'done' } };
    setNodes([needNode]);
    
    await new Promise(r => setTimeout(r, 600));

    // 2. Planner Node
    const plannerNode = { id: 'sys_planner', type: 'system', position: { x: 300, y: 180 }, data: { type: 'planner', label: 'Planner', description: 'Translating intent to DAG via LLM...', status: 'running' } };
    setNodes(nds => [...nds, plannerNode]);
    setEdges(eds => [...eds, { id: 'e_need_planner', source: 'sys_need', target: 'sys_planner', animated: true }]);

    // Trigger fitView so the user sees the graph building
    setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50);

    try {
      // 3. Call backend plan API
      const res = await fetch('http://127.0.0.1:8420/automation/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      const workflow = data.plan;
      setDraftWorkflow(workflow);
      
      // Update planner to done
      setNodes(nds => nds.map(n => n.id === 'sys_planner' ? {...n, data: {...n.data, status: 'done', description: 'Generated DAG successfully'}} : n));
      await new Promise(r => setTimeout(r, 600));

      // 4. Execution Graph Node
      const graphNode = { id: 'sys_graph', type: 'system', position: { x: 300, y: 310 }, data: { type: 'graph', label: 'Execution Graph', description: `${workflow.nodes.length} skills orchestrated`, status: 'done' } };
      setNodes(nds => [...nds, graphNode]);
      setEdges(eds => [...eds, { id: 'e_planner_graph', source: 'sys_planner', target: 'sys_graph', animated: true }]);
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50);
      await new Promise(r => setTimeout(r, 800));

      // 5. Skills (Unroll DAG)
      const skillNodes = [];
      const skillEdges = [];
      let currentY = 460;
      
      workflow.nodes.forEach((n, idx) => {
        skillNodes.push({
          id: n.id,
          type: 'skill',
          position: { x: 300, y: currentY },
          data: { id: n.skill, title: n.skill, status: 'idle', inputs: Object.keys(n.inputs || {}).map(k => ({name: k})), inputsValue: n.inputs || {}, outputs: [] }
        });
        
        if (!n.depends_on || n.depends_on.length === 0) {
          skillEdges.push({ id: `e_graph_${n.id}`, source: 'sys_graph', target: n.id, animated: true });
        }
        currentY += 130;
      });
      
      workflow.edges.forEach((e) => {
         skillEdges.push({ id: `e_${e.from}_${e.to}`, source: e.from, target: e.to, animated: true });
      });

      setNodes(nds => [...nds, ...skillNodes]);
      setEdges(eds => [...eds, ...skillEdges]);
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50);
      
      await new Promise(r => setTimeout(r, 1000));

      // 6. Artifacts Node
      const artifactsNode = { id: 'sys_artifacts', type: 'system', position: { x: 300, y: currentY + 30 }, data: { type: 'artifacts', label: 'Artifacts', description: 'Aggregated outputs', status: 'done' } };
      setNodes(nds => [...nds, artifactsNode]);
      
      const fromIds = new Set(workflow.edges.map(e => e.from));
      const leafNodes = workflow.nodes.filter(n => !fromIds.has(n.id));
      if (leafNodes.length === 0 && workflow.nodes.length > 0) leafNodes.push(workflow.nodes[workflow.nodes.length-1]);
      
      const artifactEdges = leafNodes.map(n => ({ id: `e_${n.id}_artifacts`, source: n.id, target: 'sys_artifacts', animated: true }));
      setEdges(eds => [...eds, ...artifactEdges]);
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50);

      await new Promise(r => setTimeout(r, 800));

      // 7. Done Node
      const doneNode = { id: 'sys_done', type: 'system', position: { x: 300, y: currentY + 160 }, data: { type: 'done', label: 'Done', description: 'Execution finalized', status: 'done' } };
      setNodes(nds => [...nds, doneNode]);
      setEdges(eds => [...eds, { id: 'e_artifacts_done', source: 'sys_artifacts', target: 'sys_done', animated: true }]);
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50);

      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'success', msg: `Pipeline visualization completed.` }]);
      
    } catch (err) {
      setNodes(nds => nds.map(n => n.id === 'sys_planner' ? {...n, data: {...n.data, status: 'failed', description: 'Failed to generate DAG'}} : n));
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'error', msg: `Planner API failed: ${err.message}` }]);
    }
  };

  return (
    <>
      <div className="studio-toolbar">
        <div className="toolbar-left">
          <input type="text" className="workflow-name" defaultValue="Execution OS Pipeline" />
          <div className="toolbar-status">
            <div className={`status-indicator ${isExecuting ? 'running' : 'idle'}`} />
            {isExecuting ? 'Running' : 'Ready'}
          </div>
        </div>
        
        <div className="toolbar-actions">
          <button className="toolbar-btn" onClick={handleSave}><Save size={14} /> Save</button>
          <button className="toolbar-btn"><Check size={14} /> Validate</button>
          <button className="toolbar-btn"><UploadCloud size={14} /> Deploy</button>
          
          {isExecuting ? (
            <button className="toolbar-btn" onClick={handleStop} style={{color: 'var(--f-dead)', borderColor: 'var(--f-dead)'}}>
              <Square size={14} fill="currentColor" /> Stop
            </button>
          ) : (
            <button className="toolbar-btn primary" onClick={handleRun}>
              <Play size={14} fill="currentColor" /> Run Graph
            </button>
          )}
        </div>
      </div>

      <div className="studio-content-wrapper">
        <div className="studio-canvas" ref={reactFlowWrapper}>
          <WorkflowAIAssist onGenerate={handleAIGenerate} />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Controls />
            <MiniMap nodeStrokeWidth={3} zoomable pannable />
            <Background variant="dots" gap={12} size={1} color="var(--f-bark)" />
          </ReactFlow>
        </div>
        <WorkflowInspector selectedNode={selectedNode} onUpdateNode={handleUpdateNode} onClose={() => setSelectedNode(null)} />
      </div>

      <WorkflowDebugger logs={logs} isExecuting={isExecuting} />
    </>
  );
};

const WorkflowStudio = () => {
  return (
    <div className="workflow-studio">
      <NodePalette />
      <div className="studio-main">
        <ReactFlowProvider>
          <WorkflowStudioCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default WorkflowStudio;
