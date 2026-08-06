import React, { useState } from 'react';
import { Cpu, Package, Server, CheckCircle2, Shield, Play, Search, Plus, Terminal, Filter, LayoutGrid, ListFilter, X, Code, Zap, ExternalLink, SlidersHorizontal } from 'lucide-react';
import './SkillsView.css';

const SKILLS_DATA = [
  // Communication
  { id: 'telegram.send', category: 'Communication', desc: 'Send Telegram bot message with markdown formatting & media attachments', speed: '12ms', status: 'Active', tags: ['bot', 'message', 'telegram'] },
  { id: 'slack.send', category: 'Communication', desc: 'Post formatted message or block kit card to Slack channel via OAuth / Webhook', speed: '15ms', status: 'Active', tags: ['slack', 'webhook', 'team'] },
  { id: 'gmail.send', category: 'Communication', desc: 'Send email message with attachments via Gmail REST API', speed: '45ms', status: 'Active', tags: ['email', 'gmail', 'smtp'] },
  { id: 'whatsapp.webhook', category: 'Communication', desc: 'Trigger WhatsApp Business API outbound notification template', speed: '22ms', status: 'Active', tags: ['whatsapp', 'sms', 'mobile'] },
  { id: 'discord.bot.send', category: 'Communication', desc: 'Dispatch embed message to Discord channel via bot token', speed: '18ms', status: 'Active', tags: ['discord', 'bot', 'community'] },
  
  // Database & Storage
  { id: 'postgres.query', category: 'Database', desc: 'Execute parameterized SQL query against local or remote PostgreSQL DB', speed: '8ms', status: 'Active', tags: ['sql', 'postgres', 'db'] },
  { id: 'mongodb.find', category: 'Database', desc: 'Perform JSON document query & aggregation pipeline in MongoDB', speed: '10ms', status: 'Active', tags: ['nosql', 'mongo', 'json'] },
  { id: 'redis.cache.get', category: 'Database', desc: 'Fetch key-value payload or hash from in-memory Redis cluster', speed: '2ms', status: 'Active', tags: ['cache', 'redis', 'kv'] },
  { id: 'sqlite.exec', category: 'Database', desc: 'Execute fast SQLite query against local desktop state DB', speed: '1ms', status: 'Active', tags: ['sqlite', 'local', 'storage'] },
  { id: 'pinecone.vector.search', category: 'Database', desc: 'Perform k-NN vector similarity search against dense embedding index', speed: '32ms', status: 'Active', tags: ['vector', 'embeddings', 'ai-search'] },
  
  // AI & Inference
  { id: 'core.chat', category: 'AI & Inference', desc: 'Invoke local Myca LLM inference engine with streaming support', speed: '35ms', status: 'Active', tags: ['llm', 'local', 'chat'] },
  { id: 'zg.compute.run', category: 'AI & Inference', desc: 'Dispatch decentralized AI compute task to 0G Compute Network (gpt-5.6-sol)', speed: '120ms', status: 'Active', tags: ['0g', 'decentralized', 'cloud'] },
  { id: 'ollama.generate', category: 'AI & Inference', desc: 'Query local Ollama server running Llama 3 / Qwen / Mistral models', speed: '45ms', status: 'Active', tags: ['ollama', 'local', 'llama'] },
  { id: 'openai.embedding', category: 'AI & Inference', desc: 'Generate text-embedding-3 vectors for semantic memory search', speed: '28ms', status: 'Active', tags: ['embeddings', 'vector', 'openai'] },
  { id: 'whisper.transcribe', category: 'AI & Inference', desc: 'Transcribe audio speech to text using OpenAI Whisper local model', speed: '110ms', status: 'Active', tags: ['audio', 'stt', 'voice'] },
  { id: 'image.generate', category: 'AI & Inference', desc: 'Generate high-resolution UI mocks & images via diffusion models', speed: '850ms', status: 'Active', tags: ['image', 'diffusion', 'design'] },
  
  // Science & Research
  { id: 'alphafold.db.fetch', category: 'Science & Research', desc: 'Retrieve & analyze AlphaFold predicted 3D protein structures by UniProt ID', speed: '95ms', status: 'Active', tags: ['protein', 'alphafold', 'biology'] },
  { id: 'chembl.query', category: 'Science & Research', desc: 'Query ChEMBL database for bioactive molecules, IC50/Ki targets & SMILES', speed: '140ms', status: 'Active', tags: ['chemistry', 'chembl', 'drugs'] },
  { id: 'clinicaltrials.search', category: 'Science & Research', desc: 'Search ClinicalTrials.gov API v2 for trial eligibility & status', speed: '110ms', status: 'Active', tags: ['trials', 'medical', 'fda'] },
  { id: 'gnomad.frequency', category: 'Science & Research', desc: 'Query Genome Aggregation Database for variant allele frequency & LOEUF', speed: '130ms', status: 'Active', tags: ['genetics', 'gnomad', 'dna'] },
  { id: 'pubmed.search', category: 'Science & Research', desc: 'Search PubMed literature database and retrieve full-text citations', speed: '85ms', status: 'Active', tags: ['literature', 'pubmed', 'ncbi'] },
  { id: 'uniprot.sequence', category: 'Science & Research', desc: 'Fetch protein FASTA sequences, domain annotations & GO taxonomy', speed: '60ms', status: 'Active', tags: ['uniprot', 'protein', 'sequence'] },
  { id: 'predictingthepast.restore', category: 'Science & Research', desc: 'Ancient Latin/Greek epigraphic text restoration & dating via Ithaca AI', speed: '210ms', status: 'Active', tags: ['history', 'ithaca', 'ancient'] },
  
  // Web & Browser Automation
  { id: 'chrome.devtools.inspect', category: 'Web & Automation', desc: 'Inspect DOM tree, accessibility (a11y), network requests via Chrome DevTools MCP', speed: '25ms', status: 'Active', tags: ['chrome', 'devtools', 'a11y'] },
  { id: 'playwright.scrape', category: 'Web & Automation', desc: 'Headless browser page navigation, click automation & screenshot capture', speed: '340ms', status: 'Active', tags: ['browser', 'scraping', 'playwright'] },
  { id: 'web.read_url', category: 'Web & Automation', desc: 'Fetch public URL HTML content and convert directly into clean Markdown', speed: '40ms', status: 'Active', tags: ['http', 'markdown', 'web'] },
  { id: 'web.search_bing', category: 'Web & Automation', desc: 'Perform live web search queries and extract top cited URLs & snippets', speed: '75ms', status: 'Active', tags: ['search', 'bing', 'web'] },

  // Developer & Mobile
  { id: 'github.commit', category: 'Developer & Mobile', desc: 'Create git commit and push changes to remote GitHub repository', speed: '250ms', status: 'Active', tags: ['git', 'github', 'dev'] },
  { id: 'dart.analyze', category: 'Developer & Mobile', desc: 'Execute static analysis on Dart/Flutter codebase & apply mechanical fixes', speed: '180ms', status: 'Active', tags: ['dart', 'flutter', 'lint'] },
  { id: 'android.sdk.deploy', category: 'Developer & Mobile', desc: 'Orchestrate Android SDK builds & emulator deployment via CLI', speed: '920ms', status: 'Active', tags: ['android', 'mobile', 'apk'] },
  { id: 'xcode.project.setup', category: 'Developer & Mobile', desc: 'Safely parse & modify Xcode .pbxproj to link Swift package dependencies', speed: '310ms', status: 'Active', tags: ['ios', 'xcode', 'swift'] },
  { id: 'docker.container.run', category: 'Developer & Mobile', desc: 'Spin up isolated Docker container with volume mounts & port forwarding', speed: '420ms', status: 'Active', tags: ['docker', 'containers', 'devops'] },

  // Firebase & Cloud
  { id: 'firebase.firestore.query', category: 'Firebase & Cloud', desc: 'Query Cloud Firestore documents with realtime snapshot listeners', speed: '35ms', status: 'Active', tags: ['firebase', 'firestore', 'cloud'] },
  { id: 'firebase.auth.verify', category: 'Firebase & Cloud', desc: 'Verify Firebase Auth JWT ID tokens and enforce security rules', speed: '14ms', status: 'Active', tags: ['firebase', 'auth', 'jwt'] },
  { id: 'firebase.remote_config', category: 'Firebase & Cloud', desc: 'Fetch & evaluate dynamic feature flags from Firebase Remote Config', speed: '19ms', status: 'Active', tags: ['firebase', 'config', 'flags'] },
  
  // Enterprise & Security
  { id: 'enterprise.approval.queue', category: 'Enterprise & Security', desc: 'Route high-risk execution intent to Passkey multi-sig approval queue', speed: '15ms', status: 'Active', tags: ['passkey', 'security', 'enterprise'] },
  { id: 'slsa.provenance.verify', category: 'Enterprise & Security', desc: 'Verify SLSA Level-3 cryptographic build provenance and binary hash', speed: '8ms', status: 'Active', tags: ['slsa', 'provenance', 'security'] },
  { id: 'sovereign.mesh.route', category: 'Enterprise & Security', desc: 'Encrypt & route P2P payload through sovereign air-gapped local mesh', speed: '6ms', status: 'Active', tags: ['p2p', 'airgap', 'mesh'] },

  // Location & Maps
  { id: 'google.maps.geocoding', category: 'Location & Maps', desc: 'Convert address strings to exact latitude/longitude coordinates', speed: '24ms', status: 'Active', tags: ['maps', 'geocoding', 'location'] },
  { id: 'google.maps.route_eta', category: 'Location & Maps', desc: 'Compute eco-friendly driving routes, distance & real-time ETA', speed: '48ms', status: 'Active', tags: ['maps', 'routing', 'eta'] }
];

