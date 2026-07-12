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
        // Backend not up yet — retry after 1s
        if (retries < 30) {
          retries++;
          setTimeout(() => { connect(); }, 1000);
        } else {
          setStatusText('Failed to connect to local backend. Please launch the backend server.');
        }
      };

      ws.onclose = () => {
        if (!doneRef.current && retries < 30) {
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
    }, 1500);

    return () => {
      clearInterval(healthPoll);
      wsRef.current?.close();
    };
  }, [onComplete]);

  return (
    <div className="setup-screen">
      <div className="setup-content">
        {/* Logo */}
        <div className="setup-logo">
          <div className="setup-logo-hex">myca</div>
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
