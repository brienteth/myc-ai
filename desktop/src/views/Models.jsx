import React from 'react';
import { Cpu, Download, Server, Trash2, HardDrive } from 'lucide-react';

const Models = () => {
  const models = [
    { id: 1, name: 'Myca Core 3B (Optimized)', size: '2.1 GB', quant: 'Q4_K_M', status: 'loaded', ram: '2.4 GB', speed: '12.4' },
    { id: 2, name: 'Myca Vision 7B', size: '4.1 GB', quant: 'Q4_0', status: 'idle', ram: '-', speed: '-' },
    { id: 3, name: 'Whisper Base (Audio)', size: '142 MB', quant: 'FP16', status: 'idle', ram: '-', speed: '-' }
  ];

  return (
    <div style={{ padding: '48px', background: 'var(--f-cream)', height: '100vh', overflowY: 'auto' }}>
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="f-serif-italic" style={{ fontSize: '32px', color: 'var(--f-deep)', marginBottom: '8px' }}>Models</h1>
          <p style={{ color: 'var(--f-stone)', fontFamily: 'var(--f-mono)', fontSize: '12px' }}>Local intelligence powering the colony</p>
        </div>
        <button style={{
          background: 'var(--f-moss)', color: 'var(--f-cream)', border: 'none', borderRadius: '8px',
          padding: '10px 20px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <Download size={16} /> Download New
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {models.map(m => (
          <div key={m.id} style={{
            background: 'var(--f-parchment)', border: '1px solid var(--f-bark)', borderRadius: '16px',
            padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: m.status === 'loaded' ? '0 0 0 1px var(--f-spore)' : 'var(--f-shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '8px', 
                  background: m.status === 'loaded' ? 'var(--f-glow)' : 'var(--f-cream)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: m.status === 'loaded' ? 'var(--f-moss)' : 'var(--f-stone)'
                }}>
                  <Cpu size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--f-deep)', fontWeight: '500', marginBottom: '4px' }}>{m.name}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--f-soil)' }}>{m.size} · {m.quant}</div>
                </div>
              </div>
              {m.status === 'loaded' && (
                <div style={{
                  background: 'var(--f-glow)', color: 'var(--f-thread)', padding: '4px 8px',
                  borderRadius: '6px', fontSize: '10px', fontFamily: 'var(--f-mono)'
                }}>IN MEMORY</div>
              )}
            </div>

            <div style={{
              display: 'flex', gap: '16px', borderTop: '1px solid var(--f-bark)', paddingTop: '16px',
              fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--f-stone)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><HardDrive size={14} /> {m.ram} RAM</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Server size={14} /> {m.speed} tok/s</div>
              <div style={{ flexGrow: 1, textAlign: 'right' }}>
                <Trash2 size={14} style={{ cursor: 'pointer' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Models;
