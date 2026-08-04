import { useState, useEffect } from 'react';

export const useNetwork = (wsUrl = 'ws://localhost:8420/ws') => {
  const [connected, setConnected] = useState(false);
  const [isInferring, setIsInferring] = useState(false);

  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          
          if (event.type === 'INFERENCE_START') {
            setIsInferring(true);
          } else if (event.type === 'INFERENCE_COMPLETE' || event.type === 'INFERENCE_ERROR') {
            setIsInferring(false);
          }
        } catch (err) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setIsInferring(false);
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [wsUrl]);

  return { connected, isInferring };
};
