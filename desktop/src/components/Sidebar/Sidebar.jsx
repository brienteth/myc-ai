import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Library as LibraryIcon, Zap, Network, Settings, Cpu, Share2, Building2, Brain } from 'lucide-react';
import '../Layout/Layout.css';
import { useTranslation } from '../../hooks/useTranslation';

const Sidebar = () => {
  const { t } = useTranslation();

  return (
    <div className="sidebar">
      <div className="sidebar-header-row" style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--f-bark, #DDD7CB)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M 100 28 C 50 28 35 72 42 98 C 62 98 75 90 100 90 C 125 90 138 98 158 98 C 165 72 150 28 100 28 Z" stroke="#00e87a" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 52 98 Q 100 86 148 98" stroke="#00e87a" strokeWidth="4" opacity="0.8" />
            <path d="M 91 92 Q 88 122 84 142 C 95 145 105 145 116 142 Q 112 122 109 92" stroke="#00e87a" strokeWidth="6" strokeLinecap="round" />
            <path d="M 86 142 Q 68 162 42 158" stroke="#00e87a" strokeWidth="5" strokeLinecap="round" />
            <circle cx="42" cy="158" r="5" fill="#00e87a" />
            <path d="M 92 143 Q 78 178 62 188" stroke="#00e87a" strokeWidth="4" strokeLinecap="round" />
            <circle cx="62" cy="188" r="4" fill="#00e87a" />
            <path d="M 100 144 L 100 192" stroke="#00e87a" strokeWidth="5" strokeLinecap="round" />
            <circle cx="100" cy="192" r="5" fill="#00e87a" />
            <path d="M 108 143 Q 122 178 138 188" stroke="#00e87a" strokeWidth="4" strokeLinecap="round" />
            <circle cx="138" cy="188" r="4" fill="#00e87a" />
            <path d="M 114 142 Q 132 162 158 158" stroke="#00e87a" strokeWidth="5" strokeLinecap="round" />
            <circle cx="158" cy="158" r="5" fill="#00e87a" />
          </svg>
          <span style={{ fontSize: '17px', fontWeight: '700', fontFamily: 'var(--f-serif)', color: 'var(--f-deep)', fontStyle: 'italic' }}>myca os</span>
        </div>
        <span style={{ fontSize: '10px', fontFamily: 'var(--f-mono)', background: 'var(--f-bark)', padding: '2px 6px', borderRadius: '4px' }}>v0.1.0</span>
      </div>
      
      <nav className="sidebar-nav" style={{ padding: '12px 10px' }}>
        <div className="nav-section-label">MYCA EXECUTION OS</div>
        <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Share2 size={16} />
          <span>Assistant</span>
        </NavLink>
        <NavLink to="/library" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <LibraryIcon size={16} />
          <span>Knowledge OS</span>
        </NavLink>
        <NavLink to="/automation" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Zap size={16} />
          <span>Execution Studio</span>
        </NavLink>
        <NavLink to="/colony" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Network size={16} />
          <span>Colony Mesh</span>
        </NavLink>
        <NavLink to="/brain" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Brain size={16} />
          <span>Second Brain</span>
        </NavLink>

        <div className="nav-section-label" style={{ marginTop: '16px' }}>CAPABILITIES</div>
        <NavLink to="/skills" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Cpu size={16} />
          <span>Skills & MCP</span>
        </NavLink>
        <NavLink to="/enterprise" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Building2 size={16} />
          <span>Enterprise</span>
        </NavLink>
        <NavLink to="/models" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Cpu size={16} />
          <span>Models</span>
        </NavLink>

        <div className="nav-section-label" style={{ marginTop: '16px' }}>SYSTEM</div>
        <NavLink to="/settings" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Settings size={16} />
          <span>Settings</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer-pill" style={{ padding: '12px 16px', borderTop: '1px solid var(--f-bark, #DDD7CB)', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontFamily: 'var(--f-mono)', background: 'var(--f-parchment)', padding: '6px 10px', borderRadius: '20px', border: '1px solid var(--f-bark)' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00e87a' }}></div>
          <span style={{ color: 'var(--f-humus)' }}>m_dae2aebeb442</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
