import React, { useState } from 'react';
import { Cpu, Package, Server, CheckCircle2, Shield, Play, Search, Plus, Terminal } from 'lucide-react';
import './SkillsView.css';

const SkillsView = () => {
  const [activeTab, setActiveTab] = useState('primitives');
  const [searchQuery, setSearchQuery] = useState('');

  const primitives = [
    { id: 'telegram.send', category: 'Communication', desc: 'Send Telegram bot message with markdown formatting', speed: '12ms', status: 'Active' },
    { id: 'slack.send', category: 'Communication', desc: 'Post message to Slack channel via OAuth / Webhook', speed: '15ms', status: 'Active' },
    { id: 'gmail.send', category: 'Communication', desc: 'Send email via Gmail API', speed: '45ms', status: 'Active' },
    { id: 'postgres.query', category: 'Database', desc: 'Execute parameterized SQL query against PostgreSQL', speed: '8ms', status: 'Active' },
    { id: '0g.compute.run', category: 'Compute', desc: 'Dispatch decentralized AI compute task to 0G mesh', speed: '120ms', status: 'Active' },
    { id: 'github.commit', category: 'Developer', desc: 'Create git commit and push to remote branch', speed: '250ms', status: 'Active' },
    { id: 'fs.read', category: 'FileSystem', desc: 'Read file contents from local storage', speed: '1ms', status: 'Active' },
    { id: 'core.chat', category: 'AI Core', desc: 'Invoke local LLM inference engine', speed: '35ms', status: 'Active' }
  ];

  const mcpServers = [
    { name: 'GitHub MCP Server', type: 'stdio', command: 'npx -y @modelcontextprotocol/server-github', status: 'Connected' },
    { name: 'PostgreSQL DB Explorer', type: 'stdio', command: 'npx -y @modelcontextprotocol/server-postgres', status: 'Connected' },
    { name: 'Brave Web Search', type: 'stdio', command: 'npx -y @modelcontextprotocol/server-brave-search', status: 'Connected' }
  ];

  const filteredPrimitives = primitives.filter(p => 
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="skills-view-container">
      <div className="skills-header">
        <div className="title-area">
          <Cpu className="skills-icon" size={28} />
          <div>
            <h1>🧩 Skills & MCP Capability Registry</h1>
            <p>1,600+ Atomic OS Primitives, Self-Describing Skill Manifests & Verified MCP Servers</p>
          </div>
        </div>
        <div className="tab-buttons">
          <button className={`tab-btn ${activeTab === 'primitives' ? 'active' : ''}`} onClick={() => setActiveTab('primitives')}>
            OS Primitives & Skills
          </button>
          <button className={`tab-btn ${activeTab === 'mcp' ? 'active' : ''}`} onClick={() => setActiveTab('mcp')}>
            MCP Servers (Model Context Protocol)
          </button>
        </div>
      </div>

      {activeTab === 'primitives' && (
        <div className="tab-content">
          <div className="search-bar-row">
            <div className="search-input-wrapper">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search skills by primitive ID or category (e.g. communication, postgres)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="primitive-counter">Showing {filteredPrimitives.length} of 1,600 Primitives</div>
          </div>

          <div className="primitives-grid">
            {filteredPrimitives.map(skill => (
              <div key={skill.id} className="skill-card">
                <div className="skill-card-top">
                  <span className="skill-id">{skill.id}</span>
                  <span className="skill-badge">{skill.category}</span>
                </div>
                <p className="skill-desc">{skill.desc}</p>
                <div className="skill-card-bottom">
                  <span className="skill-speed">⚡ {skill.speed}</span>
                  <span className="skill-status"><CheckCircle2 size={13} color="#2e6b45" /> {skill.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'mcp' && (
        <div className="tab-content">
          <div className="mcp-card-box">
            <div className="mcp-box-header">
              <Server size={20} />
              <h3>Connect New Model Context Protocol (MCP) Server</h3>
            </div>
            <p className="mcp-desc">Integrate external databases, API tools, or custom CLI scripts via stdio or SSE pipes.</p>
            
            <div className="mcp-form-grid">
              <div>
                <label>Server Name</label>
                <input type="text" className="mcp-input" placeholder="e.g. Slack MCP or SQLite Explorer" />
              </div>
              <div>
                <label>Command (stdio)</label>
                <input type="text" className="mcp-input" placeholder="e.g. npx -y @modelcontextprotocol/server-slack" />
              </div>
            </div>

            <button className="btn-primary" style={{ marginTop: '16px' }}>
              <Plus size={16} /> Add MCP Server
            </button>
          </div>

          <h3 className="section-subtitle">Connected & Verified MCP Servers</h3>
          <div className="mcp-list">
            {mcpServers.map((server, i) => (
              <div key={i} className="mcp-item-card">
                <div className="mcp-item-header">
                  <span className="mcp-name">{server.name}</span>
                  <span className="mcp-status-pill">{server.status}</span>
                </div>
                <div className="mcp-cmd-code"><Terminal size={13} /> {server.command}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillsView;
