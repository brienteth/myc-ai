import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Library as LibraryIcon, Zap, Network, Settings, Cpu, Share2 } from 'lucide-react';
import '../Layout/Layout.css';
import { useTranslation } from '../../hooks/useTranslation';

const Sidebar = () => {
  const { t } = useTranslation();

  return (
    <div className="sidebar">
      <div className="sidebar-top">
        {/* Placeholder for top area if needed, maybe app logo? */}
      </div>
      
      <nav className="sidebar-nav">
        <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Home size={18} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/library" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <LibraryIcon size={18} />
          <span>Library</span>
        </NavLink>
        <NavLink to="/automation" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Zap size={18} />
          <span>Automation</span>
        </NavLink>
        <NavLink to="/colony" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Network size={18} />
          <span>Colony</span>
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <NavLink to="/settings" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
      </div>
    </div>
  );
};

export default Sidebar;
