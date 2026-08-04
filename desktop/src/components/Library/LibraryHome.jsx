import React, { useState, useEffect } from 'react';
import { FileText, Image as ImageIcon, Briefcase, Zap, Search, Clock, File, UploadCloud, BookOpen, Code, Music, Video, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';
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

const LibraryHome = ({ onSelectDoc, onNavigateCat }) => {
  const [recentFiles, setRecentFiles] = useState([]);
  const [stats, setStats] = useState({ total_files: 0, total_size_bytes: 0, by_type: {} });
  const [isLoading, setIsLoading] = useState(true);

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
    if (type === 'image') return <ImageIcon size={20} color="var(--f-moss, #2e6b45)" />;
    if (type === 'document') return <FileText size={20} color="var(--f-moss, #2e6b45)" />;
    if (type === 'code') return <Code size={20} color="var(--f-moss, #2e6b45)" />;
    if (type === 'audio') return <Music size={20} color="var(--f-moss, #2e6b45)" />;
    if (type === 'video') return <Video size={20} color="var(--f-moss, #2e6b45)" />;
    return <File size={20} color="var(--f-moss, #2e6b45)" />;
  };

  return (
    <div className="library-home" style={{ padding: '24px 32px' }}>

      {/* Hero Welcome Banner */}
      <div className="home-section" style={{
        background: 'linear-gradient(135deg, rgba(46, 107, 69, 0.08) 0%, rgba(20, 22, 34, 0.04) 100%)',
        border: '1px solid var(--f-bark, #e6e0d6)', borderRadius: 16, padding: 24, marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, margin: '0 0 6px 0', color: 'var(--f-deep, #141424)' }}>
            Living Knowledge Network
          </h2>
          <p style={{ margin: 0, color: 'var(--f-soil, #5a544c)', fontSize: 13, maxWidth: 540, lineHeight: 1.5 }}>
            Myca indexes, embeds, and structures all your files locally. Search, summarize, and automate knowledge without ever uploading data to the cloud.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff', border: '1px solid var(--f-bark, #e6e0d6)', padding: '10px 18px', borderRadius: 12 }}>
          <ShieldCheck size={20} color="var(--f-moss, #2e6b45)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--f-deep, #141424)' }}>100% Local Privacy</div>
            <div style={{ fontSize: 11, color: 'var(--f-stone, #7a7670)' }}>Zero Cloud Dependency</div>
          </div>
        </div>
      </div>

      {/* Top Section: Continue Working */}
      <div className="home-section" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Clock size={18} color="var(--f-moss, #2e6b45)" />
          <h3 style={{ margin: 0, fontFamily: 'Playfair Display, serif', fontSize: 18, color: 'var(--f-deep, #141424)' }}>Continue Working</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {recentFiles.map((f, idx) => (
            <div
              key={f.id || idx}
              onClick={() => onSelectDoc && onSelectDoc(f)}
              style={{
                background: '#ffffff', border: '1px solid var(--f-bark, #e6e0d6)', borderRadius: 12, padding: 16,
                cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--f-moss, #2e6b45)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--f-bark, #e6e0d6)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {getIcon(f.type)}
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--f-deep, #141424)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cleanFilename(f.filename || f.name)}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--f-stone, #7a7670)' }}>
                {formatBytes(f.size_bytes)} · Embedded & Indexed
              </p>
            </div>
          ))}
          {recentFiles.length === 0 && !isLoading && (
            <div style={{ color: 'var(--f-stone, #7a7670)', fontSize: 13, gridColumn: '1 / -1' }}>No recent files opened yet. Import files using the top bar.</div>
          )}
        </div>
      </div>

      {/* Middle Section: Collections */}
      <div className="home-section" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Briefcase size={18} color="var(--f-moss, #2e6b45)" />
          <h3 style={{ margin: 0, fontFamily: 'Playfair Display, serif', fontSize: 18, color: 'var(--f-deep, #141424)' }}>Knowledge Collections</h3>
        </div>

        <div className="collections-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          <div className="collection-card" onClick={() => onNavigateCat && onNavigateCat('documents')} style={{ cursor: 'pointer', background: '#ffffff', border: '1px solid var(--f-bark, #e6e0d6)', borderRadius: 12, padding: 18 }}>
            <div className="col-icon" style={{ background: 'rgba(46, 107, 69, 0.1)', color: 'var(--f-moss, #2e6b45)', borderRadius: 10, padding: 10, width: 'fit-content', marginBottom: 10 }}>
              <FileText size={22} />
            </div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--f-deep, #141424)' }}>Documents</h4>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--f-stone, #7a7670)' }}>{stats.by_type?.document?.count || 0} PDF, DOCX, CSV files</p>
          </div>

          <div className="collection-card" onClick={() => onNavigateCat && onNavigateCat('research')} style={{ cursor: 'pointer', background: '#ffffff', border: '1px solid var(--f-bark, #e6e0d6)', borderRadius: 12, padding: 18 }}>
            <div className="col-icon" style={{ background: 'rgba(46, 107, 69, 0.1)', color: 'var(--f-moss, #2e6b45)', borderRadius: 10, padding: 10, width: 'fit-content', marginBottom: 10 }}>
              <BookOpen size={22} />
            </div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--f-deep, #141424)' }}>Research</h4>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--f-stone, #7a7670)' }}>Literature reviews & papers</p>
          </div>

          <div className="collection-card" onClick={() => onNavigateCat && onNavigateCat('images')} style={{ cursor: 'pointer', background: '#ffffff', border: '1px solid var(--f-bark, #e6e0d6)', borderRadius: 12, padding: 18 }}>
            <div className="col-icon" style={{ background: 'rgba(46, 107, 69, 0.1)', color: 'var(--f-moss, #2e6b45)', borderRadius: 10, padding: 10, width: 'fit-content', marginBottom: 10 }}>
              <ImageIcon size={22} />
            </div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--f-deep, #141424)' }}>Images</h4>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--f-stone, #7a7670)' }}>{stats.by_type?.image?.count || 0} Photos & Diagrams</p>
          </div>

          <div className="collection-card" onClick={() => onNavigateCat && onNavigateCat('code')} style={{ cursor: 'pointer', background: '#ffffff', border: '1px solid var(--f-bark, #e6e0d6)', borderRadius: 12, padding: 18 }}>
            <div className="col-icon" style={{ background: 'rgba(46, 107, 69, 0.1)', color: 'var(--f-moss, #2e6b45)', borderRadius: 10, padding: 10, width: 'fit-content', marginBottom: 10 }}>
              <Code size={22} />
            </div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--f-deep, #141424)' }}>Code Repositories</h4>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--f-stone, #7a7670)' }}>{stats.by_type?.code?.count || 0} Code files & Repos</p>
          </div>
        </div>
      </div>

      {/* Bottom Section: Insights & Intelligence */}
      <div className="home-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Sparkles size={18} color="var(--f-moss, #2e6b45)" />
          <h3 style={{ margin: 0, fontFamily: 'Playfair Display, serif', fontSize: 18, color: 'var(--f-deep, #141424)' }}>Knowledge Insights & Stats</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          <div style={{ background: '#ffffff', border: '1px solid var(--f-bark, #e6e0d6)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--f-moss, #2e6b45)', marginBottom: 2 }}>{stats.total_files}</div>
            <div style={{ fontSize: 12, color: 'var(--f-stone, #7a7670)' }}>Total Files Indexed</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid var(--f-bark, #e6e0d6)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--f-moss, #2e6b45)', marginBottom: 2 }}>{formatBytes(stats.total_size_bytes)}</div>
            <div style={{ fontSize: 12, color: 'var(--f-stone, #7a7670)' }}>Total Local Knowledge Base</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid var(--f-bark, #e6e0d6)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#00e87a', marginBottom: 2 }}>100%</div>
            <div style={{ fontSize: 12, color: 'var(--f-stone, #7a7670)' }}>Embeddings Vector Coverage</div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default LibraryHome;