const CATEGORIES = [
  'All',
  'Communication',
  'Database',
  'AI & Inference',
  'Science & Research',
  'Web & Automation',
  'Developer & Mobile',
  'Firebase & Cloud',
  'Enterprise & Security',
  'Location & Maps'
];

const SkillsView = () => {
  const [activeTab, setActiveTab] = useState('primitives');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('category'); // 'category' | 'grid'
  const [selectedSkill, setSelectedSkill] = useState(null);

  const mcpServers = [
    { name: 'Chrome DevTools MCP', type: 'stdio', command: 'npx -y @chrome-devtools/mcp-server', status: 'Connected', skills: 14 },
    { name: 'GitHub MCP Server', type: 'stdio', command: 'npx -y @modelcontextprotocol/server-github', status: 'Connected', skills: 28 },
    { name: 'PostgreSQL DB Explorer', type: 'stdio', command: 'npx -y @modelcontextprotocol/server-postgres', status: 'Connected', skills: 12 },
    { name: 'Brave Web Search MCP', type: 'stdio', command: 'npx -y @modelcontextprotocol/server-brave-search', status: 'Connected', skills: 6 },
    { name: 'Firebase Data Connect MCP', type: 'stdio', command: 'npx -y @firebase/data-connect-mcp', status: 'Connected', skills: 18 }
  ];

  // Filter skills by category & search query
  const filteredSkills = SKILLS_DATA.filter(skill => {
    const matchesCat = selectedCategory === 'All' || skill.category === selectedCategory;
    const matchesSearch = 
      skill.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      skill.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Group skills by category for Category View
  const groupedSkills = CATEGORIES.filter(c => c !== 'All').map(cat => ({
    name: cat,
    skills: filteredSkills.filter(s => s.category === cat)
  })).filter(g => g.skills.length > 0);

  return (
    <div className="skills-view-container">
      {/* Header */}
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
            OS Primitives & Skills (1,600+)
          </button>
          <button className={`tab-btn ${activeTab === 'mcp' ? 'active' : ''}`} onClick={() => setActiveTab('mcp')}>
            MCP Servers (Model Context Protocol)
          </button>
        </div>
      </div>

      {activeTab === 'primitives' && (
        <div className="tab-content">
          {/* Controls Bar: Search + Category Filters + View Mode */}
          <div className="skills-controls-box">
            
            {/* Search Row */}
            <div className="search-bar-row">
              <div className="search-input-wrapper">
                <Search size={16} color="var(--f-stone)" />
                <input
                  type="text"
                  placeholder="Search 1,600+ skills by ID, category, or keyword (e.g. alphafold, postgres, devtools)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="controls-right">
                <div className="primitive-counter">
                  Showing <strong>{filteredSkills.length}</strong> of <strong>1,600+</strong> Primitives
                </div>
                
                <div className="view-mode-toggle">
                  <button 
                    className={`view-mode-btn ${viewMode === 'category' ? 'active' : ''}`}
                    onClick={() => setViewMode('category')}
                    title="Category View"
                  >
                    <ListFilter size={15} /> Category
                  </button>
                  <button 
                    className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                  >
                    <LayoutGrid size={15} /> Grid
                  </button>
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="category-pills-row">
              <span className="pills-label"><Filter size={12} /> Filter:</span>
              <div className="pills-scroll">
                {CATEGORIES.map(cat => {
                  const count = cat === 'All' 
                    ? SKILLS_DATA.length 
                    : SKILLS_DATA.filter(s => s.category === cat).length;
                  return (
                    <button
                      key={cat}
                      className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      <span>{cat}</span>
                      <span className="pill-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Skill Display */}
          {filteredSkills.length === 0 ? (
            <div className="empty-skills-box">
              <Search size={32} color="var(--f-stone)" />
              <h3>No matching skills found</h3>
              <p>Try searching for a different keyword or select "All" categories.</p>
              <button className="btn-secondary" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}>
                Reset Filters
              </button>
            </div>
          ) : viewMode === 'category' ? (
            /* Category Grouped View */
            <div className="category-sections-list">
              {groupedSkills.map(group => (
                <div key={group.name} className="category-group-block">
                  <div className="group-header">
                    <div className="group-title">
                      <h3>{group.name}</h3>
                      <span className="group-badge">{group.skills.length} Registered</span>
                    </div>
                  </div>

                  <div className="primitives-grid">
                    {group.skills.map(skill => (
                      <div key={skill.id} className="skill-card" onClick={() => setSelectedSkill(skill)}>
                        <div className="skill-card-top">
                          <span className="skill-id">{skill.id}</span>
                          <span className="skill-badge">{skill.category}</span>
                        </div>
                        <p className="skill-desc">{skill.desc}</p>
                        <div className="skill-tags">
                          {skill.tags.map(t => <span key={t} className="skill-tag-chip">#{t}</span>)}
                        </div>
                        <div className="skill-card-bottom">
                          <span className="skill-speed">⚡ {skill.speed}</span>
                          <span className="skill-status"><CheckCircle2 size={13} color="#2e6b45" /> {skill.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Flat Grid View */
            <div className="primitives-grid" style={{ marginTop: 20 }}>
              {filteredSkills.map(skill => (
                <div key={skill.id} className="skill-card" onClick={() => setSelectedSkill(skill)}>
                  <div className="skill-card-top">
                    <span className="skill-id">{skill.id}</span>
                    <span className="skill-badge">{skill.category}</span>
                  </div>
                  <p className="skill-desc">{skill.desc}</p>
                  <div className="skill-tags">
                    {skill.tags.map(t => <span key={t} className="skill-tag-chip">#{t}</span>)}
                  </div>
                  <div className="skill-card-bottom">
                    <span className="skill-speed">⚡ {skill.speed}</span>
                    <span className="skill-status"><CheckCircle2 size={13} color="#2e6b45" /> {skill.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MCP Servers Tab */}
      {activeTab === 'mcp' && (
        <div className="tab-content">
          <div className="mcp-card-box">
            <div className="mcp-box-header">
              <Server size={20} color="var(--f-moss)" />
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

          <h3 className="section-subtitle">Connected & Verified MCP Servers ({mcpServers.length})</h3>
          <div className="mcp-list">
            {mcpServers.map((server, i) => (
              <div key={i} className="mcp-item-card">
                <div className="mcp-item-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Server size={18} color="var(--f-moss)" />
                    <span className="mcp-name">{server.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="mcp-skills-count">{server.skills} Skills Registered</span>
                    <span className="mcp-status-pill">{server.status}</span>
                  </div>
                </div>
                <div className="mcp-cmd-code"><Terminal size={13} /> {server.command}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <div className="skill-modal-overlay" onClick={() => setSelectedSkill(null)}>
          <div className="skill-modal-container" onClick={e => e.stopPropagation()}>
            <div className="skill-modal-header">
              <div className="skill-modal-title">
                <Code size={20} color="var(--f-moss)" />
                <span>{selectedSkill.id}</span>
              </div>
              <button className="icon-btn" onClick={() => setSelectedSkill(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="skill-modal-body">
              <div className="modal-meta-row">
                <span className="skill-badge">{selectedSkill.category}</span>
                <span className="skill-speed">⚡ Execution Latency: {selectedSkill.speed}</span>
                <span className="skill-status"><CheckCircle2 size={14} color="#2e6b45" /> {selectedSkill.status}</span>
              </div>

              <div className="modal-section">
                <h4>Description</h4>
                <p>{selectedSkill.desc}</p>
              </div>

              <div className="modal-section">
                <h4>Capability Tags</h4>
                <div className="skill-tags">
                  {selectedSkill.tags.map(t => <span key={t} className="skill-tag-chip">#{t}</span>)}
                </div>
              </div>

              <div className="modal-section">
                <h4>Python & REST Invocation Pattern</h4>
                <pre className="code-snippet">
{`from myca.skills import execute_primitive

result = await execute_primitive(
    primitive_id="${selectedSkill.id}",
    params={"intent": "auto"}
)`}
                </pre>
              </div>
            </div>

            <div className="skill-modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedSkill(null)}>Close</button>
              <button className="btn-primary" onClick={() => setSelectedSkill(null)}>
                <Play size={14} /> Test Primitive Execution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillsView;
