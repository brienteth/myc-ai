import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, FileText, Image as ImageIcon, Music, Video, Code, Globe, Clock, Trash2, Upload, File as FileIcon } from 'lucide-react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [urlInput, setUrlInput] = useState('');

  const fetchFiles = useCallback(async () => {
    try {
      const typeParam = activeCategory === 'all' || activeCategory === 'recent' ? activeCategory : activeCategory;
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

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

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
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleFileClick = async (fileId) => {
    try {
      const res = await fetch(`http://localhost:8420/library/files/${fileId}`);
      const data = await res.json();
      setSelectedFile(data);
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

  return (
    <div className="library-container">
      <div className="library-header">
        <h1>Library</h1>
        <div className="search-bar">
          <Search size={18} color="#86868b" />
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="library-content">
        <div className="library-sidebar">
          <ul className="category-list">
            {CATEGORIES.map(cat => (
              <li 
                key={cat.id} 
                className={activeCategory === cat.id ? 'active' : ''}
                onClick={() => { setActiveCategory(cat.id); setSelectedFile(null); }}
              >
                <cat.icon size={16} />
                <span>{cat.label}</span>
              </li>
            ))}
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
                <div className="upload-spinner"><Upload className="spinner-icon" /> Uploading...</div>
              ) : (
                <p>{getEmptyStateText()}</p>
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
                  <button className="delete-btn" onClick={(e) => deleteFile(e, f.id)}>
                    <Trash2 size={14} />
                  </button>
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
              </div>
              <div className="detail-summary">
                <strong>AI Summary:</strong>
                <p>{selectedFile.summary}</p>
              </div>
              <div className="detail-content">
                <strong>Content (First 2000 characters):</strong>
                <pre>{selectedFile.content || "Empty content or media file."}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
