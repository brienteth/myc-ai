import React, { useState, useEffect } from 'react';
import { 
  FileText, X, Bot, Languages, Table, Users, Zap, List, Download, Send,
  FileCode, Video, Volume2, Image as ImageIcon, Eye, Play, Sparkles
} from 'lucide-react';
import { queryAI } from '../../services/aiService';
import '../../views/Library.css';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return 'Unknown';
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

const DocumentSplitView = ({ document, onClose }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Merhaba! Bu dokümanı analiz etmeye hazırım. Neyi öğrenmek istersiniz?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [docContent, setDocContent] = useState(null);

  const backendUrl = window.getBackendUrl ? window.getBackendUrl() : 'http://127.0.0.1:8420';

  useEffect(() => {
    if (document?.id) {
      fetch(`${backendUrl}/library/files/${document.id}`)
        .then(res => res.json())
        .then(data => setDocContent(data))
        .catch(err => console.error("Failed to load document content:", err));
    }
  }, [document?.id]);

  if (!document) return null;

  const displayName = cleanFilename(document.filename || document.name);
  const rawFileUrl = `${backendUrl}/library/files/${document.id}/raw`;

  const askAi = async (prompt) => {
    setIsTyping(true);
    setMessages(prev => [
      ...prev,
      { role: 'user', text: prompt },
      { role: 'assistant', text: '' }
    ]);
    
    // Build context from actual document content or metadata
    const contentContext = docContent?.content 
      ? `\n\nDosya/Doküman İçeriği:\n${docContent.content}` 
      : `\n\nMedya/Dosya Bilgisi: ${displayName} (Tipi: ${document.type}, Boyut: ${formatBytes(document.size_bytes)})`;
    
    const fullPrompt = `Aşağıdaki dosya bilgisini veya metnini detaylıca inceleyerek kullanıcının sorusuna doğrudan, öz ve net Türkçe yanıt ver:

Dosya Adı: ${displayName}
Dosya Türü: ${document.type}
${contentContext}

Kullanıcı İsteği: ${prompt}

Lütfen içeriğe tam bağlı kalarak Türkçe olarak yanıtla.`;

    const result = await queryAI({
      prompt: fullPrompt,
      skipPlanner: true,
      onToken: (token) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = { ...newMsgs[newMsgs.length - 1] };
          lastMsg.text += token;
          newMsgs[newMsgs.length - 1] = lastMsg;
          return newMsgs;
        });
      }
    });

    setMessages(prev => {
      const newMsgs = [...prev];
      const lastMsg = { ...newMsgs[newMsgs.length - 1] };
      if (!lastMsg.text) {
        lastMsg.text = result || "Analiz tamamlandı.";
      }
      newMsgs[newMsgs.length - 1] = lastMsg;
      return newMsgs;
    });

    setIsTyping(false);
  };

  const handleSend = (e) => {
    if ((e.key === 'Enter' || e.type === 'click') && input.trim()) {
      const q = input.trim();
      setInput('');
      askAi(q);
    }
  };

  // Get dynamic action buttons based on document type
  const renderAIActions = () => {
    switch (document.type) {
      case 'image':
        return (
          <>
            <button className="ai-action-btn" onClick={() => askAi("Görselde yer alan tüm objeleri ve kompozisyonu detaylıca betimle.")} disabled={isTyping}><Eye size={14} /> Görseli Betimle</button>
            <button className="ai-action-btn" onClick={() => askAi("Görseldeki yazıları çıkar (OCR analizi yap).")} disabled={isTyping}><Sparkles size={14} /> Metinleri Oku (OCR)</button>
            <button className="ai-action-btn" onClick={() => askAi("Görselin renk paletini, tasarım dilini ve estetik yapısını analiz et.")} disabled={isTyping}><Table size={14} /> Tasarımı Çözümle</button>
          </>
        );
      case 'code':
        return (
          <>
            <button className="ai-action-btn" onClick={() => askAi("Koddaki olası mantıksal hataları (bug) ve güvenlik açıklarını denetle.")} disabled={isTyping}><FileCode size={14} /> Bug & Güvenlik Analizi</button>
            <button className="ai-action-btn" onClick={() => askAi("Bu kodu daha temiz, modüler ve performanslı hale getirmek için refactor önerileri sun.")} disabled={isTyping}><Zap size={14} /> Refactor Önerileri</button>
            <button className="ai-action-btn" onClick={() => askAi("Bu kodun algoritmasını ve çalışma mantığını adım adım açıkla.")} disabled={isTyping}><List size={14} /> Kodu Açıkla</button>
          </>
        );
      case 'video':
        return (
          <>
            <button className="ai-action-btn" onClick={() => askAi("Bu videonun metadata ve dosya analizini yapıp teknik özet çıkar.")} disabled={isTyping}><Video size={14} /> Teknik Özet</button>
            <button className="ai-action-btn" onClick={() => askAi("Bu video dosyası ile otonom bir workflow tetiklemek için senaryolar öner.")} disabled={isTyping}><Zap size={14} /> Akış Senaryoları</button>
          </>
        );
      case 'audio':
        return (
          <>
            <button className="ai-action-btn" onClick={() => askAi("Ses dosyasındaki konuşmaları deşifre edip yazıya dökmek için transkript adımlarını planla.")} disabled={isTyping}><Volume2 size={14} /> Deşifre Planı</button>
            <button className="ai-action-btn" onClick={() => askAi("Bu ses kaydının metadata özetini çıkar.")} disabled={isTyping}><List size={14} /> Ses Özetini Çıkar</button>
          </>
        );
      default:
        return (
          <>
            <button className="ai-action-btn" onClick={() => askAi("Bu dokümanı 3 ana maddede özetle.")} disabled={isTyping}><List size={14} /> Özet Çıkar</button>
            <button className="ai-action-btn" onClick={() => askAi("Bu dokümanın özetini Türkçe'ye çevir.")} disabled={isTyping}><Languages size={14} /> Çevir</button>
            <button className="ai-action-btn" onClick={() => askAi("Dokümandaki tablo ve sayısal verileri Markdown olarak çıkar.")} disabled={isTyping}><Table size={14} /> Tabloları Çıkar</button>
            <button className="ai-action-btn" onClick={() => askAi("Dokümanda geçen tüm kişi, kurum ve iletişim bilgilerini listele.")} disabled={isTyping}><Users size={14} /> İletişim Bilgileri</button>
          </>
        );
    }
  };

  // Get viewer element based on document type
  const renderViewer = () => {
    if (document.type === 'image') {
      return (
        <div style={{ textAlign: 'center', margin: '16px 0' }}>
          <img 
            src={rawFileUrl} 
            alt={displayName} 
            style={{ maxWidth: '100%', maxHeight: 380, borderRadius: 12, border: '1px solid var(--f-bark)', objectFit: 'contain' }} 
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      );
    }

    if (document.type === 'video') {
      return (
        <div style={{ textAlign: 'center', margin: '16px 0', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
          <video 
            src={rawFileUrl} 
            controls 
            style={{ width: '100%', maxHeight: 380, display: 'block' }}
            onError={(e) => console.error("Video play failed:", e)}
          />
        </div>
      );
    }

    if (document.type === 'audio') {
      return (
        <div style={{ margin: '24px 0', padding: '16px', background: 'var(--f-parchment)', borderRadius: 12, border: '1px solid var(--f-bark)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Volume2 size={36} color="var(--f-moss)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{displayName}</span>
          <audio 
            src={rawFileUrl} 
            controls 
            style={{ width: '100%' }}
          />
        </div>
      );
    }

    if (document.type === 'code') {
      return (
        <div style={{ margin: '16px 0' }}>
          <pre style={{
            background: 'var(--f-parchment, #fbfbf9)',
            border: '1px solid var(--f-bark, #DDD7CB)',
            borderRadius: 10,
            padding: 16,
            fontFamily: 'var(--f-mono, monospace)',
            fontSize: 12.5,
            lineHeight: 1.6,
            overflowX: 'auto',
            maxHeight: '45vh',
            color: 'var(--f-deep, #1D1D1B)',
            textAlign: 'left',
            whiteSpace: 'pre-wrap'
          }}>
            <code>{docContent?.content || 'Loading source code...'}</code>
          </pre>
        </div>
      );
    }

    // Default document or fallback content
    return (
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--f-deep)', maxHeight: '50vh', overflowY: 'auto' }}>
        {docContent?.content || 'Loading document content...'}
      </div>
    );
  };

  return (
    <div className="split-view-overlay">
      <div className="split-view-container">
        
        {/* Left: Document/Media Viewer */}
        <div className="split-left">
          <div className="split-header">
            <div className="split-title">
              {document.type === 'code' ? <FileCode size={18} color="var(--f-soil)" /> :
               document.type === 'video' ? <Video size={18} color="var(--f-soil)" /> :
               document.type === 'audio' ? <Volume2 size={18} color="var(--f-soil)" /> :
               document.type === 'image' ? <ImageIcon size={18} color="var(--f-soil)" /> :
               <FileText size={18} color="var(--f-soil)" />}
              <span>{displayName}</span>
            </div>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="split-content doc-preview">
            <div className="mock-pdf">
              <h2>{displayName}</h2>
              
              {renderViewer()}

              <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--f-linen)', borderRadius: 8, fontSize: 12 }}>
                <div><strong>Type:</strong> {document.type}</div>
                <div><strong>Size:</strong> {formatBytes(document.size_bytes)}</div>
                {document.created_at && <div><strong>Added:</strong> {new Date(document.created_at * 1000).toLocaleString()}</div>}
                {document.summary && <div><strong>Summary:</strong> {document.summary}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Right: AI Analysis Panel */}
        <div className="split-right">
          <div className="split-header">
            <div className="split-title">
              <Bot size={18} color="var(--f-moss)" />
              <span>AI Analysis</span>
            </div>
          </div>
          <div className="split-content ai-panel">
            
            <div className="ai-actions-grid">
              {renderAIActions()}
            </div>

            <div className="ai-chat-box">
              <div className="chat-history">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === 'user' ? 'user-msg-bubble' : 'ai-msg-bubble'}>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.text}</p>
                  </div>
                ))}
                {isTyping && <div className="ai-msg-bubble thinking"><p style={{ margin: 0 }}>⏳ Analiz yapılıyor...</p></div>}
              </div>
              
              <div className="ai-input-area">
                <input 
                  type="text" 
                  placeholder={`${displayName} hakkında soru sorun...`} 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleSend}
                  disabled={isTyping}
                />
                <button className="ai-send-btn" onClick={handleSend} disabled={isTyping || !input.trim()}>
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentSplitView;
