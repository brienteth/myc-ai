import React, { useState, useEffect } from 'react';
import { FileText, X, Bot, Languages, Table, Users, Zap, List, Download } from 'lucide-react';
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
    { role: 'assistant', text: "Hi! I'm ready to analyze this document. What would you like to know?" }
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
    setMessages(prev => [...prev, { role: 'user', text: prompt }]);
    
    // Build context from actual document content
    const contentContext = docContent?.content ? `\n\nDocument Content:\n${docContent.content}` : '';
    const fullPrompt = `Context Document: ${displayName}${contentContext}\n\nUser Question: ${prompt}\n\nPlease answer based on the document content.`;

    try {
      const res = await fetch('http://127.0.0.1:8420/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, stream: false })
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, { role: 'assistant', text: data.response || data.error || 'Done.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I couldn't connect to the local model. Make sure Ollama is running." }]);
    }
    setIsTyping(false);
  };

  const handleSend = (e) => {
    if (e.key === 'Enter' && input.trim()) {
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
              {docContent?.content ? (
                <div style={{whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--f-deep)', maxHeight: '60vh', overflowY: 'auto'}}>
                  {docContent.content}
                </div>
              ) : (
                <>
                  <p style={{color: 'var(--f-earth)'}}>
                    {document.type === 'image' ? 'Image file - use AI actions to analyze.' :
                     document.type === 'video' ? 'Video file - metadata indexed.' :
                     document.type === 'audio' ? 'Audio file - metadata indexed.' :
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
              <button className="ai-action-btn" onClick={() => askAi("Summarize this document in 3 bullet points.")} disabled={isTyping}><List size={16} /> Summarize</button>
              <button className="ai-action-btn" onClick={() => askAi("Translate the summary of this document to Turkish.")} disabled={isTyping}><Languages size={16} /> Translate</button>
              <button className="ai-action-btn" onClick={() => askAi("Extract any data tables into Markdown format.")} disabled={isTyping}><Table size={16} /> Extract Tables</button>
              <button className="ai-action-btn" onClick={() => askAi("Extract all people and contact info mentioned.")} disabled={isTyping}><Users size={16} /> Extract Contacts</button>
            </div>

            <div className="ai-chat-box">
              <div className="chat-history" style={{maxHeight: 300, overflowY: 'auto', marginBottom: 16}}>
                {messages.map((m, i) => (
                  <p key={i} className={m.role === 'user' ? 'user-msg' : 'ai-msg'} style={{
                    background: m.role === 'user' ? 'var(--f-linen)' : 'transparent',
                    padding: m.role === 'user' ? '8px 12px' : '4px 0',
                    borderRadius: 8,
                    color: m.role === 'user' ? 'var(--f-deep)' : 'var(--f-earth)',
                    fontSize: 13,
                    marginBottom: 12,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {m.text}
                  </p>
                ))}
                {isTyping && <p className="ai-msg" style={{color: 'var(--f-soil)', fontSize: 13}}>⏳ Thinking...</p>}
              </div>
              
              <div className="ai-input-area">
                <input 
                  type="text" 
                  placeholder="Ask questions about this document... (Press Enter)" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleSend}
                  disabled={isTyping}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentSplitView;
