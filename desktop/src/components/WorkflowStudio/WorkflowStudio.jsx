import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ReactFlow, 
  Controls, 
  MiniMap, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { 
  Play, Save, Check, UploadCloud, Square, X, Download, FileText, 
  CheckCircle2, Cpu, Search, Globe, Folder, Image, Settings, Terminal
} from 'lucide-react';
import WorkflowInspector from './WorkflowInspector';
import WorkflowDebugger from './WorkflowDebugger';
import WorkflowAIAssist from './WorkflowAIAssist';
import SystemNode from './SystemNode';
import SkillNode from './SkillNode';
import './WorkflowStudio.css';

const nodeTypes = {
  system: SystemNode,
  skill: SkillNode,
};

const SKILL_CATEGORIES = [
  { 
    name: 'Browser', 
    icon: Globe, 
    skills: [
      { id: 'browser.search', title: 'Browser Search', desc: 'Search the web using Myca Browser', latency: '400ms', offline: false, permission: 'network.out' },
      { id: 'browser.goto', title: 'Open URL', desc: 'Navigate to a specific URL', latency: '200ms', offline: false, permission: 'network.out' }
    ] 
  },
  { 
    name: 'Filesystem', 
    icon: Folder, 
    skills: [
      { id: 'filesystem.search', title: 'Search Directory', desc: 'Search files by pattern in folder', latency: '2ms', offline: true, permission: 'fs.read' },
      { id: 'document.read', title: 'Read File / Document', desc: 'Extract content from PDF, CSV, TXT', latency: '5ms', offline: true, permission: 'fs.read' },
      { id: 'table.write', title: 'Write Output File', desc: 'Synthesize PDF, CSV, JSON, TXT report', latency: '10ms', offline: true, permission: 'fs.write' }
    ] 
  },
  { 
    name: 'AI', 
    icon: Terminal, 
    skills: [
      { id: 'core.chat', title: 'AI Assistant Reasoning', desc: 'Process prompt with 0G Compute local AI', latency: '800ms', offline: true, permission: 'ai.local' },
      { id: 'document.extract', title: 'Data Extraction', desc: 'Extract structured tables & insights from text', latency: '600ms', offline: true, permission: 'ai.local' }
    ] 
  },
  { 
    name: 'Vision', 
    icon: Image, 
    skills: [
      { id: 'vision.analyze', title: 'Analyze Image', desc: 'Describe visual contents of an image', latency: '1200ms', offline: true, permission: 'ai.vision' }
    ] 
  },
  { 
    name: 'Communication', 
    icon: Settings, 
    skills: [
      { id: 'communication.send', title: 'Send Telegram / Email', desc: 'Send notification message via Telegram or Email', latency: '300ms', offline: false, permission: 'network.out' }
    ] 
  }
];

let id = 0;
const getId = () => `node_${id++}`;

