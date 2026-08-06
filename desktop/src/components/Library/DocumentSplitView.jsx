import React, { useState, useEffect } from 'react';
import { FileText, X, Bot, Languages, Table, Users, Zap, List, Download, Send } from 'lucide-react';
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

  useEffect(() => {
    if (document?.id) {
      fetch(`http://127.0.0.1:8420/library/files/${document.id}`)
        .then(res => res.json())
        .then(data => setDocContent(data))
        .catch(err => console.error("Failed to load document content:", err));
    }
  }, [document?.id]);

  if (!document) return null;

  const displayName = cleanFilename(document.filename || document.name);

  const askAi = async (prompt) => {
    setIsTyping(true);
    setMessages(prev => [
      ...prev,
      { role: 'user', text: prompt },
      { role: 'assistant', text: '' }
    ]);
    
    // Build context from actual document content or metadata
    const contentContext = docContent?.content 
      ? `\n\nDocument Content:\n${docContent.content}` 
      : `\n\nMedia Document Info: ${displayName} (${document.type}, Size: ${formatBytes(document.size_bytes)})`;
    
    const fullPrompt = `Context Document: ${displayName}${contentContext}\n\nUser Question: ${prompt}\n\nPlease answer accurately and directly based on the document content or file metadata provided.`;

    const result = await queryAI({
      prompt: fullPrompt,
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

  return (
    <div className="split-view-overlay">
      <div className="split-view-container">
        
        {/* Left: Document Viewer */}
        <div className="split-left">
          <div className="split-header">
            <div className="split-title">
              <FileText size={18} color="var(--f-soil)" />
              <span>{displayName}</span>
            </div>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="split-content doc-preview">
            <div className="mock-pdf">
              <h2>{displayName}</h2>
              {document.type === 'image' ? (
                <div style={{textAlign: 'center', margin: '16px 0'}}>
                  <img 
                    src={`http://127.0.0.1:8420/library/files/${document.id}/raw`} 
                    alt={displayName} 
                    style={{maxWidth: '100%', maxHeight: 380, borderRadius: 12, border: '1px solid var(--f-bark)', objectFit: 'contain'}} 
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              ) : null}
              {docContent?.content ? (
                <div style={{whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--f-deep)', maxHeight: '50vh', overflowY: 'auto'}}>
                  {docContent.content}
                </div>
              ) : (
                <>
                  <p style={{color: 'var(--f-earth)'}}>
                    {document.type === 'image' ? 'Image File — Visual content preview & metadata loaded.' :
                     document.type === 'video' ? 'Video File — Metadata indexed.' :
                     document.type === 'audio' ? 'Audio File — Metadata indexed.' :
                     'Loading document content...'}
                  </p>
                </>
              )}
              <div style={{marginTop: 16, padding: '12px 16px', background: 'var(--f-linen)', borderRadius: 8, fontSize: 12}}>
                <div><strong>Type:</strong> {document.type}</div>
                <div><strong>Size:</strong> {formatBytes(document.size_bytes)}</div>
                {document.created_at && <div><strong>Added:</strong> {new Date(document.created_at * 1000).toLocaleString()}</div>}
                {document.summary && <div><strong>Summary:</strong> {document.summary}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Right: AI Panel */}
        <div className="split-right">
          <div className="split-header">
            <div className="split-title">
              <Bot size={18} color="var(--f-moss)" />
              <span>AI Analysis</span>
            </div>
          </div>
          <div className="split-content ai-panel">
            
            <div className="ai-actions-grid">
              <button className="ai-action-btn" onClick={() => askAi("Bu dokümanı 3 ana maddede özetle.")} disabled={isTyping}><List size={15} /> Özet Çıkar</button>
              <button className="ai-action-btn" onClick={() => askAi("Bu dokümanın özetini Türkçe'ye çevir.")} disabled={isTyping}><Languages size={15} /> Çevir</button>
              <button className="ai-action-btn" onClick={() => askAi("Dokümandaki tablo ve sayısal verileri Markdown olarak çıkar.")} disabled={isTyping}><Table size={15} /> Tabloları Çıkar</button>
              <button className="ai-action-btn" onClick={() => askAi("Dokümanda geçen tüm kişi, kurum ve iletişim bilgilerini listele.")} disabled={isTyping}><Users size={15} /> İletişim Bilgileri</button>
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
                  placeholder="Doküman hakkında soru sorun..." 
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
