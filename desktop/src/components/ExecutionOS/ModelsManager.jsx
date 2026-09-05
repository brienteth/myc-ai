import React, { useState, useEffect } from 'react';
import { Settings, Play, Database, Cpu, HardDrive, Square, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getAvailableOllamaModels } from '../../services/aiService';

const ModelsManager = () => {
  const [models, setModels] = useState([]);
  const [activeModel, setActiveModel] = useState(() => {
    return localStorage.getItem('myca_active_model') || 'myca-local';
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setIsLoading(true);
    const discovered = [];

    // 1. Built-in Sovereign Local Engine (Always present, 0 cost, 0 latency)
    discovered.push({
      id: 'myca-local',
      name: 'Myca Sovereign Engine (Spectral)',
      status: activeModel === 'myca-local' ? 'Active' : 'Ready',
      size: '12 KB (Zero-Heap)',
      type: 'On-Device FHRR SLM',
      source: 'Built-in (Offline)'
    });

    // 2. Discover local Ollama models (localhost:11434)
    try {
      const ollamaModels = await getAvailableOllamaModels();
      for (const om of ollamaModels) {
        discovered.push({
          id: om.id,
          name: om.name,
          status: activeModel === om.id ? 'Active' : 'Ready',
          size: om.size,
          type: `Ollama (${om.quant})`,
          source: 'Local Ollama Bridge (:11434)'
        });
      }
    } catch (_) {}

    // 3. Check local backend /models if running
    try {
      const backendUrl = window.getBackendUrl ? window.getBackendUrl() : 'http://127.0.0.1:8420';
      const res = await fetch(`${backendUrl}/models`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        if (data.models) {
          for (const m of data.models) {
            discovered.push({
              id: m,
              name: m.replace('.gguf', ''),
              status: activeModel === m ? 'Active' : 'Ready',
              size: 'GGUF',
              type: m.includes('embed') ? 'Embedding' : 'LLM',
              source: '~/.myca/models/'
            });
          }
        }
      }
    } catch (_) {}

    // 4. Decentralized 0G Compute
    discovered.push({
      id: 'gpt-5.6-sol',
      name: 'Myca LLM (gpt-5.6-sol)',
      status: activeModel === 'gpt-5.6-sol' ? 'Active' : 'Ready',
      size: 'Cloud Decoupled',
      type: '0G Compute AI',
      source: '0G Network'
    });

    setModels(discovered);
    setIsLoading(false);
  };

  const handleSetActive = (modelId) => {
    setActiveModel(modelId);
    localStorage.setItem('myca_active_model', modelId);
    setModels(prev => prev.map(m => ({
      ...m,
      status: m.id === modelId ? 'Active' : 'Ready'
    })));
  };

  return (
    <>
      <div className="auto-header">
        <h1 className="f-serif-italic">Local & Sovereign Models</h1>
        <p>Manage on-device inference engines across macOS, Windows, and Linux</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button className="secondary-btn" style={{display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13}} onClick={fetchModels}>
          <RefreshCw size={14} /> Refresh Engines
        </button>
      </div>

      <h3 style={{ marginBottom: 16 }}>
        {isLoading ? 'Scanning model engines...' : `${models.length} Model Engine${models.length !== 1 ? 's' : ''} Available`}
      </h3>

      <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {models.map(m => (
          <div key={m.id} className="auto-card" style={{
            border: m.status === 'Active' ? '2px solid var(--f-moss, #2e6b45)' : '1px solid var(--f-bark, #DDD7CB)',
            background: m.status === 'Active' ? 'rgba(46, 107, 69, 0.04)' : undefined
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>{m.name}</h4>
              <span className={`status-indicator ${m.status === 'Active' ? 'enabled' : ''}`}>
                {m.status === 'Active' ? '● Active' : '○ Standby'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--f-soil)', marginBottom: 8 }}>
              <strong>Tür:</strong> {m.type} • <strong>Boyut:</strong> {m.size}
            </div>
            <div style={{ fontSize: 11, color: 'var(--f-stone)', marginBottom: 16, fontFamily: 'var(--f-mono)' }}>
              Kaynak: {m.source}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {m.status !== 'Active' ? (
                <button className="primary-btn" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleSetActive(m.id)}>
                  <Play size={12} /> Aktif Et
                </button>
              ) : (
                <button className="secondary-btn" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--f-moss)' }}>
                  <CheckCircle2 size={12} /> Seçili Motor
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default ModelsManager;
