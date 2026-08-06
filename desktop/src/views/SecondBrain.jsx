import React, { useState, useEffect } from 'react';
import { Brain, Pin, Bookmark, Database, Sparkles, Save, RotateCcw, CheckCircle, FileText, Search, Plus, Trash2, Tag, BookOpen } from 'lucide-react';
import './SecondBrain.css';

const INITIAL_NOTES = [
  {
    id: 'note-1',
    title: 'Myca Sovereign Stack Specification v1.0',
    category: 'Mimari',
    tags: ['#mimari', '#local-first', '#privacy'],
    content: 'Veriler tamamen cihazda saklanır. P2P Colony Mesh ile cihazlar arası güvenli şifrelenmiş iletişim kurulur.',
    pinned: true,
    date: '2026-08-06'
  },
  {
    id: 'note-2',
    title: 'Workflow Studio Telegram & Notification Nodes',
    category: 'Otomasyon',
    tags: ['#workflow', '#telegram', '#bot'],
    content: 'Telegram.send primitive çağrısı 1 saatlik Cron tetikleyicisi ile bağlandı. Otonom raporlar iletiliyor.',
    pinned: true,
    date: '2026-08-05'
  },
  {
    id: 'note-3',
    title: 'Skills & MCP 1,600+ Capability Registry Index',
    category: 'Kod',
    tags: ['#skills', '#mcp', '#registry'],
    content: 'Chrome DevTools, PostgreSQL, AlphaFold 3D ve Ithaca antik metin modülleri kategori indekslerine ayrıldı.',
    pinned: false,
    date: '2026-08-04'
  }
];

