import React, { useState, useEffect } from 'react';
import { FileText, Image as ImageIcon, Briefcase, Zap, Search, Clock, File, UploadCloud } from 'lucide-react';
import '../../views/Library.css';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const cleanFilename = (filename) => {
  if (!filename) return 'Untitled';
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_/;
  return filename.replace(uuidPattern, '');
};

const LibraryHome = ({ onSelectDoc }) => {
  const [recentFiles, setRecentFiles] = useState([]);
  const [stats, setStats] = useState({ total_files: 0, total_size_bytes: 0, by_type: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    
    Promise.all([
      fetch('http://127.0.0.1:8420/library/files?type=all')
        .then(res => res.json())
        .then(data => setRecentFiles((data.files || []).slice(0, 6)))
        .catch(err => console.error("Failed to fetch recent files", err)),

      fetch('http://127.0.0.1:8420/library/stats')
        .then(res => res.json())
        .then(data => setStats(data || { total_files: 0, total_size_bytes: 0, by_type: {} }))
        .catch(err => console.error("Failed to fetch library stats", err))
    ]).finally(() => setIsLoading(false));
  }, []);

  const getIcon = (type) => {
    if (type === 'image') return <ImageIcon size={20} />;
    if (type === 'document') return <FileText size={20} />;
    return <File size={20} />;
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://127.0.0.1:8420/library/add', true);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const percentComplete = Math.round((evt.loaded / evt.total) * 100);
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(null), 1500);
        
        try {
          const freshRes = await fetch('http://127.0.0.1:8420/library/files?type=all');
          const freshData = await freshRes.json();
          setRecentFiles((freshData.files || []).slice(0, 6));
          
          const statsRes = await fetch('http://127.0.0.1:8420/library/stats');
          const statsData = await statsRes.json();
          setStats(statsData);
        } catch (err) {
          console.error("Refresh failed", err);
        }
      } else {
        setUploadProgress(null);
      }
    };

    xhr.onerror = () => setUploadProgress(null);
    xhr.send(formData);
  };

  return (
    <div className="library-home">
      <div className="home-section">
        <h3>Collections</h3>
        <div className="collections-grid">
          <div className="collection-card">
            <div className="col-icon" style={{background: 'var(--f-moss)', color: 'white'}}><Briefcase size={24} /></div>
            <h4>All Files</h4>
            <p>{stats.total_files} items · {formatBytes(stats.total_size_bytes)}</p>
          </div>
          <div className="collection-card">
            <div className="col-icon" style={{background: 'var(--f-stone)', color: 'white'}}><FileText size={24} /></div>
            <h4>Documents</h4>
            <p>{stats?.by_type?.document?.count || 0} files</p>
          </div>
          <div className="collection-card">
            <div className="col-icon" style={{background: 'var(--f-soil)', color: 'white'}}><ImageIcon size={24} /></div>
            <h4>Media</h4>
            <p>{(stats?.by_type?.image?.count || 0) + (stats?.by_type?.video?.count || 0) + (stats?.by_type?.audio?.count || 0)} files</p>
          </div>
        </div>
      </div>

      <div className="home-section">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h3>Recent Files</h3>
          <label className="primary-btn" style={{fontSize: 12, padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6}}>
            <UploadCloud size={14} /> Upload
            <input type="file" style={{display: 'none'}} onChange={handleUpload} />
          </label>
        </div>
        <div className="continue-grid">
          {isLoading ? (
            <p style={{color: 'var(--f-earth)'}}>Loading...</p>
          ) : recentFiles.length === 0 ? (
            <p style={{color: 'var(--f-earth)'}}>No files yet. Upload your first file above.</p>
          ) : (
            recentFiles.map(f => (
              <div 
                key={f.id} 
                className="continue-card" 
                onClick={() => onSelectDoc && onSelectDoc(f)}
                style={{cursor: 'pointer'}}
              >
                <div className="continue-icon">{getIcon(f.type)}</div>
                <div className="continue-info">
                  <h4 style={{wordBreak: 'break-all'}}>{cleanFilename(f.filename)}</h4>
                  <p>{formatBytes(f.size_bytes)} · {f.type}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {uploadProgress !== null && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'var(--f-deep)',
          color: 'var(--f-cream)',
          padding: '16px 24px',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: 300
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600}}>
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div style={{height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden'}}>
            <div style={{height: '100%', width: `${uploadProgress}%`, background: 'var(--f-moss)', transition: 'width 0.1s'}} />
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryHome;
