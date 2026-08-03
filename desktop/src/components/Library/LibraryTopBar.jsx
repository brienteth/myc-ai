import React, { useRef, useState } from 'react';
import { Search, Filter, SortDesc, Grid, List, UploadCloud, Activity, FolderPlus, Clipboard, Camera, Cpu, HardDrive } from 'lucide-react';
import '../../views/Library.css';

const LibraryTopBar = ({ onUploadComplete, onSearch, viewMode, setViewMode }) => {
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showImportMenu, setShowImportMenu] = useState(false);

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('file', files[i]);
    }

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
        }, 1200);
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
    
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
    setShowImportMenu(false);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchText);
    }
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    if (e.target.value === '' && onSearch) {
      onSearch('');
    }
  };

  const handleClipboardScan = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { alert("Clipboard is empty."); return; }
      
      const res = await fetch('http://127.0.0.1:8420/library/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: text })
      });
      if (res.ok && onUploadComplete) {
        alert("Clipboard content imported to Knowledge OS!");
        onUploadComplete();
      }
    } catch (err) {
      alert(`Clipboard import: ${err.message}`);
    }
    setShowImportMenu(false);
  };

  return (
    <div className="library-topbar" style={{ position: 'relative' }}>
      {/* Hidden File & Folder Inputs */}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} multiple />
      <input type="file" ref={folderInputRef} style={{ display: 'none' }} onChange={handleFileChange} webkitdirectory="true" directory="true" />

      <div className="topbar-search">
        <Search size={16} color="var(--f-soil, #5a544c)" />
        <input 
          type="text" 
          placeholder="Search everything... (Natural language, OCR, embeddings, code)" 
          value={searchText}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
        />
      </div>

      <div className="topbar-actions">
        {/* Status Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 8, fontSize: 12, color: 'var(--f-soil, #5a544c)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Cpu size={13} color="var(--f-moss, #2e6b45)" /> Indexing: Ready
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Activity size={13} color="#00e87a" /> Embeddings: Active
          </span>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', background: 'var(--f-cream, #fcfaf7)', border: '1px solid var(--f-bark, #e6e0d6)', borderRadius: 6, padding: 2 }}>
          <button 
            onClick={() => setViewMode && setViewMode('grid')}
            style={{
              padding: '4px 8px', border: 'none', background: viewMode === 'grid' ? 'var(--f-moss, #2e6b45)' : 'transparent',
              color: viewMode === 'grid' ? '#fff' : 'var(--f-soil, #5a544c)', borderRadius: 4, cursor: 'pointer', display: 'flex'
            }}
          >
            <Grid size={14} />
          </button>
          <button 
            onClick={() => setViewMode && setViewMode('list')}
            style={{
              padding: '4px 8px', border: 'none', background: viewMode === 'list' ? 'var(--f-moss, #2e6b45)' : 'transparent',
              color: viewMode === 'list' ? '#fff' : 'var(--f-soil, #5a544c)', borderRadius: 4, cursor: 'pointer', display: 'flex'
            }}
          >
            <List size={14} />
          </button>
        </div>

        {/* Multi-Channel Import Button */}
        <div style={{ position: 'relative' }}>
          <button 
            className="topbar-btn primary-btn" 
            onClick={() => setShowImportMenu(!showImportMenu)}
            style={{ background: 'var(--f-moss, #2e6b45)', color: '#fff', padding: '7px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <UploadCloud size={15} /> Import Knowledge
          </button>

          {showImportMenu && (
            <div style={{
              position: 'absolute', top: 40, right: 0, width: 200, background: '#ffffff',
              border: '1px solid var(--f-bark, #e6e0d6)', borderRadius: 10, padding: 6,
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 4
            }}>
              <button 
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: '8px 12px', border: 'none', background: 'transparent', color: 'var(--f-deep, #141424)', textAlign: 'left', cursor: 'pointer', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => e.currentTarget.style.background = '#f4f0e8'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <UploadCloud size={14} color="var(--f-moss, #2e6b45)" /> Import Files
              </button>
              <button 
                onClick={() => folderInputRef.current?.click()}
                style={{ padding: '8px 12px', border: 'none', background: 'transparent', color: 'var(--f-deep, #141424)', textAlign: 'left', cursor: 'pointer', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => e.currentTarget.style.background = '#f4f0e8'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <FolderPlus size={14} color="var(--f-moss, #2e6b45)" /> Import Folder
              </button>
              <button 
                onClick={handleClipboardScan}
                style={{ padding: '8px 12px', border: 'none', background: 'transparent', color: 'var(--f-deep, #141424)', textAlign: 'left', cursor: 'pointer', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => e.currentTarget.style.background = '#f4f0e8'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Clipboard size={14} color="var(--f-moss, #2e6b45)" /> Clipboard Scan
              </button>
            </div>
          )}
        </div>
      </div>

      {uploadProgress !== null && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: 'var(--f-deep, #141424)',
          color: '#ffffff', padding: '14px 22px', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 99999, display: 'flex', alignItems: 'center', gap: 12
        }}>
          <Activity size={18} color="#00e87a" className="spin-icon" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Indexing & Embedding Knowledge...</div>
            <div style={{ fontSize: 11, color: '#a0a0b2' }}>{uploadProgress}% completed</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryTopBar;
