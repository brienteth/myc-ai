import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle, XCircle, RefreshCw, Trash2, Power, PowerOff } from 'lucide-react';

const MCPServers = () => {
  const [servers, setServers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('stdio');
  const [command, setCommand] = useState('');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchServers = () => {
    fetch('http://127.0.0.1:8420/automation/mcp')
      .then(res => res.json())
      .then(data => setServers(data.servers || []))
      .catch(err => console.error("Failed to load MCP servers:", err));
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleAddServer = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8420/automation/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          command: type === 'stdio' ? command : null,
          url: type === 'sse' ? url : null
        })
      });
      if (res.ok) {
        setName('');
        setCommand('');
        setUrl('');
        setShowAddForm(false);
        fetchServers();
      }
    } catch (err) {
      console.error("Failed to add MCP server:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteServer = async (id) => {
    if (!confirm("Are you sure you want to delete this MCP server configuration?")) return;
    try {
      await fetch(`http://127.0.0.1:8420/automation/mcp/${id}`, {
        method: 'DELETE'
      });
      fetchServers();
    } catch (err) {
      console.error("Failed to delete MCP server:", err);
    }
  };

  const handleConnect = async (id) => {
    setServers(prev => prev.map(s => s.id === id ? { ...s, status: 'Connecting...' } : s));
    try {
      const res = await fetch(`http://127.0.0.1:8420/automation/mcp/${id}/connect`, {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Failed to connect: ${data.detail || 'unknown error'}`);
      }
      fetchServers();
    } catch (err) {
      alert(`Connection failed: ${err.message}`);
      fetchServers();
    }
  };

  const handleDisconnect = async (id) => {
    try {
      await fetch(`http://127.0.0.1:8420/automation/mcp/${id}/disconnect`, {
        method: 'POST'
      });
      fetchServers();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  return (
    <>
      <div className="auto-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="f-serif-italic">Model Context Protocol</h1>
          <p>Connect and manage MCP servers for external tool access</p>
        </div>
        <button 
          className="primary-btn" 
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} /> {showAddForm ? "Cancel" : "Add MCP Server"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddServer} className="auto-card" style={{ marginBottom: 24, maxWidth: 600, background: 'var(--f-parchment)' }}>
          <h4 style={{ marginBottom: 16 }}>New MCP Server Configuration</h4>
          
          <div className="prop-group" style={{ marginBottom: 12 }}>
            <label>Server Name</label>
            <input 
              type="text" 
              className="secret-input" 
              placeholder="e.g. GitHub Tools"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div className="prop-group" style={{ marginBottom: 12 }}>
            <label>Connection Type</label>
            <select 
              value={type} 
              onChange={e => setType(e.target.value)} 
              className="secret-input"
              style={{ width: '100%', padding: '6px' }}
            >
              <option value="stdio">stdio (Local Subprocess / Command Line)</option>
              <option value="sse">sse (Server-Sent Events URL)</option>
            </select>
          </div>

          {type === 'stdio' ? (
            <div className="prop-group" style={{ marginBottom: 12 }}>
              <label>Startup Command</label>
              <input 
                type="text" 
                className="secret-input" 
                placeholder="e.g. npx -y @modelcontextprotocol/server-git"
                value={command}
                onChange={e => setCommand(e.target.value)}
                required
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: 11, color: 'var(--f-stone)', marginTop: 4, display: 'block' }}>
                Command to spawn the subprocess via terminal stdio.
              </span>
            </div>
          ) : (
            <div className="prop-group" style={{ marginBottom: 12 }}>
              <label>SSE Endpoint URL</label>
              <input 
                type="url" 
                className="secret-input" 
                placeholder="e.g. http://localhost:3000/sse"
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="submit" className="primary-btn" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Configuration"}
            </button>
            <button type="button" className="secondary-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="auto-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {servers.map(s => (
          <div key={s.id} className="auto-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {s.name}
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.05)', color: 'var(--f-stone)', textTransform: 'uppercase' }}>
                    {s.type}
                  </span>
                </h4>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500 }}>
                  {s.status === 'Connected' && (
                    <span style={{ color: 'var(--f-moss)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={14} /> Connected
                    </span>
                  )}
                  {s.status === 'Error' && (
                    <span style={{ color: 'var(--f-dead)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <XCircle size={14} /> Error
                    </span>
                  )}
                  {s.status === 'Disconnected' && (
                    <span style={{ color: 'var(--f-stone)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--f-stone)' }} /> Disconnected
                    </span>
                  )}
                  {s.status !== 'Connected' && s.status !== 'Disconnected' && s.status !== 'Error' && (
                    <span style={{ color: 'var(--f-alive)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <RefreshCw size={12} className="spin" /> {s.status}
                    </span>
                  )}
                </div>
              </div>
              
              <div style={{ fontSize: 13, color: 'var(--f-soil)', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
                {s.type === 'stdio' ? (
                  <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <strong>Cmd:</strong> {s.command}
                  </div>
                ) : (
                  <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <strong>URL:</strong> {s.url}
                  </div>
                )}
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--f-deep)' }}>
                  Exposes: <strong>{s.tools_count || 0}</strong> tools / skills
                </div>
              </div>

              {s.error_log && (
                <div style={{ background: 'rgba(200,50,50,0.06)', padding: 8, borderRadius: 6, fontSize: 11, color: 'var(--f-dead)', fontFamily: 'var(--font-mono)', marginBottom: 16, maxHeight: 80, overflowY: 'auto' }}>
                  <strong>Error Log:</strong> {s.error_log}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--f-bark)', paddingTop: 16, marginTop: 'auto' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {s.status === 'Connected' ? (
                  <button 
                    className="secondary-btn" 
                    onClick={() => handleDisconnect(s.id)}
                    style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <PowerOff size={12} /> Disconnect
                  </button>
                ) : (
                  <button 
                    className="primary-btn" 
                    onClick={() => handleConnect(s.id)}
                    disabled={s.status === 'Connecting...'}
                    style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Power size={12} /> Connect
                  </button>
                )}
              </div>
              
              <button 
                className="icon-btn" 
                onClick={() => handleDeleteServer(s.id)}
                title="Delete Configuration"
                style={{ color: 'var(--f-dead)' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {servers.length === 0 && (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '40px 0', color: 'var(--f-stone)' }}>
            No MCP servers configured yet. Click "Add MCP Server" above to register one.
          </div>
        )}
      </div>
    </>
  );
};

export default MCPServers;
