import React, { useState, useEffect } from 'react';
import { Settings, Play, Database, Cpu, HardDrive, Square, RefreshCw } from 'lucide-react';

const ModelsManager = () => {
  const [models, setModels] = useState([]);
  const [activeModel, setActiveModel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = () => {
    setIsLoading(true);
    // Fetch from /models endpoint (local GGUF files)
    fetch('http://127.0.0.1:8420/models')
      .then(res => res.json())
      .then(data => {
        if (data.models) {
          const fetchedModels = data.models.map((m, i) => ({
            id: m,
            name: m.replace('.gguf', ''),
            status: i === 0 ? 'Loaded' : 'Idle',
            size: 'GGUF',
            type: m.includes('embed') ? 'Embedding' : 'LLM'
          }));
          setModels(fetchedModels);
          if (fetchedModels.length > 0) setActiveModel(fetchedModels[0].id);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load models:", err);
        setIsLoading(false);
      });
  };

  return (
    <>
      <div className="auto-header">
        <h1 className="f-serif-italic">Local Models</h1>
        <p>Manage on-device inference engines and resource allocation</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button className="secondary-btn" style={{display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13}} onClick={fetchModels}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <h3 style={{ marginBottom: 16 }}>
        {isLoading ? 'Loading models...' : `${models.length} Model${models.length !== 1 ? 's' : ''} Found`}
      </h3>
      <div className="auto-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {models.map(m => (
          <div key={m.id} className="auto-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>{m.name}</h4>
              <span className={`status-indicator ${m.status === 'Loaded' ? 'enabled' : ''}`}>{m.status}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--f-soil)', marginBottom: 16 }}>
              Type: {m.type} • Format: {m.size}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {m.status === 'Idle' ? (
                <button className="primary-btn" style={{ padding: '6px 12px', fontSize: 13 }}>
                  <Play size={14} style={{display: 'inline', marginRight: 4}} /> Load
                </button>
              ) : (
                <button className="secondary-btn" style={{ padding: '6px 12px', fontSize: 13 }}>
                  <Square size={14} style={{display: 'inline', marginRight: 4}} /> Unload
                </button>
              )}
            </div>
          </div>
        ))}
        {!isLoading && models.length === 0 && (
          <div style={{color: 'var(--f-stone)', gridColumn: '1 / -1'}}>
            No models found in ~/.myca/models/. Place GGUF files there to get started.
          </div>
        )}
      </div>
    </>
  );
};

export default ModelsManager;
