import React, { useState, useEffect, useRef } from 'react';
import { Mic, Paperclip, Zap, Send, MoreHorizontal, Clock, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { useNodes, nodeNickname } from '../hooks/useNodes';
import './Home.css';
import { useTranslation } from '../hooks/useTranslation';

const Home = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { messages, isGenerating, sendMessage, convId, setMessages } = useChat(location.state?.convId);
  const { nodes, status } = useNodes();
  
  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8420/history')
      .then(res => res.json())
      .then(data => {
        if (data.conversations) {
          setHistory(data.conversations.slice(0, 10));
        }
      })
      .catch(err => console.error("History fetch failed:", err));
  }, [convId]);

  useEffect(() => {
    if (location.state?.initialPrompt) {
      sendMessage(location.state.initialPrompt);
      // Clear state so it doesn't resend on reload
      navigate('/', { replace: true, state: {} });
    }
  }, [location.state, sendMessage, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || isGenerating) return;
    sendMessage(inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openConversation = (id) => {
    navigate('/', { state: { convId: id } });
  };

  const startNew = () => {
    navigate('/', { state: { convId: null } });
  };

  const activePeers = nodes.filter(n => !n.isLocal && n.status !== 'dead').length;
  const isNetworkActive = status === 'connected' && activePeers > 0;

  return (
    <div className="home-container">
      <div className="home-topbar">
        <div className="home-brand f-serif-italic">myc</div>
        <div className="home-status-group">
          <button className="icon-btn" onClick={() => startNew()} title="New Chat">
            <Plus size={18} />
          </button>
          <div className="status-pill" style={{ cursor: 'pointer' }} onClick={() => navigate('/colony')}>
            <span className="status-dot" style={{ background: isNetworkActive ? 'var(--f-alive)' : '#ffaa00' }}></span>
            {isNetworkActive ? `${activePeers + 1} devices` : 'local only'}
          </div>
          <div className="status-pill">
            Myca Core 3B
          </div>
          <button className="icon-btn" onClick={() => setInputValue(prev => prev + " (Listening...) ")} title="Voice Command">
            <Mic size={18} />
          </button>
        </div>
      </div>

      <div className="home-chat-area">
        {messages.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 100 100" width="60" height="60" style={{opacity: 0.3}}>
              <path d="M 50 50 Q 30 20 10 40 M 50 50 Q 80 20 90 60 M 50 50 Q 40 80 70 90" stroke="var(--f-spore)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
            <span style={{marginBottom: '24px'}}>Ask the colony to execute work</span>
            
            {history.length > 0 && (
              <div className="history-grid" style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '12px', color: 'var(--f-stone)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left' }}>Recent Executions</h3>
                {history.map(c => (
                  <div key={c.id} className="history-card" onClick={() => openConversation(c.id)} style={{
                    padding: '16px', background: 'var(--f-parchment)', borderRadius: '12px', border: '1px solid var(--f-bark)',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '14px', color: 'var(--f-deep)', fontWeight: '500' }}>{c.title || c.id.substring(0, 8)}</span>
                    <span style={{ fontSize: '12px', color: 'var(--f-soil)' }}><Clock size={12} style={{display: 'inline', marginRight: '4px', verticalAlign: 'middle'}}/>{new Date(c.updated_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((m, idx) => {
            const isUser = m.role === 'user';
            let metaText = m.meta;
            let metaColor = 'var(--f-stone)';

            if (!isUser) {
              if (m.compute_avoided) {
                metaText = `⚡ Cache · ${m.latency_ms?.toFixed(0) ?? '?'}ms`;
                metaColor = 'var(--f-spore)';
              } else if (m.node_display) {
                metaText = `${m.node_display} · ${m.tokens_per_second ? m.tokens_per_second.toFixed(1) : (m.tps ? m.tps.toFixed(1) : '?')} tok/s`;
              } else if (m.node_used && !m.node_used.includes('local')) {
                metaText = `${nodeNickname(m.node_used)} · ${m.tps ? m.tps.toFixed(1) : '?'} tok/s`;
              } else if (m.node_used) {
                metaText = `this device · ${m.tps ? m.tps.toFixed(1) : '?'} tok/s`;
              }
            }

            return (
              <div key={idx} className={`chat-bubble ${m.role}`} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', background: isUser ? 'var(--f-moss)' : 'transparent', color: isUser ? 'var(--f-cream)' : 'var(--f-humus)' }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {m.text || m.content}
                  {isGenerating && idx === messages.length - 1 && !isUser && (
                    <span style={{ display: 'inline-block', width: '4px', height: '14px', background: 'var(--f-spore)', marginLeft: '4px', animation: 'blink 1s infinite' }}></span>
                  )}
                </div>
                {metaText && <div className="chat-meta" style={{ color: metaColor }}>{metaText}</div>}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="home-input-area">
        <div className="input-container">
          <button className="icon-btn" onClick={() => document.querySelector('.drop-zone input')?.click()}><Paperclip size={18} /></button>
          <textarea 
            className="main-input"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('home.input.placeholder')}
            disabled={isGenerating}
            rows={1}
            style={{ resize: 'none', height: '40px', paddingTop: '10px' }}
          />
          <div className="input-actions">
            <button className="icon-btn" onClick={() => setInputValue(prev => prev + " (Listening...) ")}><Mic size={18} /></button>
            <button className="icon-btn"><Zap size={18} /></button>
            <button 
              className="icon-btn primary" 
              onClick={handleSend}
              disabled={!inputValue.trim() || isGenerating}
              style={{ opacity: (!inputValue.trim() || isGenerating) ? 0.5 : 1 }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        .history-card:hover { background: var(--f-linen) !important; }
      `}</style>
    </div>
  );
};

export default Home;
