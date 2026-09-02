import React, { useState } from 'react';
import { FlaskConical, ExternalLink, RefreshCw, Cpu } from 'lucide-react';
import './SimuleView.css';

const SimuleView = () => {
  const [key, setKey] = useState(0);

  const handleRefresh = () => {
    setKey(prev => prev + 1);
  };

  return (
    <div className="simule-view-container">
      {/* Lab Header Bar */}
      <div className="simule-topbar">
        <div className="simule-topbar-left">
          <div className="simule-icon-box">
            <FlaskConical size={18} color="#00e87a" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 className="simule-title">MYCA Research Lab</h2>
              <span className="simule-badge-live">● LOCAL COGNITIVE CORE</span>
            </div>
            <p className="simule-subtitle">
              Bio-Spectral Cognitive Computing · GHR, HDC, Neural Reservoirs & Quantum Simulation
            </p>
          </div>
        </div>

        <div className="simule-topbar-right">
          <div className="simule-stat-chip">
            <Cpu size={13} color="var(--f-moss)" />
            <span>Resonance Core: 3500</span>
          </div>
          <button className="simule-btn" onClick={handleRefresh} title="Simülasyonu Yenile">
            <RefreshCw size={13} /> Yenile
          </button>
          <a
            href="https://www.mycai.pro/simule"
            target="_blank"
            rel="noopener noreferrer"
            className="simule-btn simule-btn-primary"
            title="Tarayıcıda Tam Ekran Aç"
          >
            <span>Web'de Aç</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Main Interactive Research Lab Frame */}
      <div className="simule-frame-wrapper">
        <iframe
          key={key}
          src="https://grok-workspace-eta-henna.vercel.app"
          title="MYCA Research Lab - Cognitive Computing Sandbox"
          className="simule-iframe"
        />
      </div>
    </div>
  );
};

export default SimuleView;
