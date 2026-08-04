import React, { useState, useEffect } from 'react';
import { Settings2, Activity, Globe, Folder, Terminal } from 'lucide-react';

const ToolsRegistry = () => {
  const [tools, setTools] = useState([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8420/automation/tools')
      .then(res => res.json())
      .then(data => setTools(data.tools || []))
      .catch(err => console.error("Failed to load tools:", err));
  }, []);

  const getIcon = (cat) => {
    if (cat === 'Browser') return <Globe size={16} />;
    if (cat === 'Filesystem') return <Folder size={16} />;
    if (cat === 'AI') return <Terminal size={16} />;
    return <Settings2 size={16} />;
  };

  return (
    <>
      <div className="auto-header">
        <h1 className="f-serif-italic">Tools Registry</h1>
        <p>View installed tools, permissions, latencies, and success rates</p>
      </div>

      <div className="auto-grid" style={{ gridTemplateColumns: '1fr' }}>
        {tools.map(t => (
          <div key={t.id} className="auto-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--f-linen)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--f-earth)' }}>
                {getIcon(t.category)}
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{t.name}</h4>
                <div style={{ fontSize: 12, color: 'var(--f-soil)', fontFamily: 'var(--font-mono)' }}>{t.id}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 32 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--f-earth)', marginBottom: 4, fontWeight: 600 }}>Latency</div>
                <div style={{ fontSize: 14, color: 'var(--f-deep)', fontWeight: 500 }}>{t.latency}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--f-earth)', marginBottom: 4, fontWeight: 600 }}>Success</div>
                <div style={{ fontSize: 14, color: 'var(--f-alive)', fontWeight: 500 }}>{t.success}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--f-earth)', marginBottom: 4, fontWeight: 600 }}>Permissions</div>
                <div style={{ fontSize: 12, color: 'var(--f-humus)', background: 'var(--f-parchment)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--f-bark)' }}>
                  {t.permissions}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default ToolsRegistry;
