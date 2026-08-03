import React from 'react';
import { Home, Clock, FileText, BookOpen, Image, Code, Music, Video, Pin, Trash2, HardDrive } from 'lucide-react';
import '../../views/Library.css';

const CATEGORIES = [
  { id: 'home', label: 'Library', icon: <Home size={16} /> },
  { id: 'recent', label: 'Recent', icon: <Clock size={16} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={16} /> },
  { id: 'research', label: 'Research', icon: <BookOpen size={16} /> },
  { id: 'images', label: 'Images', icon: <Image size={16} /> },
  { id: 'code', label: 'Code', icon: <Code size={16} /> },
  { id: 'audio', label: 'Audio', icon: <Music size={16} /> },
  { id: 'video', label: 'Video', icon: <Video size={16} /> }
];

const SYSTEM = [
  { id: 'pinned', label: 'Pinned', icon: <Pin size={16} /> },
  { id: 'trash', label: 'Trash', icon: <Trash2 size={16} /> },
  { id: 'storage', label: 'Storage', icon: <HardDrive size={16} /> }
];

const LibrarySidebar = ({ activeCat, setActiveCat }) => {
  return (
    <div className="library-sidebar">
      <h2>Categories</h2>
      <div className="sidebar-group">
        {CATEGORIES.map(c => (
          <button 
            key={c.id} 
            className={`category-item ${activeCat === c.id ? 'active' : ''}`}
            onClick={() => setActiveCat(c.id)}
          >
            {c.icon}
            {c.label}
          </button>
        ))}
      </div>

      <h2 style={{ marginTop: 24 }}>System</h2>
      <div className="sidebar-group">
        {SYSTEM.map(c => (
          <button 
            key={c.id} 
            className={`category-item ${activeCat === c.id ? 'active' : ''}`}
            onClick={() => setActiveCat(c.id)}
          >
            {c.icon}
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LibrarySidebar;
