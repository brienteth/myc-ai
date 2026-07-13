import React, { useState } from 'react';
import { Search, Globe, Folder, FileText, Image, Mic, Terminal, Settings } from 'lucide-react';
import './WorkflowStudio.css';

const CATEGORIES = [
  { name: 'Browser', icon: Globe, skills: [{ id: 'browser.search', title: 'Browser Search', desc: 'Search the web using Myca Browser', latency: '400ms', offline: false, permission: 'network.out' }, { id: 'browser.goto', title: 'Open URL', desc: 'Navigate to a specific URL', latency: '200ms', offline: false, permission: 'network.out' }] },
  { name: 'Filesystem', icon: Folder, skills: [{ id: 'fs.read', title: 'Read File', desc: 'Read contents of a file', latency: '2ms', offline: true, permission: 'fs.read' }, { id: 'fs.write', title: 'Write File', desc: 'Write contents to a file', latency: '4ms', offline: true, permission: 'fs.write' }] },
  { name: 'AI', icon: Terminal, skills: [{ id: 'ai.summary', title: 'AI Summary', desc: 'Summarize text or documents', latency: '1200ms', offline: true, permission: 'ai.local' }, { id: 'ai.extract', title: 'Data Extraction', desc: 'Extract structured JSON from text', latency: '800ms', offline: true, permission: 'ai.local' }] },
  { name: 'Vision', icon: Image, skills: [{ id: 'vision.analyze', title: 'Analyze Image', desc: 'Describe contents of an image', latency: '1500ms', offline: true, permission: 'ai.vision' }] },
  { name: 'API', icon: Settings, skills: [{ id: 'api.fetch', title: 'HTTP Request', desc: 'Make REST API calls', latency: '100ms', offline: false, permission: 'network.out' }] },
];

const NodePalette = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const onDragStart = (event, skill) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(skill));
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredCategories = CATEGORIES.map(cat => ({
    ...cat,
    skills: cat.skills.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()) || s.desc.toLowerCase().includes(searchTerm.toLowerCase()))
  })).filter(cat => cat.skills.length > 0);

  return (
    <div className="node-palette">
      <div className="palette-header">
        <h3>Skill Registry</h3>
        <div className="palette-search">
          <Search size={14} color="var(--f-soil)" />
          <input 
            type="text" 
            placeholder="Search skills..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="palette-categories">
        {filteredCategories.map(cat => (
          <div key={cat.name} className="palette-category">
            <div className="category-title">
              <cat.icon size={14} />
              {cat.name}
            </div>
            <div className="category-skills">
              {cat.skills.map(skill => (
                <div 
                  key={skill.id} 
                  className="palette-skill" 
                  draggable 
                  onDragStart={(e) => onDragStart(e, { ...skill, category: cat.name })}
                  title={`Latency: ${skill.latency}\nOffline: ${skill.offline ? 'Yes' : 'No'}\nPermission: ${skill.permission}`}
                >
                  <div className="skill-title">{skill.title}</div>
                  <div className="skill-desc">{skill.desc}</div>
                  <div className="skill-meta-tags">
                    <span className="skill-meta-tag">{skill.offline ? '✓ Offline' : 'Cloud'}</span>
                    <span className="skill-meta-tag">{skill.latency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filteredCategories.length === 0 && (
          <div style={{padding: 16, color: 'var(--f-earth)', fontSize: 13, textAlign: 'center'}}>No skills match your search.</div>
        )}
      </div>
    </div>
  );
};

export default NodePalette;
