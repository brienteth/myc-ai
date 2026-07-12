import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { useNodes, nodeNickname } from '../hooks/useNodes';
import Network from './Network';

const NetworkPill = ({ nodes, status, onClick }) => {
  const activePeers = nodes.filter(n => !n.isLocal && n.status !== 'dead').length;
  
  let dotColor = '#ffaa00'; // amber
  let text = 'connecting...';
  
  if (status === 'connected' && activePeers > 0) {
    dotColor = 'var(--accent)';
    text = `${activePeers + 1} devices connected`;
  } else if (status === 'single' || (status === 'connected' && activePeers === 0)) {
    dotColor = '#ffaa00';
    text = 'local device only';
  }

  return (
    <button style={styles.networkPill} onClick={onClick}>
      <div style={{
        ...styles.statusDot,
        background: dotColor,
        animation: dotColor === 'var(--accent)' ? 'netpulse 2s ease-in-out infinite' : 'none'
      }} />
      <span>{text}</span>
      <style>{`
        @keyframes netpulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </button>
  );
};

const Chat = () => {
  const location = useLocation();
  const { messages, isGenerating, sendMessage } = useChat(location.state?.convId);
  const { nodes, status } = useNodes();
  const [input, setInput] = useState('');
  const [showNetwork, setShowNetwork] = useState(false);
  const [planModal, setPlanModal] = useState(null);
  const [planning, setPlanning] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const hasInitialized = useRef(false);

  const handleAutomateIntent = async (intentText) => {
    setPlanning(true);
    try {
      const res = await fetch('http://localhost:8420/automation/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: intentText })
      });
      const data = await res.json();
      if (data.plan) {
        setPlanModal(data.plan);
      }
    } catch (e) {
      console.error("Failed to plan automation:", e);
    } finally {
      setPlanning(false);
    }
  };

  const handleSavePlannedWorkflow = async () => {
    if (!planModal) return;
    try {
      const flowToSave = { ...planModal, enabled: true };
      await fetch('http://localhost:8420/automation/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flowToSave)
      });
      setPlanModal(null);
      alert("Automation Workflow created and enabled successfully!");
    } catch (e) {
      console.error("Failed to save workflow:", e);
    }
  };

  useEffect(() => {
    if (!hasInitialized.current && location.state?.initialPrompt) {
      hasInitialized.current = true;
      sendMessage(location.state.initialPrompt);
    }
  }, [location.state, sendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInput = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 120) + 'px';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isGenerating) {
        sendMessage(input);
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = '44px';
      }
    }
  };

  const handleSend = () => {
    if (input.trim() && !isGenerating) {
      sendMessage(input);
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = '44px';
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <header style={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={styles.logo} onClick={() => window.location.href = '/'}>myca</div>
          <button 
            style={styles.newChatBtn}
            onClick={() => window.location.href = '/chat'}
          >
            + New Chat
          </button>
        </div>
        <NetworkPill nodes={nodes} status={status} onClick={() => setShowNetwork(true)} />
        <button style={styles.iconBtn} onClick={() => setShowNetwork(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
          </svg>
        </button>
      </header>

      {/* Chat Area */}
      <div style={styles.chatArea}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>◈</div>
            <div style={styles.emptyText}>Ask anything</div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div key={idx} style={{
                ...styles.messageWrapper,
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: isUser ? '72%' : '84%',
                background: isUser ? 'var(--card)' : 'transparent',
                border: isUser ? '1px solid var(--border)' : 'none',
                borderRadius: isUser ? '18px 18px 4px 18px' : '0',
                padding: isUser ? '11px 15px' : '4px 0',
              }}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: isUser ? 1.5 : 1.6 }}>
                  {msg.content}
                  {isGenerating && idx === messages.length - 1 && !isUser && (
                    <span style={styles.cursor}></span>
                  )}
                </div>
                {!isUser && msg.nodes && (
                  <div style={styles.attribution}>
                    {msg.compute_avoided
                      ? <span style={{color: '#00e87a'}}>
                          ⚡ Cache · {msg.latency_ms?.toFixed(0) ?? '?'}ms
                        </span>
                      : msg.node_display
                        ? <span style={{color: 'var(--muted)'}}>
                            {msg.node_display} · {msg.tokens_per_second ? msg.tokens_per_second.toFixed(1) : (msg.tps ? msg.tps.toFixed(1) : '?')} tok/s
                          </span>
                        : msg.node_used && !msg.node_used.includes('local')
                          ? `${nodeNickname(msg.node_used)} · ${msg.tps ? msg.tps.toFixed(1) : '?'} tok/s`
                          : `this device · ${msg.tps ? msg.tps.toFixed(1) : '?'} tok/s`
                    }
                  </div>
                )}
                
                {/* Automate Flow context button */}
                {!isUser && !isGenerating && idx === messages.length - 1 && (
                  <button 
                    onClick={() => handleAutomateIntent(msg.content)}
                    style={styles.automateBtn}
                  >
                    ◈ Automate Flow
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={styles.inputArea}>
        <div style={styles.inputContainer}>
          <textarea
            ref={textareaRef}
            style={styles.textarea}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            disabled={isGenerating}
            rows={1}
          />
          <button 
            style={{
              ...styles.sendBtn,
              opacity: (!input.trim() || isGenerating) ? 0.3 : 1,
              cursor: (!input.trim() || isGenerating) ? 'default' : 'pointer'
            }}
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </div>

      {/* Plan Preview Modal */}
      {planModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3>◈ Suggesting Automation Flow</h3>
            <p style={{fontSize: '13px', color: 'var(--muted)', margin: '4px 0 16px 0'}}>
              Myca Planner successfully translated the conversation into a DAG workflow.
            </p>
            <div style={styles.planPreviewCard}>
              <div style={{fontWeight: 'bold', fontSize: '15px'}}>{planModal.name}</div>
              <div style={{fontSize: '12px', color: 'var(--muted)', margin: '4px 0 12px 0'}}>{planModal.description}</div>
              <div style={{fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 'bold'}}>
                Trigger: {planModal.trigger?.type}
              </div>
              <div style={{marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {planModal.nodes?.map((n, i) => (
                  <div key={i} style={styles.previewNodeItem}>
                    <span style={{fontSize: '10px', color: 'var(--muted)'}}>STEP {i+1}</span>
                    <div style={{fontSize: '13px', fontWeight: 'bold'}}>{n.skill}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setPlanModal(null)}>Cancel</button>
              <button style={styles.saveBtn} onClick={handleSavePlannedWorkflow}>Save & Enable</button>
            </div>
          </div>
        </div>
      )}

      {planning && (
        <div style={styles.modalOverlay}>
          <div style={styles.loaderBox}>
            <div className="spinner" style={styles.spinner}></div>
            <div style={{marginTop: '12px'}}>◈ Myca Planner is designing Workflow...</div>
            <style>{`
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
          </div>
        </div>
      )}

      <Network 
        nodes={nodes} 
        isVisible={showNetwork} 
        onClose={() => setShowNetwork(false)} 
      />
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
  },
  topBar: {
    height: '52px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    flexShrink: 0,
  },
  logo: {
    fontFamily: 'var(--font-mono)',
    fontSize: '16px',
    fontWeight: 500,
    color: 'var(--accent)',
    cursor: 'pointer',
  },
  newChatBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  networkPill: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '100px',
    padding: '5px 12px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    color: 'var(--text)',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    color: 'var(--text)',
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    scrollBehavior: 'smooth',
  },
  emptyState: {
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  emptyIcon: {
    fontSize: '48px',
    color: 'var(--accent)',
    opacity: 0.3,
    lineHeight: 1,
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--muted)',
  },
  messageWrapper: {
    fontSize: '15px',
    color: 'var(--text)',
  },
  cursor: {
    display: 'inline-block',
    width: '2px',
    height: '14px',
    background: 'var(--accent)',
    marginLeft: '2px',
    animation: 'blink 0.8s step-end infinite',
    verticalAlign: 'middle',
  },
  attribution: {
    fontSize: '11px',
    color: 'var(--muted)',
    fontFamily: 'var(--font-mono)',
    marginTop: '4px',
  },
  inputArea: {
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
    padding: '12px 16px',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
    flexShrink: 0,
  },
  inputContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '10px 14px',
    color: 'var(--text)',
    fontFamily: 'var(--font-ui)',
    fontSize: '15px',
    resize: 'none',
    minHeight: '44px',
    maxHeight: '120px',
    outline: 'none',
    lineHeight: 1.4,
  },
  sendBtn: {
    background: 'var(--accent)',
    border: 'none',
    borderRadius: '10px',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  automateBtn: {
    background: 'rgba(0, 232, 122, 0.1)',
    color: '#00e87a',
    border: '1px solid rgba(0, 232, 122, 0.2)',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    cursor: 'pointer',
    marginTop: '8px',
    display: 'inline-block',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modalContent: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '480px',
    padding: '24px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  planPreviewCard: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  previewNodeItem: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  saveBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: '#000',
    fontWeight: 'bold',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  loaderBox: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    padding: '24px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  spinner: {
    border: '3px solid var(--border)',
    borderTop: '3px solid var(--accent)',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    animation: 'spin 1s linear infinite',
  }
};

export default Chat;
