import React, { useState, useEffect } from 'react';
import { Cpu, Download, Server, Trash2, HardDrive, Zap, CheckCircle2 } from 'lucide-react';

const Models = () => {
  const [activeModel, setActiveModel] = useState('gpt-5.6-sol');
  const [keySaved, setKeySaved] = useState(true);

  const models = [
    { 
      id: 'auto', 
      name: '0G Smart Router (Auto)', 
      provider: '0G Compute Network',
      desc: 'Soru karmaşıklığına ve alanına göre otomatik model seçer (Basit sorular yerel motor ile yanıtlanır)',
      quant: 'Dynamic', 
      status: activeModel === 'auto' ? 'active' : 'available', 
      speed: '0ms - 200ms'
    },
    { 
      id: 'gpt-5.6-sol', 
      name: 'GPT-5.6 Sol', 
      provider: '0G Compute Network',
      desc: 'Genel karmaşık sorular, bilimsel analiz ve otomasyon yönetimi',
      quant: 'FP16', 
      status: activeModel === 'gpt-5.6-sol' ? 'active' : 'available', 
      speed: '120ms'
    },
    { 
      id: 'deepseek-v4-pro', 
      name: 'DeepSeek-V4-Pro', 
      provider: '0G Compute Network',
      desc: 'Yazılım geliştirme, algoritma tasarımı, matematik ve kod yazımı',
      quant: 'FP16', 
      status: activeModel === 'deepseek-v4-pro' ? 'active' : 'available', 
      speed: '95ms'
    },
    { 
      id: 'claude-fable-5', 
      name: 'Claude Fable 5', 
      provider: '0G Compute Network',
      desc: 'Yaratıcı içerik üretimi, felsefe, edebiyat ve karmaşık mantık yürütme',
      quant: 'FP16', 
      status: activeModel === 'claude-fable-5' ? 'active' : 'available', 
      speed: '110ms'
    },
    { 
      id: 'kimi-k3', 
      name: 'Kimi-K3', 
      provider: '0G Compute Network',
      desc: 'Uzun doküman analizi, çok dilli çeviri ve yapılandırılmış veri çıkarma',
      quant: 'FP16', 
      status: activeModel === 'kimi-k3' ? 'active' : 'available', 
      speed: '140ms'
    },
    { 
      id: 'myca-local', 
      name: 'Myca Local Engine (Yerel)', 
      provider: 'Local Device',
      desc: 'Basit sorular ve yerel işlemler için 0ms gecikmeli dahili motor',
      quant: 'Q4_K_M', 
      status: 'loaded', 
      speed: '0ms'
    }
  ];

  const handleSelectModel = async (modelId) => {
    setActiveModel(modelId);
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
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="f-serif-italic" style={{ fontSize: '32px', color: 'var(--f-deep)', marginBottom: '8px' }}>Model & Çıkarsama Motoru</h1>
          <p style={{ color: 'var(--f-stone)', fontFamily: 'var(--f-mono)', fontSize: '12px' }}>
            0G Compute Network (Zero Gravity) Dağıtık GPU Ağı & Yerel Motor Yönetimi
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 232, 122, 0.1)', border: '1px solid #00e87a', padding: '8px 16px', borderRadius: '100px', fontSize: '12px', color: '#00e87a', fontFamily: 'var(--f-mono)' }}>
          <Zap size={14} /> MYCA_MODEL_PATH Key: Aktif (sk-1aa5...)
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {models.map(m => (
          <div key={m.id} style={{
            background: 'var(--f-parchment)', border: m.status === 'active' ? '2px solid #00e87a' : '1px solid var(--f-bark)', borderRadius: '16px',
            padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: m.status === 'active' ? '0 0 16px rgba(0, 232, 122, 0.15)' : 'var(--f-shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '8px', 
                  background: m.status === 'active' ? '#00e87a' : 'var(--f-cream)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: m.status === 'active' ? '#0A0A14' : 'var(--f-stone)'
                }}>
                  <Cpu size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--f-deep)', fontWeight: '600', marginBottom: '2px' }}>{m.name}</h3>
                  <div style={{ fontSize: '11px', color: '#00e87a', fontFamily: 'var(--f-mono)' }}>{m.provider}</div>
                </div>
              </div>
              {m.status === 'active' && (
                <div style={{
                  background: '#00e87a', color: '#0A0A14', padding: '4px 8px',
                  borderRadius: '6px', fontSize: '10px', fontWeight: '700', fontFamily: 'var(--f-mono)',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  <CheckCircle2 size={12} /> AKTİF
                </div>
              )}
            </div>

            <p style={{ fontSize: '12px', color: 'var(--f-soil)', margin: '0', lineHeight: '1.4' }}>
              {m.desc}
            </p>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--f-bark)', paddingTop: '16px',
              fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--f-stone)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Server size={14} /> Gecikme: {m.speed}</div>
              {m.status !== 'active' && m.id !== 'myca-local' && (
                <button 
                  onClick={() => handleSelectModel(m.id)}
                  style={{
                    background: 'transparent', border: '1px solid #00e87a', color: '#00e87a',
                    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px'
                  }}
                >
                  Seç
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Models;