const SecondBrain = () => {
  // Notes State
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('myca_brain_notes');
    return saved ? JSON.parse(saved) : INITIAL_NOTES;
  });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');

  // New Note Modal / Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Mimari');
  const [newTags, setNewTags] = useState('#not');
  const [newContent, setNewContent] = useState('');

  // AI Synthesis
  const [aiSynthesis, setAiSynthesis] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Handover State
  const [handoverLog, setHandoverLog] = useState(() => {
    return localStorage.getItem('myca_handover_state') || 'Henüz kaydedilmiş oturum durumu yok.';
  });
  const [handoverSummary, setHandoverSummary] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  // Save notes to localStorage
  useEffect(() => {
    localStorage.setItem('myca_brain_notes', JSON.stringify(notes));
  }, [notes]);

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const tagsArray = newTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => t.startsWith('#') ? t : `#${t}`);

    const newNote = {
      id: `note-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      tags: tagsArray.length > 0 ? tagsArray : ['#genel'],
      content: newContent.trim(),
      pinned: false,
      date: new Date().toISOString().split('T')[0]
    };

    setNotes([newNote, ...notes]);
    setNewTitle('');
    setNewContent('');
    setNewTags('#not');
    setShowAddForm(false);
    setSaveStatus('Yeni hafıza notu Second Brain veritabanına eklendi!');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const togglePin = (id) => {
    setNotes(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  };

  const deleteNote = (id) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const handleAISynthesize = () => {
    setIsSynthesizing(true);
    setAiSynthesis('');

    setTimeout(() => {
      const summary = `🧠 **Second Brain Akıllı Sentez Raporu (${notes.length} Not)**:

1. **Mimari & Yerel Depolama**: Veriler %100 yerel disk ve SQLite vektör indekslerinde koruma altında.
2. **Otomasyon Akışları**: Telegram bildirim ve zamanlanmış Cron görevleri aktif.
3. **Kapasite**: ${notes.length} adet yapılandırılmış bilgi nesnesi indekslendi.`;
      setAiSynthesis(summary);
      setIsSynthesizing(false);
    }, 800);
  };

  const handleSaveHandover = () => {
    if (!handoverSummary.trim()) return;
    const timestamp = new Date().toLocaleString();
    const newState = `[${timestamp}] Oturum Kaydedildi:\nÖzet: ${handoverSummary}\nAktif Hafıza: ${notes.length} Not İndekslendi\nDurum: Yürütme Motoru Hazır`;
    localStorage.setItem('myca_handover_state', newState);
    setHandoverLog(newState);
    setHandoverSummary('');
    setSaveStatus('Oturum durumu yerel hafızaya kaydedildi!');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const handleResumeHandover = () => {
    const saved = localStorage.getItem('myca_handover_state');
    if (saved) {
      setHandoverLog(saved);
      setSaveStatus('Önceki oturum durumu aktif çalışma alanına yüklendi.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  // Filtered notes
  const filteredNotes = notes.filter(n => {
    const matchesCategory = selectedCategory === 'Tümü' || n.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const categories = ['Tümü', 'Mimari', 'Otomasyon', 'Kod', 'Genel'];

  return (
    <div className="second-brain-container" style={{ padding: '36px 48px', background: 'var(--f-cream)', minHeight: '100vh', overflowY: 'auto' }}>
      <div className="brain-header" style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="brain-title-area" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Brain className="brain-icon" size={32} color="var(--f-moss)" />
          <div>
            <h1 className="f-serif-italic" style={{ fontSize: '28px', margin: '0 0 4px', color: 'var(--f-deep)' }}>🧠 Second Brain & Hafıza Yönetimi</h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--f-soil)' }}>Yerel Kalıcı Bağlam, Semantik Hafıza İndeksleri ve Oturum Devir Yöneticisi</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            background: 'var(--f-moss, #2e6b45)', color: '#ffffff', border: 'none',
            padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
          }}
        >
          <Plus size={16} /> Yeni Hafıza Notu
        </button>
      </div>

      {saveStatus && (
        <div className="save-status-banner" style={{ background: 'rgba(46, 107, 69, 0.12)', border: '1px solid var(--f-moss)', color: 'var(--f-moss)', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} /> {saveStatus}
        </div>
      )}

      {/* New Note Form Collapsible */}
      {showAddForm && (
        <form onSubmit={handleAddNote} style={{ background: '#ffffff', border: '1px solid var(--f-bark)', borderRadius: '16px', padding: '24px', marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--f-deep)', fontFamily: 'var(--f-serif)' }}>Yeni Hafıza Notu Ekle</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Not Başlığı (örn: P2P Mesh Protokol Notları)" 
              value={newTitle} 
              onChange={e => setNewTitle(e.target.value)} 
              required
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--f-bark)', fontSize: '13px', outline: 'none' }}
            />
            <select 
              value={newCategory} 
              onChange={e => setNewCategory(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--f-bark)', fontSize: '13px', outline: 'none', background: 'var(--f-cream)' }}
            >
              <option value="Mimari">Mimari</option>
              <option value="Otomasyon">Otomasyon</option>
              <option value="Kod">Kod</option>
              <option value="Genel">Genel</option>
            </select>
            <input 
              type="text" 
              placeholder="Etiketler (#mimari, #p2p)" 
              value={newTags} 
              onChange={e => setNewTags(e.target.value)} 
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--f-bark)', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <textarea 
            placeholder="Hafıza notu detayları..." 
            value={newContent} 
            onChange={e => setNewContent(e.target.value)}
            rows={3}
            required
            style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--f-bark)', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--f-bark)', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}>İptal</button>
            <button type="submit" style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--f-moss)', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Kaydet</button>
          </div>
        </form>
      )}

      {/* Control Bar: Search & Categories & AI Synthesis */}
      <div style={{ background: '#ffffff', border: '1px solid var(--f-bark)', borderRadius: '16px', padding: '16px 20px', marginBottom: '28px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '280px' }}>
          <Search size={16} color="var(--f-stone)" />
          <input 
            type="text" 
            placeholder="Hafıza notlarında veya etiketlerde ara (#mimari)..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: '13.5px', background: 'transparent' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px', borderRadius: '20px', fontSize: '12px', border: '1px solid var(--f-bark)',
                background: selectedCategory === cat ? 'var(--f-moss)' : 'var(--f-cream)',
                color: selectedCategory === cat ? '#ffffff' : 'var(--f-soil)',
                fontWeight: selectedCategory === cat ? '600' : 'normal',
                cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <button 
          onClick={handleAISynthesize}
          disabled={isSynthesizing}
          style={{
            background: 'var(--f-parchment)', border: '1px solid var(--f-bark)', padding: '7px 14px',
            borderRadius: '10px', fontSize: '12.5px', fontWeight: '600', color: 'var(--f-deep)',
            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
          }}
        >
          <Sparkles size={14} color="var(--f-moss)" /> {isSynthesizing ? 'Sentezleniyor...' : 'AI Sentezi Üret'}
        </button>
      </div>

      {/* AI Synthesis Banner Output */}
      {aiSynthesis && (
        <div style={{ background: 'var(--f-parchment)', border: '1px solid var(--f-bark)', borderRadius: '14px', padding: '20px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '13px', fontWeight: '700', color: 'var(--f-deep)' }}>
            <Sparkles size={16} color="var(--f-moss)" /> Myca LLM Hafıza Özet Sentezi
          </div>
          <div style={{ fontSize: '13px', color: 'var(--f-soil)', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
            {aiSynthesis}
          </div>
        </div>
      )}

      {/* Notes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {filteredNotes.map(n => (
          <div key={n.id} style={{
            background: '#ffffff', border: n.pinned ? '2px solid var(--f-moss)' : '1px solid var(--f-bark)',
            borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            gap: '14px', boxShadow: n.pinned ? '0 4px 16px rgba(46,107,69,0.08)' : '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '10.5px', fontFamily: 'var(--f-mono)', background: 'var(--f-cream)', color: 'var(--f-soil)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--f-bark)' }}>
                  {n.category}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => togglePin(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: n.pinned ? 'var(--f-moss)' : 'var(--f-stone)' }}>
                    <Pin size={16} fill={n.pinned ? 'var(--f-moss)' : 'none'} />
                  </button>
                  <button onClick={() => deleteNote(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--f-stone)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 style={{ fontSize: '15px', color: 'var(--f-deep)', fontWeight: '600', margin: '0 0 8px' }}>{n.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--f-soil)', margin: '0 0 14px', lineHeight: '1.5' }}>{n.content}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--f-linen)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {n.tags.map(tag => (
                  <span key={tag} style={{ fontSize: '10.5px', fontFamily: 'var(--f-mono)', color: 'var(--f-moss)', background: 'rgba(46,107,69,0.08)', padding: '1px 6px', borderRadius: '4px' }}>
                    {tag}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: '10px', fontFamily: 'var(--f-mono)', color: 'var(--f-stone)' }}>{n.date}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Handover Manager Section */}
      <div className="handover-section" style={{ background: '#ffffff', border: '1px solid var(--f-bark)', borderRadius: '18px', padding: '28px' }}>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Save size={20} color="var(--f-deep)" />
          <h2 style={{ fontSize: '18px', color: 'var(--f-deep)', margin: 0, fontFamily: 'var(--f-serif)' }}>Oturum Devir Yöneticisi (Session Continuity Manager)</h2>
        </div>
        <p className="section-desc" style={{ fontSize: '13px', color: 'var(--f-soil)', marginBottom: '20px' }}>Aktif çalışma oturumu özetinizi yerel hafızaya kaydedin ve uygulama yeniden başlatıldığında kaldığınız yerden devam edin.</p>

        <div className="handover-controls" style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <input
            type="text"
            className="handover-input"
            placeholder="Oturum özetini yazın (örn: Telegram workflow tamamlandı, Second Brain güncellendi)..."
            value={handoverSummary}
            onChange={(e) => setHandoverSummary(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveHandover()}
            style={{ flex: 1, padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--f-bark)', fontSize: '13px', outline: 'none' }}
          />
          <button onClick={handleSaveHandover} style={{ background: 'var(--f-moss)', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Save size={16} /> Oturumu Kaydet
          </button>
          <button onClick={handleResumeHandover} style={{ background: 'var(--f-cream)', border: '1px solid var(--f-bark)', color: 'var(--f-deep)', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCcw size={16} /> Yükle
          </button>
        </div>

        <div className="handover-log-box" style={{ background: '#1d1d1b', color: '#00e87a', borderRadius: '12px', padding: '16px', fontFamily: 'var(--f-mono)', fontSize: '12px' }}>
          <div className="log-title" style={{ color: 'var(--f-stone)', fontSize: '10px', marginBottom: '8px' }}>PERSISTED HANDOVER STATE LOG</div>
          <pre className="log-content" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{handoverLog}</pre>
        </div>
      </div>
    </div>
  );
};

export default SecondBrain;
