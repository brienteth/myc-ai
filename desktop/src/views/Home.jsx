import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Mic, MessageCircle, Clock } from 'lucide-react';
import './Home.css';

const Home = () => {
  const [inputValue, setInputValue] = useState('');
  const [conversations, setConversations] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://127.0.0.1:8420/history')
      .then(res => res.json())
      .then(data => {
        if (data.conversations) {
          setConversations(data.conversations.slice(0, 5));
        }
      })
      .catch(err => console.error("History fetch failed:", err));
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      navigate('/chat', { state: { initialPrompt: inputValue.trim() } });
    }
  };

  const openConversation = (convId) => {
    navigate('/chat', { state: { convId } });
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="home-container">
      <div className="home-content">
        <h1 className="brand-title">Myca</h1>
        <h2 className="greeting">Good afternoon. What can I help you with today?</h2>
        
        <div className="input-wrapper">
          <input 
            type="text" 
            className="main-input" 
            placeholder="Describe what you need..." 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        
        <div className="quick-actions">
          <button className="action-pill">
            <FileText size={16} />
            <span>Drop a file</span>
          </button>
          <button className="action-pill">
            <Mic size={16} />
            <span>Speak</span>
          </button>
          <button className="action-pill">
            <MessageCircle size={16} />
            <span>Ask anything</span>
          </button>
        </div>
        
        <div className="recent-section">
          <div className="recent-header">RECENT CHATS</div>
          <div className="timeline">
            {conversations.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No chat history found.</div>
            ) : (
              conversations.map(conv => (
                <div 
                  key={conv.id} 
                  className="timeline-item" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => openConversation(conv.id)}
                >
                  <span className="time">{formatTime(conv.updated_at)}</span>
                  <span className="dot"></span>
                  <span className="event" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {conv.title}
                    <span style={{ fontSize: 11, opacity: 0.5 }}>· {conv.node_used === 'local' ? 'This Device' : conv.node_used}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      <div className="locality-indicator">
        Running locally on your MacBook Pro
      </div>
    </div>
  );
};

export default Home;
