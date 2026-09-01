import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { MessageCircle, Zap, Network, Brain, Settings } from 'lucide-react';
import './MobileNav.css';

const MobileNav = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isMobile) return null;

  return (
    <nav className="mobile-nav-bar">
      <NavLink to="/" end className={({ isActive }) => isActive ? "mobile-nav-item active" : "mobile-nav-item"}>
        <MessageCircle size={20} />
        <span>Chat</span>
      </NavLink>
      <NavLink to="/automation" className={({ isActive }) => isActive ? "mobile-nav-item active" : "mobile-nav-item"}>
        <Zap size={20} />
        <span>Exec OS</span>
      </NavLink>
      <NavLink to="/colony" className={({ isActive }) => isActive ? "mobile-nav-item active" : "mobile-nav-item"}>
        <Network size={20} />
        <span>Colony</span>
      </NavLink>
      <NavLink to="/brain" className={({ isActive }) => isActive ? "mobile-nav-item active" : "mobile-nav-item"}>
        <Brain size={20} />
        <span>Brain</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => isActive ? "mobile-nav-item active" : "mobile-nav-item"}>
        <Settings size={20} />
        <span>Settings</span>
      </NavLink>
    </nav>
  );
};

export default MobileNav;
