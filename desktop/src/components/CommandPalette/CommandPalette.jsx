import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import './CommandPalette.css';

const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    // Listen for OS/Electron messages if we implemented ipcRenderer,
    // but for now, just listen to global DOM events for web prototyping
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K' || e.key === ' ')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="palette-container" onClick={(e) => e.stopPropagation()}>
        <div className="palette-search">
          <Search size={20} color="#86868b" />
          <input 
            type="text" 
            placeholder="Ask Myca, Search, Translate..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="palette-results">
          <div className="palette-section">ACTIONS</div>
          <ul>
            <li className="active">
              <span className="icon">💬</span> Ask Myca
            </li>
            <li>
              <span className="icon">📄</span> Summarize PDF
            </li>
            <li>
              <span className="icon">🌍</span> Translate Text
            </li>
            <li>
              <span className="icon">⚙️</span> Settings
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
