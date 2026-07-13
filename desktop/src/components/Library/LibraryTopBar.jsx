import React, { useRef, useState } from 'react';
import { Search, Filter, SortDesc, Grid, UploadCloud, Settings2, Activity } from 'lucide-react';
import '../../views/Library.css';

const LibraryTopBar = ({ onUploadComplete, onSearch }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
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

    xhr.onload = () => {
      if (xhr.status === 200) {
        setUploadProgress(100);
        setTimeout(() => {
          setUploadProgress(null);
          setIsUploading(false);
          if (onUploadComplete) onUploadComplete();
        }, 1500);
      } else {
        setUploadProgress(null);
        setIsUploading(false);
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setIsUploading(false);
    };

    xhr.send(formData);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchText);
    }
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    // Clear search when input is emptied
    if (e.target.value === '' && onSearch) {
      onSearch('');
    }
  };

  return (
    <div className="library-topbar">
      <div className="topbar-search">
        <Search size={16} color="var(--f-soil)" />
        <input 
          type="text" 
          placeholder="Search everything... (Press Enter)" 
          value={searchText}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
        />
      </div>

      <div className="topbar-actions">
        <label className="topbar-btn" style={{ cursor: 'pointer' }}>
          <UploadCloud size={14} /> Import
          <input type="file" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
        </label>
        <div className="topbar-divider" />
        
        {/* Status Indicator */}
        <div className="topbar-status">
          <Activity size={14} color={isUploading ? 'var(--f-alive)' : 'var(--f-moss)'} />
          <span>{isUploading ? 'Uploading...' : 'Ready'}</span>
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

export default LibraryTopBar;