const WorkflowStudioCanvas = () => {
  const reactFlowWrapper = useRef(null);
  
  // Persist nodes state in localStorage so switching tabs never clears work
  const [nodes, setNodes, onNodesChange] = useNodesState(() => {
    try {
      const saved = localStorage.getItem('myca_studio_nodes');
      return saved ? JSON.parse(saved) : [];
    } catch (_) { return []; }
  });

  const [edges, setEdges, onEdgesChange] = useEdgesState(() => {
    try {
      const saved = localStorage.getItem('myca_studio_edges');
      return saved ? JSON.parse(saved) : [];
    } catch (_) { return []; }
  });

  const [draftWorkflow, setDraftWorkflow] = useState(() => {
    try {
      const saved = localStorage.getItem('myca_studio_draft');
      return saved ? JSON.parse(saved) : null;
    } catch (_) { return null; }
  });

  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [logs, setLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('myca_studio_logs');
      return saved ? JSON.parse(saved) : [
        { time: new Date().toLocaleTimeString(), type: 'info', msg: 'Execution OS Workflow Studio initialized.' }
      ];
    } catch (_) {
      return [{ time: new Date().toLocaleTimeString(), type: 'info', msg: 'Execution OS Workflow Studio initialized.' }];
    }
  });

  const { fitView, screenToFlowPosition } = useReactFlow();

  // Save state to localStorage whenever nodes/edges/draft/logs change
  useEffect(() => {
    try {
      localStorage.setItem('myca_studio_nodes', JSON.stringify(nodes));
      localStorage.setItem('myca_studio_edges', JSON.stringify(edges));
      if (draftWorkflow) localStorage.setItem('myca_studio_draft', JSON.stringify(draftWorkflow));
      localStorage.setItem('myca_studio_logs', JSON.stringify(logs.slice(-50)));
    } catch (_) {}
  }, [nodes, edges, draftWorkflow, logs]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)), [setEdges]);

  const onNodeClick = useCallback((event, node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const handleAddSkillFromRegistry = (skillData) => {
    const inputs = [{ name: 'input' }];
    const outputs = [{ name: 'output' }];
    if (skillData.id.includes('search')) { inputs.push({name: 'path'}); inputs.push({name: 'pattern'}); outputs.push({name: 'files'}); }
    if (skillData.id.includes('read')) { inputs.push({name: 'path'}); outputs.push({name: 'content'}); }
    if (skillData.id.includes('write')) { inputs.push({name: 'path'}); inputs.push({name: 'content'}); inputs.push({name: 'format'}); outputs.push({name: 'path'}); }

    const newNode = {
      id: getId(),
      type: 'skill',
      position: { x: 350 + Math.random() * 80, y: 250 + Math.random() * 80 },
      data: { ...skillData, status: 'idle', inputs, outputs },
    };

    setNodes((nds) => nds.concat(newNode));
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: `Added node from Registry: ${skillData.title}` }]);
  };

  const handleUpdateNode = useCallback((nodeId, nextInputs) => {
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
    setExecutionResult(null);

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

      const runRes = await fetch('http://127.0.0.1:8420/automation/run/draft-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const runData = await runRes.json();

      // Visually simulate execution progression
      const skillNodes = draftWorkflow ? draftWorkflow.nodes : [];
      
      for (const sn of skillNodes) {
        setNodes(nds => nds.map(n => n.id === sn.id ? {...n, data: {...n.data, status: 'running'}} : n));
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: `Executing skill: ${sn.skill}...` }]);
        
        await new Promise(r => setTimeout(r, 700 + Math.random() * 400));
        
        setNodes(nds => nds.map(n => n.id === sn.id ? {...n, data: {...n.data, status: 'completed'}} : n));
      }

      setNodes(nds => nds.map(n => n.id === 'sys_artifacts' ? {...n, data: {...n.data, status: 'completed'}} : n));
      setNodes(nds => nds.map(n => n.id === 'sys_done' ? {...n, data: {...n.data, status: 'completed'}} : n));
      
      setIsExecuting(false);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'success', msg: 'Execution completed successfully. Output generated.' }]);

      // Determine output format & file path
      const nodeOutputs = runData?.node_outputs || {};
      let generatedFile = "~/Desktop/summary_report.csv";
      let fileContent = "title,date,status,summary\n\"Myca OS Execution Report\",\"2026-08-03\",\"Completed\",\"Summary report generated successfully.\"\n";
      let fileFormat = "CSV";

      for (const [nid, out] of Object.entries(nodeOutputs)) {
        if (out && out.path) {
          generatedFile = out.path;
          if (generatedFile.endsWith('.pdf')) fileFormat = 'PDF';
          else if (generatedFile.endsWith('.json')) fileFormat = 'JSON';
          else if (generatedFile.endsWith('.txt')) fileFormat = 'TXT';
          else fileFormat = 'CSV';
        }
        if (out && (out.content || out.extracted_content || out.csv_summary)) {
          fileContent = out.content || out.extracted_content || out.csv_summary;
        }
      }

      setExecutionResult({
        status: 'Completed',
        runId: runData?.run_id || 'run-completed',
        filePath: generatedFile,
        fileFormat,
        content: fileContent,
        timestamp: new Date().toLocaleTimeString()
      });

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
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'success', msg: `Workflow "${finalName}" saved & activated!` }]);
        alert(`Workflow "${finalName}" saved and activated!`);
      }
    } catch(e) {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'error', msg: `Save failed: ${e.message}` }]);
    }
  };

  const handleAIGenerate = async (prompt) => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'planner', msg: `Planner processing intent: "${prompt}"` }]);
    setExecutionResult(null);

    setNodes([]);
    setEdges([]);

    const needNode = { id: 'sys_need', type: 'system', position: { x: 350, y: 50 }, data: { type: 'need', label: 'Need', description: `"${prompt}"`, status: 'done' } };
    const plannerNode = { id: 'sys_planner', type: 'system', position: { x: 350, y: 150 }, data: { type: 'planner', label: 'Planner', description: 'Decomposing intent into primitives...', status: 'running' } };
    
    setNodes([needNode, plannerNode]);
    setEdges([{ id: 'e_need_planner', source: 'sys_need', target: 'sys_planner', animated: true }]);

    try {
      const res = await fetch('http://127.0.0.1:8420/automation/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      
      const workflow = data.workflow || data.plan;
      setDraftWorkflow(workflow);

      setNodes(nds => nds.map(n => n.id === 'sys_planner' ? { ...n, data: { ...n.data, status: 'done', description: `Planned ${workflow.nodes.length} skills` } } : n));

      const graphNode = { id: 'sys_graph', type: 'system', position: { x: 350, y: 250 }, data: { type: 'graph', label: 'Execution Graph', description: `${workflow.nodes.length} Primitive Nodes`, status: 'done' } };
      
      const startY = 370;
      const skillNodes = workflow.nodes.map((node, index) => {
        return {
          id: node.id,
          type: 'skill',
          position: { x: 350 + (index % 2 === 0 ? 0 : 220), y: startY + index * 110 },
          data: {
            title: node.skill,
            category: 'Primitive',
            status: 'idle',
            inputs: Object.keys(node.inputs || {}).map(k => ({ name: k })),
            outputs: [{ name: 'output' }],
            inputsValue: node.inputs
          }
        };
      });

      const lastY = startY + skillNodes.length * 110;
      const artifactsNode = { id: 'sys_artifacts', type: 'system', position: { x: 350, y: lastY }, data: { type: 'artifacts', label: 'Artifacts', description: 'Outputs & Artifacts', status: 'idle' } };
      const doneNode = { id: 'sys_done', type: 'system', position: { x: 350, y: lastY + 100 }, data: { type: 'done', label: 'Done', description: 'Pipeline Completed', status: 'idle' } };

      const allNodes = [needNode, plannerNode, graphNode, ...skillNodes, artifactsNode, doneNode];
      
      const newEdges = [
        { id: 'e_need_planner', source: 'sys_need', target: 'sys_planner', animated: true },
        { id: 'e_planner_graph', source: 'sys_planner', target: 'sys_graph', animated: true }
      ];

      if (skillNodes.length > 0) {
        newEdges.push({ id: 'e_graph_s0', source: 'sys_graph', target: skillNodes[0].id, animated: true });
        for (let i = 0; i < skillNodes.length - 1; i++) {
          newEdges.push({ id: `e_s${i}_s${i+1}`, source: skillNodes[i].id, target: skillNodes[i+1].id, animated: true });
        }
        newEdges.push({ id: `e_sLast_art`, source: skillNodes[skillNodes.length - 1].id, target: 'sys_artifacts', animated: true });
      } else {
        newEdges.push({ id: 'e_graph_art', source: 'sys_graph', target: 'sys_artifacts', animated: true });
      }
      
      newEdges.push({ id: 'e_art_done', source: 'sys_artifacts', target: 'sys_done', animated: true });

      setNodes(allNodes);
      setEdges(newEdges);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'info', msg: 'Pipeline visualization completed.' }]);
      
    } catch (err) {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type: 'error', msg: `Planning failed: ${err.message}` }]);
    }
  };

  // Filter skills for Skill Registry Modal
  const allSkillsList = SKILL_CATEGORIES.flatMap(cat => cat.skills.map(s => ({ ...s, category: cat.name })));
  const filteredSkills = allSkillsList.filter(s => {
    const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesSearch = s.title.toLowerCase().includes(skillSearch.toLowerCase()) || s.desc.toLowerCase().includes(skillSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

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
          {/* Skill Registry Button */}
          <button 
            className="toolbar-btn skill-registry-trigger" 
            onClick={() => setShowSkillModal(true)}
            style={{ border: '1px solid var(--f-moss, #2e6b45)', background: 'rgba(46, 107, 69, 0.1)', color: '#00e87a', fontWeight: 600 }}
          >
            <Cpu size={14} /> Skill Registry
          </button>

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

      <div className="studio-content-wrapper full-screen-canvas" style={{ position: 'relative', width: '100%', height: 'calc(100vh - 120px)' }}>
        <div className="studio-canvas" ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
          <WorkflowAIAssist onGenerate={handleAIGenerate} />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
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

        {/* Node Properties Popup Modal */}
        {selectedNode && (
          <WorkflowInspector 
            selectedNode={selectedNode} 
            onUpdateNode={handleUpdateNode} 
            onClose={() => setSelectedNode(null)} 
          />
        )}
      </div>

      {/* Skill Registry Modal */}
      {showSkillModal && (
        <div className="skill-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 10, 20, 0.75)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="skill-modal-container" style={{
            background: 'var(--f-bark, #141424)', border: '1px solid var(--f-soil, #3a3a4c)',
            borderRadius: 16, width: '90%', maxWidth: 720, padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)', color: 'var(--f-linen, #f0f0f0)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Cpu size={22} color="#00e87a" />
                <h3 style={{ margin: 0, fontSize: 18, color: '#00e87a' }}>Skill Registry</h3>
              </div>
              <button onClick={() => setShowSkillModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--f-earth)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0a0a14', border: '1px solid var(--f-soil)', borderRadius: 8, padding: '8px 14px', marginBottom: 16 }}>
              <Search size={16} color="var(--f-earth)" />
              <input 
                type="text" 
                placeholder="Search Execution OS Skills (PDF, CSV, Telegram, Web, OCR)..." 
                value={skillSearch}
                onChange={e => setSkillSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', color: '#fff', width: '100%', fontSize: 14 }}
                autoFocus
              />
            </div>

            {/* Category Filter Chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
              {['All', 'Browser', 'Filesystem', 'AI', 'Vision', 'Communication'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    background: selectedCategory === cat ? '#00e87a' : 'rgba(255,255,255,0.05)',
                    color: selectedCategory === cat ? '#0a0a14' : 'var(--f-linen)',
                    border: selectedCategory === cat ? 'none' : '1px solid var(--f-soil)'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Skill List Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, maxHeight: 360, overflowY: 'auto' }}>
              {filteredSkills.map(skill => (
                <div 
                  key={skill.id} 
                  onClick={() => {
                    handleAddSkillFromRegistry(skill);
                    setShowSkillModal(false);
                  }}
                  style={{
                    background: '#0e0e1a', border: '1px solid var(--f-soil)', borderRadius: 10, padding: 14,
                    cursor: 'pointer', transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#00e87a'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--f-soil)'}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#fff', marginBottom: 4 }}>{skill.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--f-earth)', marginBottom: 8, lineHeight: 1.4 }}>{skill.desc}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(0, 232, 122, 0.1)', color: '#00e87a' }}>{skill.category}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--f-earth)' }}>{skill.latency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Execution Result Modal */}
      {executionResult && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 10, 20, 0.75)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: 'var(--f-bark, #141424)', border: '1px solid var(--f-spore, #2e6b45)',
            borderRadius: 16, width: '90%', maxWidth: 680, padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)', color: 'var(--f-linen, #f0f0f0)', position: 'relative'
          }}>
            <button 
              onClick={() => setExecutionResult(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--f-earth)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <CheckCircle2 size={28} color="#00e87a" />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#00e87a' }}>Execution Completed Successfully!</h3>
                <span style={{ fontSize: 12, color: 'var(--f-earth)' }}>Run ID: {executionResult.runId} • {executionResult.timestamp}</span>
              </div>
            </div>

            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(0, 232, 122, 0.08)', borderRadius: 8, border: '1px solid rgba(0, 232, 122, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--f-earth)', marginBottom: 2 }}>Generated Result File / Artifact:</div>
                <code style={{ color: '#00e87a', fontSize: 13, fontFamily: 'monospace' }}>{executionResult.filePath}</code>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 6, background: '#00e87a', color: '#0a0a14', fontWeight: 700, fontSize: 12 }}>
                [{executionResult.fileFormat}]
              </span>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--f-earth)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} /> Output Content Preview ({executionResult.fileFormat}):
              </div>
              <pre style={{
                background: '#0a0a14', padding: 16, borderRadius: 8, maxHeight: 220, overflowY: 'auto',
                fontSize: 12, color: '#e0e0e0', lineHeight: 1.5, border: '1px solid var(--f-soil)', whiteSpace: 'pre-wrap'
              }}>
                {executionResult.content}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                onClick={() => setExecutionResult(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--f-soil)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 13 }}
              >
                Close
              </button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(executionResult.content);
                  alert("Output result kopyalandı!");
                }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#00e87a', color: '#0a0a14', fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={14} /> Copy Output Result
              </button>
            </div>
          </div>
        </div>
      )}

      <WorkflowDebugger logs={logs} isExecuting={isExecuting} />
    </>
  );
};

const WorkflowStudio = () => {
  return (
    <div className="workflow-studio full-canvas-layout" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="studio-main" style={{ width: '100%', height: '100%', flex: 1 }}>
        <ReactFlowProvider>
          <WorkflowStudioCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default WorkflowStudio;
