import React, { useState, useEffect, useRef } from 'react';
import './SetupScreen.css';

const LOGO = '⬡'; // hexagon placeholder, replace with actual SVG logo

/**
 * SetupScreen — shown on first launch while the model downloads.
 * Listens to backend WebSocket for MODEL_DOWNLOAD / MODEL_READY events.
 * When ready, calls onComplete() to transition to the main app.
 */
const SetupScreen = ({ onComplete }) => {
  const [phase, setPhase] = useState('connecting'); // connecting | downloading | ready
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Connecting...');
  const [logLines, setLogLines] = useState([]);
  const wsRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let retries = 0;

    const connect = () => {
      const ws = new WebSocket('ws://127.0.0.1:8420/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        setPhase('connecting');
        setStatusText('Link established with local backend...');
      };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);

          if (event.type === 'MODEL_DOWNLOAD') {
            setPhase('downloading');
            const { progress: msg, pct, phase: dlPhase } = event;
            if (dlPhase === 'done' && !doneRef.current) {
              doneRef.current = true;
              setProgress(100);
              setStatusText('Model ready! Launching...');
              setPhase('ready');
              setTimeout(onComplete, 1200);
              return;
            }
            if (pct) setProgress(pct);
            if (msg) {
              setStatusText(msg);
              setLogLines(prev => [...prev.slice(-6), msg]);
            }
          }

          if (event.type === 'MODEL_READY' && !doneRef.current) {
            doneRef.current = true;
            setProgress(100);
            setStatusText(`${event.model} ready! Launching...`);
            setPhase('ready');
            setTimeout(onComplete, 900);
          }

          if (event.type === 'NODE_READY' && !doneRef.current) {
            // Model was already installed, backend just came up
            doneRef.current = true;
            setProgress(100);
            setStatusText('Ready!');
            setPhase('ready');
            setTimeout(onComplete, 600);
          }
        } catch (_) { /* ignore non-JSON frames */ }
      };

      ws.onerror = () => {
        // Backend not up yet — keep retrying gracefully
        if (retries < 300) {
          retries++;
          setStatusText(`Initializing local AI engine (attempt ${retries})...`);
          setTimeout(() => { connect(); }, 1000);
        } else {
          setStatusText('Initializing local AI engine...');
        }
      };

      ws.onclose = () => {
        if (!doneRef.current && retries < 300) {
          retries++;
          setTimeout(() => { connect(); }, 1000);
        }
      };
    };

    connect();

    // Also poll /health as a backup — if backend is up and model is ready
    const healthPoll = setInterval(async () => {
      if (doneRef.current) { clearInterval(healthPoll); return; }
      try {
        const res = await fetch('http://127.0.0.1:8420/health', { signal: AbortSignal.timeout(2000) });
        if (res.ok && !doneRef.current) {
          doneRef.current = true;
          setProgress(100);
          setStatusText('Ready!');
          setPhase('ready');
          clearInterval(healthPoll);
          setTimeout(onComplete, 600);
        }
      } catch (_) { /* still loading */ }
    }, 1000);

    return () => {
      clearInterval(healthPoll);
      wsRef.current?.close();
    };
  }, [onComplete]);

  return (
    <div className="setup-screen">
      <div className="setup-content">
        {/* Organic Mushroom Logo */}
        <div className="setup-logo">
          <svg width="48" height="48" viewBox="0 0 200 200" fill="none" style="flex-shrink:0;">
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
            <path d="M 114 142 Q 132 162 158 158" stroke="#00e87a" strokeWidth="5" stroke-linecap="round" />
            <circle cx="158" cy="158" r="5" fill="#00e87a" />
          </svg>
          <div className="setup-logo-pulse" />
        </div>

        {/* Title */}
        <h1 className="setup-title">
          {phase === 'ready' ? 'Ready.' : 'Setting up for the first time...'}
        </h1>

        {/* Progress bar */}
        <div className="setup-progress-track">
          <div
            className={`setup-progress-fill ${phase === 'ready' ? 'complete' : ''}`}
            style={{ width: `${phase === 'connecting' ? 5 : progress}%` }}
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

        {/* Note */}
        {phase !== 'ready' && (
          <p className="setup-note">
            This is a one-time process. myc will boot instantly next time.
          </p>
        )}
      </div>
    </div>
  );
};

export default SetupScreen;
