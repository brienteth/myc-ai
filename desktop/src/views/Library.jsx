import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, FileText, Image as ImageIcon, Music, Video, Code, Globe, Clock, Trash2, Upload, File as FileIcon, Star, RefreshCw } from 'lucide-react';
import './Library.css';

const CATEGORIES = [
  { id: 'all', label: 'All Files', icon: FileIcon },
  { id: 'document', label: 'Documents', icon: FileText },
  { id: 'image', label: 'Images', icon: ImageIcon },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'code', label: 'Code', icon: Code },
  { id: 'research', label: 'Research', icon: Globe },
  { id: 'recent', label: 'Recent', icon: Clock }
];

const Library = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [stats, setStats] = useState({ total_files: 0, by_type: {} });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileInputRef = useRef(null);

  const handleFilePick = (e) => {
    const picked = e.target.files;
    if (picked && picked.length > 0) {
      Array.from(picked).forEach(f => uploadFile(f));
    }
    e.target.value = '';
  };

  const fetchFiles = useCallback(async () => {
    try {
      const typeParam = activeCategory;
      let url = `http://localhost:8420/library/files?type=${typeParam}`;
      if (searchQuery) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {
      console.error("Failed to fetch files:", e);
    }
  }, [activeCategory, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8420/library/stats');
      const data = await res.json();
      setStats(data || { total_files: 0, by_type: {} });
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  }, []);

  const fetchSuggestions = async (val) => {
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`http://localhost:8420/library/suggestions?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (e) {
      console.error("Failed to fetch suggestions:", e);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchStats();
  }, [fetchFiles, fetchStats]);

  const onDragOver = (e) => {
    e.preventDefault();
    if (activeCategory !== 'research') {
      setIsDragging(true);
    }
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (activeCategory === 'research') return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await uploadFile(file);
    }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await fetch('http://localhost:8420/library/add', {
        method: 'POST',
        body: formData,
      });
      fetchFiles();
      fetchStats();
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
    }
  };

  const addUrl = async (e) => {
    if (e.key === 'Enter' && urlInput.trim()) {
      setUploading(true);
      try {
        await fetch('http://localhost:8420/library/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlInput })
        });
        setUrlInput('');
        fetchFiles();
        fetchStats();
      } catch (err) {
        console.error("URL add failed:", err);
      } finally {
        setUploading(false);
      }
    }
  };

  const deleteFile = async (e, id) => {
    e.stopPropagation();
    try {
      await fetch(`http://localhost:8420/library/files/${id}`, {
        method: 'DELETE'
      });
      if (selectedFile?.id === id) {
        setSelectedFile(null);
      }
      fetchFiles();
      fetchStats();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const toggleFavorite = async (e, id) => {
    e.stopPropagation();
    try {
      const res = await fetch(`http://localhost:8420/library/files/${id}/favorite`, {
        method: 'POST'
      });
      const data = await res.json();
      
      // Update local state
      setFiles(files.map(f => f.id === id ? { ...f, favorite: data.favorite ? 1 : 0 } : f));
      if (selectedFile?.id === id) {
        setSelectedFile({ ...selectedFile, favorite: data.favorite ? 1 : 0 });
      }
    } catch (err) {
      console.error("Favorite toggle failed:", err);
    }
  };

  const handleFileClick = async (fileId) => {
    try {
      const res = await fetch(`http://localhost:8420/library/files/${fileId}`);
      const data = await res.json();
      setSelectedFile(data);
      // Access call triggers internal Recents log
      fetchFiles();
    } catch (e) {
      console.error("Failed to load file details:", e);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getEmptyStateText = () => {
    switch (activeCategory) {
      case 'document': return "Drop a PDF or Word document — myc will read it";
      case 'image': return "Drop an image — myc will analyze it";
      case 'audio': return "Drop an audio file — myc will transcribe it";
      case 'code': return "Drop a source code file — myc will read it";
      default: return "Drag and drop your files here";
    }
  };

  const getCategoryIcon = (type) => {
    const cat = CATEGORIES.find(c => c.id === type);
    const Icon = cat ? cat.icon : FileIcon;
    return <Icon size={24} color="#86868b" />;
  };

  const getCountBadge = (catId) => {
    if (catId === 'all') return stats.total_files || 0;
    if (catId === 'recent') return '';
    return stats.by_type[catId]?.count || 0;
  };

  return (
    <div className="library-container">
      <div className="library-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1>Library</h1>
          <button className="upload-btn" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} />
            <span>Upload Files</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFilePick}
          />
        </div>
        
        <div className="search-wrapper">
          <div className="search-bar">
            <Search size={18} color="#86868b" />
            <input 
              type="text" 
              placeholder="Search (semantic)..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchSuggestions(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <ul className="suggestions-dropdown">
              {suggestions.map((s, idx) => (
                <li key={idx} onClick={() => { setSearchQuery(s); setShowSuggestions(false); }}>
                  <Search size={12} style={{ marginRight: '8px' }} />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      <div className="library-content">
        <div className="library-sidebar">
          <ul className="category-list">
            {CATEGORIES.map(cat => {
              const count = getCountBadge(cat.id);
              return (
                <li 
                  key={cat.id} 
                  className={activeCategory === cat.id ? 'active' : ''}
                  onClick={() => { setActiveCategory(cat.id); setSelectedFile(null); }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <cat.icon size={16} />
                    <span>{cat.label}</span>
                  </div>
                  {count !== '' && count > 0 && (
                    <span className="count-badge">{count}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        
        <div className="library-main">
          {activeCategory === 'research' ? (
            <div className="url-input-zone">
              <Globe size={32} color="#a1a1a6" />
              <input 
                type="text" 
                placeholder="Paste URL and press Enter (e.g. https://en.wikipedia.org/wiki/...)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={addUrl}
                disabled={uploading}
              />
              {uploading && <span className="uploading-text">Analyzing URL...</span>}
            </div>
          ) : (
            <div 
              className={`drop-zone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              {uploading ? (
                <div className="upload-spinner"><RefreshCw className="spin-icon" /> Indexing & Embedding...</div>
              ) : (
                <>
                  <Upload size={28} color="#86868b" />
                  <p>{getEmptyStateText()}</p>
                  <button className="browse-btn" onClick={() => fileInputRef.current?.click()}>Browse Files</button>
                </>
              )}
            </div>
          )}

          <div className="knowledge-grid">
            {files.map(f => (
              <div 
                key={f.id} 
                className={`file-card ${selectedFile?.id === f.id ? 'selected' : ''}`}
                onClick={() => handleFileClick(f.id)}
              >
                <div className="file-card-header">
                  {getCategoryIcon(f.type)}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      className={`fav-btn ${f.favorite ? 'active' : ''}`} 
                      onClick={(e) => toggleFavorite(e, f.id)}
                      title="Favorite"
                    >
                      <Star size={14} fill={f.favorite ? "var(--accent-primary)" : "none"} />
                    </button>
                    <button className="delete-btn" onClick={(e) => deleteFile(e, f.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="file-card-body">
                  <h3 className="file-name" title={f.filename}>{f.filename}</h3>
                  <p className="file-summary" title={f.summary}>{f.summary || 'No summary available'}</p>
                </div>
                <div className="file-card-footer">
                  <span className="file-size">{formatSize(f.size_bytes)}</span>
                  <span className="file-date">{new Date(f.created_at * 1000).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedFile && (
          <div className="file-detail-panel">
            <div className="detail-header">
              <h2>{selectedFile.filename}</h2>
              <button className="close-btn" onClick={() => setSelectedFile(null)}>×</button>
            </div>
            <div className="detail-body">
              <div className="detail-meta">
                <span><strong>Type:</strong> {selectedFile.type}</span>
                <span><strong>Size:</strong> {formatSize(selectedFile.size_bytes)}</span>
                {selectedFile.page_count > 1 && <span><strong>Pages:</strong> {selectedFile.page_count}</span>}
                {selectedFile.duration_seconds > 0 && <span><strong>Duration:</strong> {selectedFile.duration_seconds}s</span>}
                {selectedFile.resolution && selectedFile.resolution !== 'Unknown' && <span><strong>Resolution:</strong> {selectedFile.resolution}</span>}
                {selectedFile.language && <span><strong>Language:</strong> {selectedFile.language}</span>}
              </div>
              <div className="detail-summary">
                <strong>AI Summary:</strong>
                <p>{selectedFile.summary}</p>
              </div>
              <div className="detail-content">
                <strong>Content Excerpt:</strong>
                <pre>{selectedFile.content || "Empty content or media binary file."}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
