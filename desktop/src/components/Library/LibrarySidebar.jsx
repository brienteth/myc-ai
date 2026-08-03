import React from 'react';
import { Home, Clock, FileText, BookOpen, Image, Code, Music, Video, Pin, Trash2, HardDrive, Sparkles } from 'lucide-react';
import '../../views/Library.css';

const CATEGORIES = [
  { id: 'home', label: 'Library Home', icon: <Home size={16} /> },
  { id: 'recent', label: 'Recent Timeline', icon: <Clock size={16} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={16} /> },
  { id: 'research', label: 'Research Workspace', icon: <BookOpen size={16} /> },
  { id: 'images', label: 'Images & Photos', icon: <Image size={16} /> },
  { id: 'code', label: 'Code Repositories', icon: <Code size={16} /> },
  { id: 'audio', label: 'Audio & Voice', icon: <Music size={16} /> },
  { id: 'video', label: 'Video & Subtitles', icon: <Video size={16} /> }
];

const SYSTEM = [
  { id: 'pinned', label: 'Pinned Knowledge', icon: <Pin size={16} /> },
  { id: 'trash', label: 'Trash (30 Days)', icon: <Trash2 size={16} /> },
  { id: 'storage', label: 'Storage & Embeddings', icon: <HardDrive size={16} /> }
];

const LibrarySidebar = ({ activeCat, setActiveCat }) => {
  return (
    <div className="library-sidebar">
      <div className="sidebar-brand-badge" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--f-bark, #e6e0d6)' }}>
        <Sparkles size={18} color="var(--f-moss, #2e6b45)" />
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: 'var(--f-deep, #141424)' }}>Knowledge OS</span>
      </div>

      <h2>Categories</h2>
      <div className="sidebar-group">
        {CATEGORIES.map(c => (
          <button 
            key={c.id} 
            className={`category-item ${activeCat === c.id ? 'active' : ''}`}
            onClick={() => setActiveCat(c.id)}
          >
            {c.icon}
            <span>{c.label}</span>
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
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--f-bark, #e6e0d6)', fontSize: 11, color: 'var(--f-stone, #7a7670)' }}>
        <div>🔒 100% Local-First Engine</div>
        <div style={{ marginTop: 2 }}>Zero Cloud Dependency</div>
      </div>
    </div>
  );
};

export default LibrarySidebar;
