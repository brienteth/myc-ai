import React, { useState, useEffect } from 'react';
import { Cpu, Server, CheckCircle2, Sparkles, Shield, Zap } from 'lucide-react';

const Models = () => {
  const [activeModel, setActiveModel] = useState(() => {
    return localStorage.getItem('myca_active_model') || 'gpt-5.6-sol';
  });

  const models = [
    { 
      id: 'gpt-5.6-sol', 
      name: 'Myca LLM (gpt-5.6-sol)', 
      provider: 'Myca Engine (Ana Model)',
      desc: 'Kurumsal otomasyon, karmaşık karar mekanizmaları, kod üretimi ve yüksek kaliteli yanıtlar için varsayılan model.',
      quant: 'FP16', 
      isDefault: true,
      status: activeModel === 'gpt-5.6-sol' ? 'active' : 'available', 
      speed: '110ms'
    },
    { 
      id: 'myca-local', 
      name: 'Myca Local Engine (Yerel)', 
      provider: 'Local Device (Offline)',
      desc: 'İnternet bağlantısı gerektirmeyen, cihazınızın GPU/CPU kaynağında %100 yerel çalışan gizli motor.',
      quant: 'Q4_K_M', 
      isDefault: false,
      status: activeModel === 'myca-local' ? 'active' : 'available', 
      speed: '0ms'
    },
    { 
      id: 'claude-3.5-sonnet', 
      name: 'Claude 3.5 Sonnet / Fable 5', 
      provider: 'Anthropic Engine',
      desc: 'Yaratıcı metin üretimi, teknik dokümantasyon, mimari tasarım ve felsefi mantık yürütme.',
      quant: 'FP16', 
      isDefault: false,
      status: activeModel === 'claude-3.5-sonnet' ? 'active' : 'available', 
      speed: '130ms'
    },
    { 
      id: 'deepseek-v3', 
      name: 'DeepSeek V3 / V4 Pro', 
      provider: 'DeepSeek Engine',
      desc: 'İleri düzey yazılım geliştirme, karmaşık algoritmalar, hata ayıklama ve kod refactoring.',
      quant: 'FP16', 
      isDefault: false,
      status: activeModel === 'deepseek-v3' ? 'active' : 'available', 
      speed: '95ms'
    },
    { 
      id: 'ollama-llama3', 
      name: 'Ollama / Llama 3 (8B/70B)', 
      provider: 'Ollama Local Bridge',
      desc: 'Sisteminizde yüklü Ollama modelleri üzerinden çevrimdışı açık kaynak model entegrasyonu.',
      quant: 'Q4_K_M', 
      isDefault: false,
      status: activeModel === 'ollama-llama3' ? 'active' : 'available', 
      speed: '25ms'
    }
  ];

  const handleSelectModel = async (modelId) => {
    setActiveModel(modelId);
    localStorage.setItem('myca_active_model', modelId);
    try {
      await fetch('http://127.0.0.1:8420/settings/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId })
      });
    } catch (_) {}
  };

  return (
    <div style={{ padding: '48px', background: 'var(--f-cream)', height: '100vh', overflowY: 'auto' }}>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="f-serif-italic" style={{ fontSize: '32px', color: 'var(--f-deep)', marginBottom: '6px' }}>Model & Çıkarım Motoru</h1>
          <p style={{ color: 'var(--f-soil)', fontFamily: 'var(--f-sans)', fontSize: '13.5px' }}>
            Myca Execution OS için aktif yapay zeka modelinizi seçin. Varsayılan olarak yüksek çözünürlüklü <strong>Myca LLM (gpt-5.6-sol)</strong> kullanılır.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--f-parchment)', border: '1px solid var(--f-bark)', padding: '8px 16px', borderRadius: '100px', fontSize: '12px', color: 'var(--f-soil)', fontFamily: 'var(--f-mono)' }}>
          <Shield size={14} color="var(--f-moss)" /> Çıkarım Motoru: Hazır
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {models.map(m => (
          <div key={m.id} style={{
            background: 'var(--f-parchment)', 
            border: m.status === 'active' ? '2px solid var(--f-moss, #2e6b45)' : '1px solid var(--f-bark, #DDD7CB)', 
            borderRadius: '16px',
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            justify: 'space-between',
            gap: '16px',
            boxShadow: m.status === 'active' ? '0 4px 20px rgba(46, 107, 69, 0.12)' : 'var(--f-shadow-sm)',
            position: 'relative'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '42px', height: '42px', borderRadius: '10px', 
                    background: m.status === 'active' ? 'var(--f-moss, #2e6b45)' : '#ffffff',
                    border: '1px solid var(--f-bark)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: m.status === 'active' ? '#ffffff' : 'var(--f-soil)'
                  }}>
                    <Cpu size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', color: 'var(--f-deep)', fontWeight: '600', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {m.name}
                      {m.isDefault && <span style={{ fontSize: '10px', background: 'rgba(46, 107, 69, 0.12)', color: 'var(--f-moss)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--f-mono)' }}>Varsayılan</span>}
                    </h3>
                    <div style={{ fontSize: '11px', color: 'var(--f-soil)', fontFamily: 'var(--f-mono)' }}>{m.provider}</div>
                  </div>
                </div>
                {m.status === 'active' && (
                  <div style={{
                    background: 'var(--f-moss, #2e6b45)', color: '#ffffff', padding: '4px 10px',
                    borderRadius: '12px', fontSize: '10px', fontWeight: '700', fontFamily: 'var(--f-mono)',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <CheckCircle2 size={12} /> AKTİF
                  </div>
                )}
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--f-soil)', margin: '0', lineHeight: '1.5' }}>
                {m.desc}
              </p>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--f-bark)', paddingTop: '16px',
              fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--f-soil)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Server size={14} /> Gecikme: {m.speed}</div>
              {m.status !== 'active' ? (
                <button 
                  onClick={() => handleSelectModel(m.id)}
                  style={{
                    background: 'var(--f-cream)', border: '1px solid var(--f-moss)', color: 'var(--f-moss)',
                    padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Modeli Kullan
                </button>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--f-moss)', fontWeight: '600' }}>Kullanımda</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Models;
