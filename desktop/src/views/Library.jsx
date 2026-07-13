import React, { useState, useEffect, useRef } from 'react';
import LibrarySidebar from '../components/Library/LibrarySidebar';
import LibraryTopBar from '../components/Library/LibraryTopBar';
import LibraryHome from '../components/Library/LibraryHome';
import DocumentSplitView from '../components/Library/DocumentSplitView';
import ResearchWorkspace from '../components/Library/ResearchWorkspace';
import { FileText, Image, Code, Music, Video, Box, UploadCloud, Trash2, Star } from 'lucide-react';
import './Library.css';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (ts) => {
  if (!ts) return 'recently';
  const d = new Date(ts * 1000);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
};

const Library = () => {
  const [activeCat, setActiveCat] = useState('home');
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [storageStats, setStorageStats] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    if (activeCat === 'storage') {
      fetchStorageStats();
    }
  }, [activeCat]);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8420/library/files?type=all');
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error("Failed to fetch library files:", e);
      setFiles([]);
    }
    setIsLoading(false);
  };

  const fetchStorageStats = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8420/library/stats');
      if (res.ok) {
        const data = await res.json();
        setStorageStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch storage stats:", e);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      fetchFiles();
      return;
    }
    setIsLoading(true);
    try {
      const typeFilter = activeCat === 'home' || activeCat === 'recent' || activeCat === 'research' || activeCat === 'storage' || activeCat === 'pinned' || activeCat === 'trash' ? 'all' : activeCat;
      const res = await fetch(`http://127.0.0.1:8420/library/files?type=${typeFilter}&q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error("Search failed:", e);
    }
    setIsLoading(false);
  };

  const handleDelete = async (fileId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this file?')) return;
    try {
      await fetch(`http://127.0.0.1:8420/library/files/${fileId}`, { method: 'DELETE' });
      setFiles(files.filter(f => f.id !== fileId));
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const handleFavorite = async (fileId, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`http://127.0.0.1:8420/library/files/${fileId}/favorite`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setFiles(files.map(f => f.id === fileId ? { ...f, favorite: data.favorite ? 1 : 0 } : f));
      }
    } catch (e) {
      console.error("Favorite toggle failed:", e);
    }
  };

  const renderContent = () => {
    if (activeCat === 'home') {
      return <LibraryHome onSelectDoc={setSelectedDoc} />;
    }
    if (activeCat === 'research') {
      return <ResearchWorkspace document={selectedDoc} />;
    }
    if (activeCat === 'storage') {
      return (
        <div className="storage-view">
          <h2>Storage Management</h2>
          {storageStats ? (
            <div className="storage-stats">
              <div>Total Files: {storageStats.total_files}</div>
              <div>Total Size: {formatBytes(storageStats.total_size_bytes)}</div>
              {Object.entries(storageStats.by_type || {}).map(([type, info]) => (
                <div key={type}>{type}: {info.count} files ({formatBytes(info.size_bytes)})</div>
              ))}
            </div>
          ) : (
            <div style={{color: 'var(--f-earth)'}}>Loading stats...</div>
          )}
          <button className="primary-btn" style={{marginTop: 20}} onClick={async () => {
            if (confirm('Delete ALL library files? This cannot be undone.')) {
              await fetch('http://127.0.0.1:8420/library/all', { method: 'DELETE' });
              fetchFiles();
              fetchStorageStats();
            }
          }}>Clean All Data</button>
        </div>
      );
    }

    if (activeCat === 'pinned') {
      // Show only favorited files
      const pinnedFiles = files.filter(f => f.favorite === 1);
      return renderFileGrid(pinnedFiles, false);
    }

    if (activeCat === 'trash') {
      return (
        <div style={{color: 'var(--f-stone)', padding: 40, textAlign: 'center'}}>
          <Trash2 size={48} style={{opacity: 0.3, marginBottom: 16}} />
          <h3>Trash is Empty</h3>
          <p>Deleted files are permanently removed.</p>
        </div>
      );
    }

    // Grid view for other categories
    const filteredFiles = files.filter(f => {
      if (activeCat === 'recent') return true;
      if (activeCat === 'documents') return f.type === 'document';
      if (activeCat === 'images') return f.type === 'image';
      if (activeCat === 'code') return f.type === 'code';
      if (activeCat === 'audio') return f.type === 'audio';
      if (activeCat === 'video') return f.type === 'video';
      return f.type === activeCat;
    });

    return renderFileGrid(filteredFiles, activeCat !== 'recent');
  };

  const renderFileGrid = (filteredFiles, showUpload = true) => {
    const handleFileChange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('http://127.0.0.1:8420/library/add', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          fetchFiles();
        }
      } catch (err) {
        console.error("Upload failed", err);
      }
      setIsLoading(false);
    };

    const getIcon = (type) => {
      if (type === 'document') return <FileText size={32} />;
      if (type === 'image') return <Image size={32} />;
      if (type === 'code') return <Code size={32} />;
      if (type === 'audio') return <Music size={32} />;
      if (type === 'video') return <Video size={32} />;
      return <Box size={32} />;
    };

    // Clean up displayed filename (remove UUID prefix if present)
    const cleanFilename = (filename) => {
      if (!filename) return 'Untitled';
      // Pattern: UUID_originalname
      const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_/;
      return filename.replace(uuidPattern, '');
    };

    return (
      <div className="knowledge-grid">
        {showUpload && (
          <label className="knowledge-card upload-card" style={{ cursor: 'pointer' }}>
            <input type="file" style={{ display: 'none' }} onChange={handleFileChange} />
            <div style={{ color: 'var(--f-earth)', marginBottom: 8 }}><UploadCloud size={32} /></div>
            <h4 style={{ color: 'var(--f-deep)', margin: '0 0 4px 0' }}>Upload File</h4>
            <p style={{ color: 'var(--f-soil)', fontSize: 12, margin: 0 }}>to {activeCat}</p>
          </label>
        )}

        {filteredFiles.map((f, i) => (
          <div key={f.id || i} className="knowledge-card" onClick={() => setSelectedDoc(f)}>
            <div className="card-thumbnail">
              {getIcon(f.type)}
            </div>
            <div className="knowledge-info">
              <h4>{cleanFilename(f.filename || f.name)}</h4>
              <p>{formatBytes(f.size_bytes)} · {formatDate(f.created_at)}</p>
              {f.summary && f.summary !== 'No content to read.' && (
                <p style={{fontSize: 11, color: 'var(--f-stone)', marginTop: 4}}>{f.summary.slice(0, 60)}</p>
              )}
              <div className="k-tags">
                <span className="k-tag">{f.type}</span>
                <button className="icon-btn" style={{marginLeft: 'auto', padding: 2}} onClick={(e) => handleFavorite(f.id, e)}>
                  <Star size={12} color={f.favorite ? '#ffaa00' : 'var(--f-stone)'} fill={f.favorite ? '#ffaa00' : 'none'} />
                </button>
                <button className="icon-btn" style={{padding: 2}} onClick={(e) => handleDelete(f.id, e)}>
                  <Trash2 size={12} color="var(--f-stone)" />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {!isLoading && filteredFiles.length === 0 && (
          <div style={{color: 'var(--f-stone)', marginTop: 20, gridColumn: '1 / -1'}}>No files in this category yet. Upload one above.</div>
        )}
      </div>
    );
  };

  return (
    <div className="library-container">
      <LibrarySidebar activeCat={activeCat} setActiveCat={setActiveCat} />
      <div className="library-main-layout">
        <LibraryTopBar onUploadComplete={fetchFiles} onSearch={handleSearch} />
        <div className="library-scroll-area">
          {renderContent()}
        </div>
      </div>

      {selectedDoc && (
        <DocumentSplitView document={selectedDoc} onClose={() => setSelectedDoc(null)} />
      )}
    </div>
  );
};

export default Library;
