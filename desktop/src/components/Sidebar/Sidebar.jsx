import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Library as LibraryIcon, Zap, Network, Settings, Cpu, Share2, Building2, Brain } from 'lucide-react';
import '../Layout/Layout.css';
import { useTranslation } from '../../hooks/useTranslation';
import logoImg from '../../assets/logo.png';

const Sidebar = () => {
  const { t } = useTranslation();

  return (
    <div className="sidebar">
      <div className="sidebar-header-row" style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--f-bark, #DDD7CB)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={logoImg} alt="Myca OS" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} />
          <span style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'var(--f-serif)', color: 'var(--f-deep)', fontStyle: 'italic' }}>myca os</span>
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
