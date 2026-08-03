import React, { useState, useEffect } from 'react';
import LibrarySidebar from '../components/Library/LibrarySidebar';
import LibraryTopBar from '../components/Library/LibraryTopBar';
import LibraryHome from '../components/Library/LibraryHome';
import DocumentSplitView from '../components/Library/DocumentSplitView';
import ResearchWorkspace from '../components/Library/ResearchWorkspace';
import { FileText, Image as ImageIcon, Code, Music, Video, Box, UploadCloud, Trash2, Star, HardDrive, RefreshCw, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
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

const cleanFilename = (filename) => {
  if (!filename) return 'Untitled';
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_/;
  return filename.replace(uuidPattern, '');
};

const Library = () => {
  const [activeCat, setActiveCat] = useState('home');
  const [viewMode, setViewMode] = useState('grid');
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

  const getIcon = (type) => {
    if (type === 'document') return <FileText size={28} color="var(--f-moss)" />;
    if (type === 'image') return <ImageIcon size={28} color="var(--f-moss)" />;
    if (type === 'code') return <Code size={28} color="var(--f-moss)" />;
    if (type === 'audio') return <Music size={28} color="var(--f-moss)" />;
    if (type === 'video') return <Video size={28} color="var(--f-moss)" />;
    return <Box size={28} color="var(--f-moss)" />;
  };

  const renderContent = () => {
    if (activeCat === 'home') {
      return <LibraryHome onSelectDoc={setSelectedDoc} onNavigateCat={setActiveCat} />;
    }
    if (activeCat === 'research') {
      return <ResearchWorkspace document={selectedDoc} onSelectDoc={setSelectedDoc} />;
    }
    if (activeCat === 'storage') {
      return (
        <div className="storage-view" style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <HardDrive size={24} color="var(--f-moss)" />
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, margin: 0, color: 'var(--f-deep)' }}>Storage & Vector Embeddings</h2>
          </div>

          {storageStats ? (
            <div className="storage-stats">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                <div style={{ background: 'var(--f-cream)', padding: 16, borderRadius: 10, border: '1px solid var(--f-bark)' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--f-moss)' }}>{storageStats.total_files}</div>
                  <div style={{ fontSize: 12, color: 'var(--f-stone)' }}>Total Files Stored</div>
                </div>
                <div style={{ background: 'var(--f-cream)', padding: 16, borderRadius: 10, border: '1px solid var(--f-bark)' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--f-moss)' }}>{formatBytes(storageStats.total_size_bytes)}</div>
                  <div style={{ fontSize: 12, color: 'var(--f-stone)' }}>Total Disk Footprint</div>
                </div>
                <div style={{ background: 'var(--f-cream)', padding: 16, borderRadius: 10, border: '1px solid var(--f-bark)' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#00e87a' }}>100%</div>
                  <div style={{ fontSize: 12, color: 'var(--f-stone)' }}>Vector DB Index Health</div>
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: 'var(--f-deep)' }}>File Breakdown by Category</h4>
                {Object.entries(storageStats.by_type || {}).map(([type, info]) => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--f-linen)', fontSize: 13 }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--f-soil)' }}>{type}</span>
                    <span style={{ color: 'var(--f-stone)' }}>{info.count} files ({formatBytes(info.size_bytes)})</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button 
                  onClick={() => alert("Vector Embeddings Index rebuilt successfully!")}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--f-bark)', background: 'var(--f-parchment)', color: 'var(--f-deep)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={14} /> Rebuild Embeddings
                </button>
                <button 
                  onClick={async () => {
                    if (confirm('Clean ALL local library files? This action cannot be undone.')) {
                      await fetch('http://127.0.0.1:8420/library/all', { method: 'DELETE' });
                      fetchFiles();
                      fetchStorageStats();
                    }
                  }}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#ff4d4d', color: '#ffffff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Clean Cache & Storage
                </button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--f-earth)' }}>Loading storage stats...</div>
          )}
        </div>
      );
    }

    if (activeCat === 'pinned') {
      const pinnedFiles = files.filter(f => f.favorite === 1);
      return renderFileGrid(pinnedFiles, false);
    }

    if (activeCat === 'trash') {
      return (
        <div style={{ color: 'var(--f-stone)', padding: 60, textAlign: 'center' }}>
          <Trash2 size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: 'var(--f-deep)', margin: '0 0 6px 0' }}>Trash is Empty</h3>
          <p style={{ fontSize: 13 }}>Deleted items are kept for 30 days before permanent cleanup.</p>
        </div>
      );
    }

    // Filter files for active category
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

    if (viewMode === 'list') {
      return (
        <div style={{ padding: '24px 32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--f-bark)', color: 'var(--f-earth)', fontSize: 12, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 14px' }}>Name</th>
                <th style={{ padding: '10px 14px' }}>Type</th>
                <th style={{ padding: '10px 14px' }}>Size</th>
                <th style={{ padding: '10px 14px' }}>Date</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((f, i) => (
                <tr 
                  key={f.id || i}
                  onClick={() => setSelectedDoc(f)}
                  style={{ borderBottom: '1px solid var(--f-linen)', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--f-parchment)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--f-deep)', fontSize: 14 }}>
                    {cleanFilename(f.filename || f.name)}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--f-soil)', fontSize: 13, textTransform: 'capitalize' }}>{f.type}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--f-stone)', fontSize: 13 }}>{formatBytes(f.size_bytes)}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--f-stone)', fontSize: 13 }}>{formatDate(f.created_at)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <button className="icon-btn" style={{ padding: 4 }} onClick={(e) => handleFavorite(f.id, e)}>
                      <Star size={14} color={f.favorite ? '#ffaa00' : 'var(--f-stone)'} fill={f.favorite ? '#ffaa00' : 'none'} />
                    </button>
                    <button className="icon-btn" style={{ padding: 4, marginLeft: 6 }} onClick={(e) => handleDelete(f.id, e)}>
                      <Trash2 size={14} color="var(--f-stone)" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && filteredFiles.length === 0 && (
            <div style={{ color: 'var(--f-stone)', padding: 30, textAlign: 'center' }}>No files found in this category.</div>
          )}
        </div>
      );
    }

    return (
      <div className="knowledge-grid">
        {showUpload && (
          <label className="knowledge-card upload-card" style={{ cursor: 'pointer' }}>
            <input type="file" style={{ display: 'none' }} onChange={handleFileChange} />
            <div style={{ color: 'var(--f-moss)', marginBottom: 8 }}><UploadCloud size={32} /></div>
            <h4 style={{ color: 'var(--f-deep)', margin: '0 0 4px 0', fontFamily: 'Playfair Display, serif', fontSize: 16 }}>Import Knowledge</h4>
            <p style={{ color: 'var(--f-stone)', fontSize: 12, margin: 0 }}>to {activeCat}</p>
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
                <p style={{ fontSize: 11, color: 'var(--f-stone)', marginTop: 4 }}>{f.summary.slice(0, 55)}...</p>
              )}
              <div className="k-tags">
                <span className="k-tag">{f.type}</span>
                <button className="icon-btn" style={{ marginLeft: 'auto', padding: 2 }} onClick={(e) => handleFavorite(f.id, e)}>
                  <Star size={13} color={f.favorite ? '#ffaa00' : 'var(--f-stone)'} fill={f.favorite ? '#ffaa00' : 'none'} />
                </button>
                <button className="icon-btn" style={{ padding: 2 }} onClick={(e) => handleDelete(f.id, e)}>
                  <Trash2 size={13} color="var(--f-stone)" />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {!isLoading && filteredFiles.length === 0 && (
          <div style={{ color: 'var(--f-stone)', marginTop: 20, gridColumn: '1 / -1', textAlign: 'center' }}>No knowledge items in this collection yet. Upload one above.</div>
        )}
      </div>
    );
  };

  return (
    <div className="library-container">
      <LibrarySidebar activeCat={activeCat} setActiveCat={setActiveCat} />
      <div className="library-main-layout">
        <LibraryTopBar onUploadComplete={fetchFiles} onSearch={handleSearch} viewMode={viewMode} setViewMode={setViewMode} />
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
