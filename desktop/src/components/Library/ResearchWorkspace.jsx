import React, { useState, useEffect } from 'react';
import { BookOpen, Bookmark, Link2, Highlighter, Share2, Bot, FileText, ArrowLeft, Image as ImageIcon, FileCode, FileAudio, FileVideo, File } from 'lucide-react';
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

const ResearchWorkspace = ({ document, onSelectDoc }) => {
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [docContent, setDocContent] = useState(null);
  const [allFiles, setAllFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Fetch all files if no document is selected
  useEffect(() => {
    if (!document) {
      setLoadingFiles(true);
      fetch('http://127.0.0.1:8420/library/files?type=all')
        .then(res => res.json())
        .then(data => {
          setAllFiles(data.files || []);
          setLoadingFiles(false);
        })
        .catch(err => {
          console.error("Failed to fetch library files:", err);
          setLoadingFiles(false);
        });
    }
  }, [document]);

  // Fetch analysis and document content when a document is selected
  useEffect(() => {
    if (document) {
      setIsLoading(true);
      setDocContent(null);
      setAnalysis(null);

      // Fetch document content
      fetch(`http://127.0.0.1:8420/library/files/${document.id}`)
        .then(res => res.json())
        .then(data => {
          setDocContent(data);
        })
        .catch(err => console.error("Failed to load document content:", err));

      // Fetch AI summary / analysis
      const prompt = `Please provide a summary abstract and 2 key highlights for this document: ${document.name || document.filename}`;
      fetch('http://127.0.0.1:8420/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: false })
      })
      .then(res => res.json())
      .then(data => {
        setAnalysis(data.response || data.error);
        setIsLoading(false);
      })
      .catch(err => {
        setAnalysis("Failed to connect to local AI model.");
        setIsLoading(false);
      });
    }
  }, [document]);

  const getIcon = (type) => {
    if (type === 'document') return <FileText size={28} color="var(--f-soil)" />;
    if (type === 'image') return <ImageIcon size={28} color="var(--f-moss)" />;
    if (type === 'code') return <FileCode size={28} color="var(--f-alive)" />;
    if (type === 'audio') return <FileAudio size={28} color="var(--f-stone)" />;
    if (type === 'video') return <FileVideo size={28} color="var(--f-stone)" />;
    return <File size={28} color="var(--f-stone)" />;
  };

  if (!document) {
    return (
      <div className="research-workspace" style={{ padding: 40, overflowY: 'auto' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <BookOpen size={48} style={{ color: 'var(--f-moss)', opacity: 0.8, marginBottom: 16 }} />
            <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--f-deep)', fontSize: 28 }}>Research Workspace</h2>
            <p style={{ color: 'var(--f-earth)', marginTop: 8 }}>Select a document from your library to start AI-powered deep research.</p>
          </div>

          {loadingFiles ? (
            <div style={{ textAlign: 'center', color: 'var(--f-earth)' }}>Loading files...</div>
          ) : allFiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, border: '1px dashed var(--border-color)', borderRadius: 12 }}>
              <p style={{ color: 'var(--f-stone)' }}>No files available in your library. Upload some files first.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
              {allFiles.map(f => (
                <div 
                  key={f.id} 
                  className="continue-card" 
                  onClick={() => onSelectDoc && onSelectDoc(f)}
                  style={{ cursor: 'pointer', padding: 20, border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--f-cream)' }}
                >
                  <div style={{ marginBottom: 12 }}>{getIcon(f.type)}</div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--f-deep)', wordBreak: 'break-all', marginBottom: 4 }}>
                    {cleanFilename(f.filename || f.name)}
                  </h4>
                  <p style={{ fontSize: 11, color: 'var(--f-stone)' }}>{formatBytes(f.size_bytes)} · {f.type}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="research-workspace">
      <div className="research-header">
        <div className="r-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            className="icon-btn" 
            onClick={() => onSelectDoc && onSelectDoc(null)}
            style={{ padding: 4 }}
          >
            <ArrowLeft size={16} />
          </button>
          <BookOpen size={20} color="var(--f-moss)" />
          <h2>{cleanFilename(document.name || document.filename)}</h2>
        </div>
        <div className="r-actions">
          <button className="icon-btn"><Bookmark size={16} /></button>
          <button className="icon-btn"><Share2 size={16} /></button>
        </div>
      </div>

      <div className="research-body">
        <div className="research-reader">
          <div className="r-abstract" style={{ marginBottom: 20, background: 'var(--f-linen)', padding: 16, borderRadius: 8 }}>
            <strong><Bot size={14} style={{ display: 'inline', marginRight: 4 }} /> AI Abstract:</strong> 
            {isLoading ? " Analyzing document..." : ` ${analysis || 'Ready to analyze.'}`}
          </div>
          
          <div className="mock-pdf-pages" style={{ background: 'var(--f-cream)', padding: 24, borderRadius: 12, minHeight: '60vh' }}>
            <div className="mock-page" style={{ height: 'auto', maxHeight: '55vh', overflowY: 'auto' }}>
              {docContent?.content ? (
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--f-deep)' }}>
                  {docContent.content}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--f-stone)', paddingTop: 40 }}>
                  <p>Document Content</p>
                  <p style={{ fontSize: 12, marginTop: 8 }}>Type: {document.type} · Size: {formatBytes(document.size_bytes)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="research-sidebar">
          <h3><Link2 size={14} /> Similar Documents</h3>
          <div className="citation-card">
            <p className="cit-title">Semantic Search</p>
            <p className="cit-author">Currently unavailable</p>
          </div>
          
          <h3 style={{ marginTop: 24 }}><Highlighter size={14} /> Highlights</h3>
          <div className="highlight-card">
            <p>{isLoading ? "Extracting highlights..." : "Review the AI abstract above for key highlights."}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResearchWorkspace;
