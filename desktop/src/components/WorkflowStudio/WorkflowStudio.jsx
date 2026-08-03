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
  CheckCircle2, Cpu, Search, Globe, Folder, Image, Settings, Terminal, Sparkles, FileSpreadsheet
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
    name: 'Enterprise', 
    icon: Settings, 
    skills: [
      { id: 'crm.lead_extract', title: 'CRM Lead Extractor', desc: 'Extract customer contacts, emails, phone numbers for SMEs', latency: '500ms', offline: true, permission: 'ai.local' },
      { id: 'finance.invoice_parse', title: 'Invoice & Financial Parser', desc: 'Parse PDF/Image invoices into CSV/JSON tables', latency: '700ms', offline: true, permission: 'fs.read' }
    ] 
  },
  { 
    name: 'Marketing', 
    icon: Sparkles, 
    skills: [
      { id: 'marketing.social_post', title: 'Social Media Post Generator', desc: 'Generate Instagram, LinkedIn, and X posts with hashtags', latency: '600ms', offline: true, permission: 'ai.local' },
      { id: 'influencer.content_plan', title: 'Influencer 30-Day Content Plan', desc: 'Generate Reels/TikTok video scripts and content calendars', latency: '900ms', offline: true, permission: 'ai.local' }
    ] 
  },
  { 
    name: 'Vision', 
    icon: Image, 
    skills: [
      { id: 'vision.analyze', title: 'Analyze Image', desc: 'Describe visual contents of an image', latency: '1200ms', offline: true, permission: 'ai.vision' },
      { id: 'image.ocr', title: 'Optical Character Recognition (OCR)', desc: 'Extract text from scanned images and screenshots', latency: '400ms', offline: true, permission: 'fs.read' }
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
  
  // AI Refine state for execution results
  const [aiRefinePrompt, setAiRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

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

  const { fitView } = useReactFlow();

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
    if (skillData.id.includes('read')) { inputs.push({name: 'path'}); inputs.push({name: 'content'}); }
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
        
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
        
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

  const handleAIRefineResult = async () => {
    if (!aiRefinePrompt.trim() || !executionResult) return;
    setIsRefining(true);
    try {
      const fullPrompt = `Here is the current workflow execution output result:\n\n${executionResult.content}\n\nUser Revision/Format Request: ${aiRefinePrompt}\n\nPlease revise, format, edit, or translate the output content accordingly and output ONLY the modified result content.`;
      const res = await fetch('http://127.0.0.1:8420/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, stream: false })
      });
      const data = await res.json();
      if (data.response) {
        setExecutionResult(prev => ({
          ...prev,
          content: data.response
        }));
        setAiRefinePrompt('');
      }
    } catch (err) {
      alert(`AI Refine Error: ${err.message}`);
    }
    setIsRefining(false);
  };

  const handleDownloadFormat = (targetFormat) => {
    if (!executionResult) return;
    let contentToDownload = executionResult.content;
    let mimeType = 'text/plain';
    let ext = '.txt';

    if (targetFormat === 'CSV') {
      mimeType = 'text/csv';
      ext = '.csv';
    } else if (targetFormat === 'JSON') {
      mimeType = 'application/json';
      ext = '.json';
    } else if (targetFormat === 'PDF') {
      mimeType = 'text/plain';
      ext = '.pdf';
    }

    const blob = new Blob([contentToDownload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myca_workflow_output_${Date.now()}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

      <div className="studio-content-wrapper full-screen-canvas" style={{ position: 'relative', width: '100%', height: 'calc(100vh - 200px)' }}>
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
          background: 'rgba(5, 7, 14, 0.85)', backdropFilter: 'blur(16px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="skill-modal-container" style={{
            background: 'linear-gradient(145deg, rgba(20, 22, 34, 0.98) 0%, rgba(10, 12, 20, 0.99) 100%)',
            border: '1px solid rgba(0, 232, 122, 0.35)',
            borderRadius: 18, width: '90%', maxWidth: 740, padding: 26,
            boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(0, 232, 122, 0.15)', color: '#f4f4f6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Cpu size={22} color="#00e87a" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#00e87a', letterSpacing: '-0.3px' }}>Skill Registry</h3>
              </div>
              <button 
                onClick={() => setShowSkillModal(false)} 
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: 6, color: '#a0a0b2', cursor: 'pointer', display: 'flex'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#090b14', border: '1px solid rgba(0, 232, 122, 0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 18 }}>
              <Search size={16} color="#00e87a" />
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
              {['All', 'Browser', 'Filesystem', 'AI', 'Enterprise', 'Marketing', 'Vision', 'Communication'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: selectedCategory === cat ? 700 : 500, cursor: 'pointer',
                    background: selectedCategory === cat ? 'linear-gradient(135deg, #00e87a 0%, #00b862 100%)' : 'rgba(255,255,255,0.05)',
                    color: selectedCategory === cat ? '#070a10' : '#a0a0b2',
                    border: selectedCategory === cat ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: selectedCategory === cat ? '0 4px 14px rgba(0, 232, 122, 0.3)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Skill List Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 12, maxHeight: 380, overflowY: 'auto' }}>
              {filteredSkills.map(skill => (
                <div 
                  key={skill.id} 
                  onClick={() => {
                    handleAddSkillFromRegistry(skill);
                    setShowSkillModal(false);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16,
                    cursor: 'pointer', transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#00e87a';
                    e.currentTarget.style.background = 'rgba(0, 232, 122, 0.06)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 4 }}>{skill.title}</div>
                  <div style={{ fontSize: 12, color: '#a0a0b2', marginBottom: 10, lineHeight: 1.4 }}>{skill.desc}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(0, 232, 122, 0.12)', color: '#00e87a', fontWeight: 600 }}>{skill.category}</span>
                    <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#a0a0b2' }}>{skill.latency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Execution Result Modal (High Contrast & AI Refine) */}
      {executionResult && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 14, 0.88)', backdropFilter: 'blur(16px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(18, 20, 34, 0.98) 0%, rgba(9, 11, 20, 0.99) 100%)',
            border: '1px solid rgba(0, 232, 122, 0.35)',
            borderRadius: 18, width: '90%', maxWidth: 720, padding: 26,
            boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(0, 232, 122, 0.15)',
            color: '#ffffff', position: 'relative'
          }}>
            <button 
              onClick={() => setExecutionResult(null)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: 6, color: '#a0a0b2', cursor: 'pointer', display: 'flex'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <CheckCircle2 size={30} color="#00e87a" />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#00e87a', letterSpacing: '-0.2px' }}>Execution Completed Successfully!</h3>
                <span style={{ fontSize: 12, color: '#a0a0b2', fontWeight: 500 }}>Run ID: {executionResult.runId} • {executionResult.timestamp}</span>
              </div>
            </div>

            <div style={{
              marginBottom: 16, padding: '12px 16px', background: '#090b14', borderRadius: 10,
              border: '1px solid rgba(0, 232, 122, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#a0a0b2', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase' }}>Generated Result File / Artifact:</div>
                <code style={{ color: '#00e87a', fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{executionResult.filePath}</code>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 6, background: '#00e87a', color: '#070a10', fontWeight: 800, fontSize: 12 }}>
                [{executionResult.fileFormat}]
              </span>
            </div>

            {/* Content Preview Box */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#a0a0b2', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <FileText size={14} color="#00e87a" /> Output Content Preview ({executionResult.fileFormat}):
              </div>
              <pre style={{
                background: '#04050a', padding: 16, borderRadius: 10, maxHeight: 200, overflowY: 'auto',
                fontSize: 13, color: '#ffffff', lineHeight: 1.5, border: '1px solid rgba(255,255,255,0.12)', whiteSpace: 'pre-wrap',
                fontFamily: 'monospace'
              }}>
                {executionResult.content}
              </pre>
            </div>

            {/* AI Assistant Refine Box */}
            <div style={{ marginBottom: 20, padding: 14, background: 'rgba(0, 232, 122, 0.04)', borderRadius: 10, border: '1px solid rgba(0, 232, 122, 0.2)' }}>
              <div style={{ fontSize: 12, color: '#00e87a', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} /> AI Assistant Refinement & Format Editor:
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="text" 
                  placeholder="Ask AI to edit, reformat, translate or summarize result (e.g. 'Format as Markdown table', 'Translate to English')..."
                  value={aiRefinePrompt}
                  onChange={e => setAiRefinePrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAIRefineResult()}
                  style={{
                    flex: 1, padding: '9px 14px', borderRadius: 8, background: '#090b14',
                    border: '1px solid rgba(0, 232, 122, 0.3)', color: '#fff', fontSize: 13, outline: 'none'
                  }}
                />
                <button 
                  onClick={handleAIRefineResult}
                  disabled={isRefining}
                  style={{
                    padding: '9px 16px', borderRadius: 8, border: 'none',
                    background: isRefining ? '#2d2d34' : 'linear-gradient(135deg, #00e87a 0%, #00b862 100%)',
                    color: '#070a10', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  {isRefining ? 'Refining...' : '✨ Refine with AI'}
                </button>
              </div>
            </div>

            {/* Format Export Buttons & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#a0a0b2', fontWeight: 600 }}>Download Format:</span>
                {['CSV', 'JSON', 'PDF', 'TXT'].map(fmt => (
                  <button 
                    key={fmt}
                    onClick={() => handleDownloadFormat(fmt)}
                    style={{
                      padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.05)', color: '#ffffff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#00e87a'; e.currentTarget.style.color = '#00e87a'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#ffffff'; }}
                  >
                    📥 {fmt}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  onClick={() => setExecutionResult(null)}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
                    background: '#161826', color: '#ffffff', fontWeight: 600, cursor: 'pointer', fontSize: 13
                  }}
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(executionResult.content);
                    alert("Output result copied to clipboard!");
                  }}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #00e87a 0%, #00b862 100%)',
                    color: '#070a10', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Download size={14} /> Copy Result
                </button>
              </div>
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
    <div className="workflow-studio full-canvas-layout" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div className="studio-main" style={{ width: '100%', height: '100%', flex: 1, overflow: 'hidden' }}>
        <ReactFlowProvider>
          <WorkflowStudioCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default WorkflowStudio;
