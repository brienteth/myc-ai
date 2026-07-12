import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, MessageSquare, Library as LibraryIcon, MonitorSmartphone, Settings } from 'lucide-react';
import '../Layout/Layout.css';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-top" style={{height: "30px"}}>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Home size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/library" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <LibraryIcon size={20} />
          <span>Library</span>
        </NavLink>
        <NavLink to="/devices" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <MonitorSmartphone size={20} />
          <span>Devices</span>
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <NavLink to="/settings" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
      </div>
    </div>
  );
};

export default Sidebar;
