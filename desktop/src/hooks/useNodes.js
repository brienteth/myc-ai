import { useState, useEffect, useRef } from 'react';

export const nodeNickname = (node_id) => {
  if (!node_id) return 'Unknown Device';
  if (node_id.includes('local')) return 'This Device';
  
  const adj = ['Blue','Green','Purple','Orange','Grey','White','Red','Yellow','Pink','Navy'];
  const dev = ['Laptop','Desktop','Phone','Tablet','Mini','Box'];
  
  let h = 0;
  for (let c of node_id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  
  return adj[h % adj.length] + ' ' + dev[(h >> 4) % dev.length];
};

export const useNodes = () => {
  const [nodes, setNodes] = useState([]);
  const [status, setStatus] = useState('loading'); // loading, single, connected
  const [activeInferenceNode, setActiveInferenceNode] = useState(null);
  const wsRef = useRef(null);

  const fetchNodes = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8420/nodes/status');
      if (!res.ok) throw new Error('not ok');
      const data = await res.json();

      const localNode = {
        id: data.local.node_id,
        name: 'This Device',
        role: 'this device',
        status: data.local.status || 'ready',
        latency: 0,
        load_pct: data.local.load_pct ?? 0,
        tokens_per_second: data.local.tokens_per_second ?? 0,
        model_loaded: data.local.model_loaded ?? true,
        isLocal: true,
      };

      const peerNodes = (data.peers || []).map(p => ({
        id: p.node_id,
        name: nodeNickname(p.node_id),
        role: p.role,
        status: p.status,
        latency: p.latency_ms,
        load_pct: p.load_pct ?? 0,
        tokens_per_second: p.tokens_per_second ?? 0,
        model_loaded: p.model_loaded ?? false,
        isLocal: false,
      }));

      setNodes([localNode, ...peerNodes]);
      const activePeers = peerNodes.filter(n => n.status !== 'dead');
      setStatus(activePeers.length > 0 ? 'connected' : 'single');
    } catch (e) {
      // Fallback: try old /peers + /health
      try {
        const [peersRes, healthRes] = await Promise.all([
          fetch('http://127.0.0.1:8420/peers'),
          fetch('http://127.0.0.1:8420/health'),
        ]);
        if (peersRes.ok && healthRes.ok) {
          const peersData = await peersRes.json();
          const healthData = await healthRes.json();
          const myNode = {
            id: healthData.node_id, name: 'This Device', role: 'this device',
            status: 'ready', latency: 0, load_pct: 0, tokens_per_second: 0,
            model_loaded: true, isLocal: true,
          };
          const peerNodes = (peersData.peers || []).map(p => ({
            id: p.node_id, name: nodeNickname(p.node_id), role: p.role,
            status: p.status, latency: p.latency_ms,
            load_pct: p.load_pct ?? 0, tokens_per_second: p.tokens_per_second ?? 0,
            model_loaded: p.model_loaded ?? false, isLocal: false,
          }));
          setNodes([myNode, ...peerNodes]);
          setStatus(peerNodes.length > 0 ? 'connected' : 'single');
        }
      } catch {
        setStatus('single');
      }
    }
  };

  // WebSocket for real-time events
  useEffect(() => {
    let timeoutId;
    const connectWS = () => {
      try {
        const ws = new WebSocket('ws://127.0.0.1:8420/ws');
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);
            if (event.type === 'NODE_LOAD_UPDATE') {
              setNodes(prev => prev.map(n => 
                n.id === event.node_id
                  ? { ...n, load_pct: event.load_pct, tokens_per_second: event.tokens_per_second ?? n.tokens_per_second }
                  : n
              ));
            } else if (event.type === 'INFERENCE_NODE') {
              setActiveInferenceNode(event.node_id);
            } else if (event.type === 'INFERENCE_COMPLETE') {
              setActiveInferenceNode(null);
            } else if (event.type === 'ROUTE_FAILOVER') {
              setActiveInferenceNode(event.failover_to);
            } else if (event.type === 'MDNS_TIMEOUT') {
              setNodes(prev => prev.map(n =>
                n.id === event.node_id ? { ...n, status: 'dead' } : n
              ));
            } else if (event.type === 'MDNS_DISCOVER' && event.reason === 'recovery') {
              fetchNodes(); // refresh on recovery
            }
          } catch (err) {}
        };

        ws.onerror = () => {};
        ws.onclose = () => {
          setTimeout(connectWS, 3000); // reconnect
        };
      } catch (e) {
        console.error("WS error:", e);
      }
    };

    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 2000);
    return () => clearInterval(interval);
  }, []);

  return { nodes, status, activeInferenceNode };
};

