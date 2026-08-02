import React, { useState, useEffect, useRef } from 'react';
import './SetupScreen.css';

/**
 * SetupScreen — shown on first launch while the backend initializes.
 * 
 * Key behaviour:
 *  - Tries to connect to the local backend via WebSocket + HTTP health poll.
 *  - If backend responds → transitions to the main app immediately.
 *  - After 8 seconds without backend → shows a "Continue anyway" button.
 *  - After 15 seconds without backend → auto-proceeds to the main app.
 * 
 * This ensures the app ALWAYS opens, even if the backend binary is missing
 * or can't start. Users should never be stuck on a loading screen.
 */
const SetupScreen = ({ onComplete }) => {
  const [phase, setPhase] = useState('connecting'); // connecting | downloading | ready | skipped
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing...');
  const [logLines, setLogLines] = useState([]);
  const [showSkip, setShowSkip] = useState(false);
  const wsRef = useRef(null);
  const doneRef = useRef(false);

  const finish = (reason = 'ready') => {
    if (doneRef.current) return;
    doneRef.current = true;
    setProgress(100);
    setPhase(reason === 'skip' ? 'skipped' : 'ready');
    setStatusText(reason === 'skip' ? 'Starting without backend...' : 'Ready!');
    setTimeout(onComplete, reason === 'skip' ? 400 : 600);
  };

  useEffect(() => {
    let retries = 0;
    let ws = null;

    // ── Safety timers ──
    // Show "skip" button after 3 seconds
    const skipTimer = setTimeout(() => {
      if (!doneRef.current) setShowSkip(true);
    }, 3000);

    // Auto-proceed after 6 seconds no matter what
    const autoTimer = setTimeout(() => {
      if (!doneRef.current) finish('skip');
    }, 6000);

    // ── Fake progress animation while connecting ──
    let fakeProgress = 0;
    const progressInterval = setInterval(() => {
      if (doneRef.current) { clearInterval(progressInterval); return; }
      // Slowly crawl to 85% max during connecting phase
      fakeProgress = Math.min(fakeProgress + Math.random() * 3, 85);
      setProgress(fakeProgress);
    }, 500);

    // ── WebSocket connection ──
    const connect = () => {
      if (doneRef.current) return;
      
      try {
        ws = new WebSocket('ws://127.0.0.1:8420/ws');
        wsRef.current = ws;

        ws.onopen = () => {
          setStatusText('Connected to local backend...');
        };

        ws.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);

            if (event.type === 'MODEL_DOWNLOAD') {
              setPhase('downloading');
              const { progress: msg, pct, phase: dlPhase } = event;
              if (dlPhase === 'done') { finish('ready'); return; }
              if (pct) setProgress(pct);
              if (msg) {
                setStatusText(msg);
                setLogLines(prev => [...prev.slice(-6), msg]);
              }
            }

            if (event.type === 'MODEL_READY') {
              setStatusText(`${event.model} ready!`);
              finish('ready');
            }

            if (event.type === 'NODE_READY') {
              finish('ready');
            }
          } catch (_) { /* ignore non-JSON frames */ }
        };

        ws.onerror = () => {
          if (!doneRef.current && retries < 15) {
            retries++;
            setStatusText(`Initializing local AI engine...`);
            setTimeout(connect, 1000);
          }
        };

        ws.onclose = () => {
          if (!doneRef.current && retries < 15) {
            retries++;
            setTimeout(connect, 1000);
          }
        };
      } catch (_) {
        // WebSocket constructor failed
        if (!doneRef.current && retries < 15) {
          retries++;
          setTimeout(connect, 1000);
        }
      }
    };

    connect();

    // ── HTTP health poll backup ──
    const healthPoll = setInterval(async () => {
      if (doneRef.current) { clearInterval(healthPoll); return; }
      try {
        const res = await fetch('http://127.0.0.1:8420/health', { signal: AbortSignal.timeout(2000) });
        if (res.ok) finish('ready');
      } catch (_) { /* still loading */ }
    }, 1500);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(autoTimer);
      clearInterval(progressInterval);
      clearInterval(healthPoll);
      wsRef.current?.close();
    };
  }, [onComplete]);

  return (
    <div className="setup-screen">
      <div className="setup-content">
        {/* Organic Mushroom Logo */}
        <div className="setup-logo">
          <svg width="48" height="48" viewBox="0 0 200 200" fill="none" style={{flexShrink:0}}>
            <path d="M 100 28 C 50 28 35 72 42 98 C 62 98 75 90 100 90 C 125 90 138 98 158 98 C 165 72 150 28 100 28 Z" stroke="#00e87a" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 52 98 Q 100 86 148 98" stroke="#00e87a" strokeWidth="4" opacity="0.8" />
            <path d="M 91 92 Q 88 122 84 142 C 95 145 105 145 116 142 Q 112 122 109 92" stroke="#00e87a" strokeWidth="6" strokeLinecap="round" />
            <path d="M 86 142 Q 68 162 42 158" stroke="#00e87a" strokeWidth="5" strokeLinecap="round" />
            <circle cx="42" cy="158" r="5" fill="#00e87a" />
            <path d="M 92 143 Q 78 178 62 188" stroke="#00e87a" strokeWidth="4" strokeLinecap="round" />
            <circle cx="62" cy="188" r="4" fill="#00e87a" />
            <path d="M 100 144 L 100 192" stroke="#00e87a" strokeWidth="5" strokeLinecap="round" />
            <circle cx="100" cy="192" r="5" fill="#00e87a" />
            <path d="M 108 143 Q 122 178 138 188" stroke="#00e87a" strokeWidth="4" strokeLinecap="round" />
            <circle cx="138" cy="188" r="4" fill="#00e87a" />
            <path d="M 114 142 Q 132 162 158 158" stroke="#00e87a" strokeWidth="5" strokeLinecap="round" />
            <circle cx="158" cy="158" r="5" fill="#00e87a" />
          </svg>
          <div className="setup-logo-pulse" />
        </div>

        {/* Title */}
        <h1 className="setup-title">
          {phase === 'ready' ? 'Ready.' : phase === 'skipped' ? 'Starting...' : 'Setting up for the first time...'}
        </h1>

        {/* Progress bar */}
        <div className="setup-progress-track">
          <div
            className={`setup-progress-fill ${phase === 'ready' || phase === 'skipped' ? 'complete' : ''}`}
            style={{ width: `${phase === 'connecting' && progress < 5 ? 5 : progress}%` }}
          />
        </div>

        {/* Status text */}
        <p className="setup-status">{statusText}</p>

        {/* Log lines */}
        {logLines.length > 0 && (
          <div className="setup-log">
            {logLines.map((line, i) => (
              <div key={i} className="setup-log-line">{line}</div>
            ))}
          </div>
        )}

        {/* Skip button — appears after 8 seconds */}
        {showSkip && phase !== 'ready' && phase !== 'skipped' && (
          <button className="setup-skip-btn" onClick={() => finish('skip')}>
            Continue without backend →
          </button>
        )}

        {/* Note */}
        {phase !== 'ready' && phase !== 'skipped' && !showSkip && (
          <p className="setup-note">
            This is a one-time process. myc will boot instantly next time.
          </p>
        )}
      </div>
    </div>
  );
};

export default SetupScreen;
