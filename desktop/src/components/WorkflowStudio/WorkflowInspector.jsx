import React, { useState, useEffect } from 'react';
import { Settings, X, Key, ShieldCheck, Lock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import './WorkflowStudio.css';

const WorkflowInspector = ({ selectedNode, onUpdateNode, onClose }) => {
  const [activeTab, setActiveTab] = useState('inputs');
  const [localInputs, setLocalInputs] = useState({});
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    if (selectedNode) {
      setLocalInputs(selectedNode.data?.inputsValue || {});
    } else {
      setLocalInputs({});
    }
  }, [selectedNode?.id]);

  if (!selectedNode) return null;

  const { id, data } = selectedNode;

  const handleInputChange = (name, value) => {
    const nextInputs = { ...localInputs, [name]: value };
    setLocalInputs(nextInputs);
    if (onUpdateNode) {
      onUpdateNode(id, nextInputs);
    }
  };

  // Derive inputs & credentials from manifest if available
  const skillId = data?.id || data?.title || id;
  const manifest = data?.manifest || {};
  const requiredInputs = manifest.required_inputs || data?.inputs || [];
  const optionalInputs = manifest.optional_inputs || [];
  const requiredCredentials = manifest.required_credentials || [];

  // Validation: check which required fields are missing
  const missingRequired = requiredInputs.filter(inp => {
    const paramName = typeof inp === 'string' ? inp : inp?.name;
    if (!paramName) return false;
    const val = localInputs[paramName];
    return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
  });
  const missingCredentials = requiredCredentials.filter(cred => {
    const val = localInputs[cred];
    return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
  });
  const isValid = missingRequired.length === 0 && missingCredentials.length === 0;

  return (
    <div style={{
      position: 'absolute',
      top: 24,
      right: 24,
      width: 420,
      background: 'linear-gradient(145deg, rgba(20, 22, 34, 0.95) 0%, rgba(12, 14, 24, 0.98) 100%)',
      border: `1px solid ${isValid ? 'rgba(0, 232, 122, 0.35)' : 'rgba(255, 170, 0, 0.45)'}`,
      borderRadius: 16,
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 232, 122, 0.12)',
      color: '#f4f4f6',
      zIndex: 999,
      overflow: 'hidden',
      backdropFilter: 'blur(16px)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(0, 232, 122, 0.15)',
        background: 'rgba(0, 232, 122, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={18} color="#00e87a" />
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#00e87a', letterSpacing: '-0.2px' }}>
              {data?.title || 'Node Properties'}
            </h3>
            <span style={{ fontSize: 11, color: '#a0a0b2', fontFamily: 'monospace' }}>{skillId}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Validation Badge */}
          {isValid ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#00e87a', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(0, 232, 122, 0.12)' }}>
              <CheckCircle2 size={12} /> READY
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#ffb703', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(255, 170, 0, 0.12)' }}>
              <AlertCircle size={12} /> {missingRequired.length + missingCredentials.length} EKSİK
            </span>
          )}
          <button 
            onClick={onClose} 
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: 6, color: '#a0a0b2', cursor: 'pointer', display: 'flex'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#090b14' }}>
        <button 
          onClick={() => setActiveTab('inputs')}
          style={{
            flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
            color: activeTab === 'inputs' ? '#00e87a' : '#a0a0b2',
            borderBottom: activeTab === 'inputs' ? '2px solid #00e87a' : '2px solid transparent',
            fontSize: 11, fontWeight: 700, cursor: 'pointer'
          }}
        >
          INPUTS & CREDENTIALS
        </button>
        <button 
          onClick={() => setActiveTab('general')}
          style={{
            flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
            color: activeTab === 'general' ? '#00e87a' : '#a0a0b2',
            borderBottom: activeTab === 'general' ? '2px solid #00e87a' : '2px solid transparent',
            fontSize: 11, fontWeight: 700, cursor: 'pointer'
          }}
        >
          MANIFEST & CAPABILITY
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: 20, maxHeight: 480, overflowY: 'auto' }}>
        {activeTab === 'inputs' && (
          <div>
            {/* Validation Warning */}
            {!isValid && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255, 170, 0, 0.06)', borderRadius: 10, border: '1px solid rgba(255, 170, 0, 0.2)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertCircle size={16} color="#ffb703" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: '#ffc300', lineHeight: 1.5 }}>
                  <strong>Dikkat:</strong> Bu modülün çalışması için {missingRequired.length > 0 ? `${missingRequired.length} zorunlu parametre` : ''}{missingRequired.length > 0 && missingCredentials.length > 0 ? ' ve ' : ''}{missingCredentials.length > 0 ? `${missingCredentials.length} API anahtarı` : ''} eksik.
                </div>
              </div>
            )}

            {/* Required Credentials Section */}
            {requiredCredentials.length > 0 && (
              <div style={{ marginBottom: 20, padding: 12, background: 'rgba(255, 170, 0, 0.08)', borderRadius: 10, border: '1px solid rgba(255, 170, 0, 0.25)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ffb703', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
                  <Key size={13} /> Required Secret Credentials:
                </div>
                {requiredCredentials.map((cred, i) => {
                  const val = localInputs[cred];
                  const isFilled = val !== undefined && val !== null && (typeof val === 'string' ? val.trim() !== '' : true);
                  return (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#ffc300' }}>
                          {cred} <span style={{ color: '#ff4d4d' }}>*</span>
                        </label>
                        {isFilled ? (
                          <span style={{ fontSize: 10, color: '#00e87a', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <CheckCircle2 size={10} /> Configured
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <AlertCircle size={10} /> Missing
                          </span>
                        )}
                      </div>
                      <input 
                        type="password" 
                        placeholder={`Secret Vault key for ${cred}`}
                        value={localInputs[cred] || ''}
                        onChange={e => handleInputChange(cred, e.target.value)}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 8,
                          background: '#090b14', border: `1px solid ${isFilled ? 'rgba(0, 232, 122, 0.3)' : 'rgba(255, 107, 107, 0.3)'}`,
                          color: '#ffffff', fontSize: 12, outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Required Input Parameters Section */}
            {requiredInputs.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#00e87a', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Zorunlu Parametreler:
                </div>

                {requiredInputs.map((inp, i) => {
                  const paramName = typeof inp === 'string' ? inp : inp?.name;
                  if (!paramName) return null;
                  const paramType = typeof inp === 'object' ? inp.type : 'string';
                  const paramDesc = typeof inp === 'object' ? inp.description : '';
                  const val = localInputs[paramName];
                  const isFilled = val !== undefined && val !== null && (typeof val === 'string' ? val.trim() !== '' : true);

                  return (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: isFilled ? '#00e87a' : '#ff6b6b' }}>
                          {paramName} <span style={{ color: '#ff4d4d' }}>*</span>
                        </label>
                        {paramDesc && <span style={{ fontSize: 10, color: '#a0a0b2', maxWidth: '60%', textAlign: 'right' }}>{paramDesc}</span>}
                      </div>

                      {paramName === 'model' ? (
                        <select
                          value={localInputs[paramName] || 'gpt-5.6-sol'}
                          onChange={e => handleInputChange(paramName, e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 8,
                            background: '#090b14', border: '1px solid rgba(0, 232, 122, 0.35)',
                            color: '#00e87a', fontSize: 12, outline: 'none', boxSizing: 'border-box'
                          }}
                        >
                          <option value="gpt-5.6-sol">Myca LLM (gpt-5.6-sol) - 0G AI</option>
                          <option value="myca-local">Myca Local Engine (0-Cost, Çevrimdışı)</option>
                          <option value="ollama-llama3">Ollama Local Bridge (Llama 3 / Hermes)</option>
                          <option value="claude-3.5-sonnet">Claude 3.5 Sonnet / Fable 5</option>
                          <option value="deepseek-v3">DeepSeek V3 / Pro</option>
                        </select>
                      ) : paramType === 'textarea' ? (
                        <textarea
                          rows={3}
                          placeholder={paramDesc || `Değer girin: ${paramName}`}
                          value={localInputs[paramName] || ''}
                          onChange={e => handleInputChange(paramName, e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 8,
                            background: '#090b14', border: `1px solid ${isFilled ? 'rgba(0, 232, 122, 0.25)' : 'rgba(255, 107, 107, 0.25)'}`,
                            color: '#ffffff', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                            fontFamily: 'sans-serif', resize: 'vertical'
                          }}
                        />
                      ) : (
                        <input 
                          type={paramType === 'password' ? 'password' : 'text'}
                          placeholder={paramDesc || `Değer girin: ${paramName}`}
                          value={localInputs[paramName] || ''}
                          onChange={e => handleInputChange(paramName, e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 8,
                            background: '#090b14', border: `1px solid ${isFilled ? 'rgba(0, 232, 122, 0.25)' : 'rgba(255, 107, 107, 0.25)'}`,
                            color: '#ffffff', fontSize: 12, outline: 'none', boxSizing: 'border-box'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Optional Input Parameters Section (collapsible) */}
            {optionalInputs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <button 
                  onClick={() => setShowOptional(!showOptional)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 0',
                    border: 'none', background: 'transparent', color: '#a0a0b2', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'
                  }}
                >
                  {showOptional ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Opsiyonel Parametreler ({optionalInputs.length})
                </button>
                
                {showOptional && optionalInputs.map((inp, i) => {
                  const paramName = typeof inp === 'string' ? inp : inp.name;
                  const paramType = typeof inp === 'object' ? inp.type : 'text';
                  const paramDesc = typeof inp === 'object' ? inp.description : '';

                  return (
                    <div key={`opt_${i}`} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#a0a0b2' }}>
                          {paramName} <span style={{ fontSize: 9, color: '#666', fontStyle: 'italic' }}>(opsiyonel)</span>
                        </label>
                        {paramDesc && <span style={{ fontSize: 10, color: '#666', maxWidth: '60%', textAlign: 'right' }}>{paramDesc}</span>}
                      </div>
                      {paramName === 'model' ? (
                        <select
                          value={localInputs[paramName] || 'gpt-5.6-sol'}
                          onChange={e => handleInputChange(paramName, e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 8,
                            background: '#090b14', border: '1px solid rgba(0, 232, 122, 0.35)',
                            color: '#00e87a', fontSize: 12, outline: 'none', boxSizing: 'border-box'
                          }}
                        >
                          <option value="gpt-5.6-sol">Myca LLM (gpt-5.6-sol) - 0G AI</option>
                          <option value="myca-local">Myca Local Engine (0-Cost, Çevrimdışı)</option>
                          <option value="ollama-llama3">Ollama Local Bridge (Llama 3 / Hermes)</option>
                          <option value="claude-3.5-sonnet">Claude 3.5 Sonnet / Fable 5</option>
                          <option value="deepseek-v3">DeepSeek V3 / Pro</option>
                        </select>
                      ) : (
                        <input 
                          type="text"
                          placeholder={paramDesc || `Opsiyonel: ${paramName}`}
                          value={localInputs[paramName] || ''}
                          onChange={e => handleInputChange(paramName, e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 8,
                            background: '#090b14', border: '1px solid rgba(255,255,255,0.08)',
                            color: '#ffffff', fontSize: 12, outline: 'none', boxSizing: 'border-box'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {requiredInputs.length === 0 && requiredCredentials.length === 0 && optionalInputs.length === 0 && (
              <p style={{ color: '#a0a0b2', fontSize: 12, margin: 0, fontStyle: 'italic' }}>Bu modül için yapılandırma gerekmiyor. Doğrudan çalıştırılabilir.</p>
            )}
          </div>
        )}

        {activeTab === 'general' && (
          <div style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0b2' }}>Node ID:</span>
              <code style={{ color: '#00e87a', background: 'rgba(0,232,122,0.1)', padding: '2px 6px', borderRadius: 4 }}>{id}</code>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0b2' }}>Skill ID:</span>
              <code style={{ color: '#00e87a', background: 'rgba(0,232,122,0.1)', padding: '2px 6px', borderRadius: 4 }}>{skillId}</code>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0b2' }}>Status:</span>
              <span style={{ color: data?.status === 'completed' ? '#00e87a' : data?.status === 'running' ? '#ffb703' : '#a0a0b2', fontWeight: 700, textTransform: 'uppercase' }}>
                {data?.status || 'idle'}
              </span>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0b2' }}>Runtime Target:</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{manifest.runtime || 'local'}</span>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0b2' }}>Required Inputs:</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{requiredInputs.length}</span>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0b2' }}>Optional Inputs:</span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{optionalInputs.length}</span>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0b2' }}>Credentials:</span>
              <span style={{ color: requiredCredentials.length > 0 ? '#ffb703' : '#00e87a', fontWeight: 600 }}>
                {requiredCredentials.length > 0 ? `${requiredCredentials.length} required` : 'None'}
              </span>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a0a0b2' }}>Validation:</span>
              <span style={{ color: isValid ? '#00e87a' : '#ff6b6b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                {isValid ? <><CheckCircle2 size={12} /> Ready</> : <><AlertCircle size={12} /> Missing {missingRequired.length + missingCredentials.length} fields</>}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowInspector;

