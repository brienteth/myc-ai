import { useState, useEffect, useRef, useCallback } from 'react';

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
  const [lanDevices, setLanDevices] = useState([]);
  const [status, setStatus] = useState('loading'); // loading, single, connected
  const [activeInferenceNode, setActiveInferenceNode] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [pairingStatus, setPairingStatus] = useState('not_applicable');
  const [mobileId, setMobileId] = useState(null);
  const wsRef = useRef(null);
  const retryCountRef = useRef(0);

  const getBackendUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const hostParam = params.get('host');
    if (hostParam) return `http://${hostParam}:8420`;
    
    // If running remotely (e.g. Localtunnel or Vercel edge)
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.origin;
    }
    return 'http://127.0.0.1:8420';
  }, []);

  useEffect(() => {
    // Correctly identify if this is the desktop host app or a remote client
    const isElectron = /Electron/i.test(navigator.userAgent);
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHostApp = isElectron || isLocal;
    const isRemoteClient = !isHostApp;
    
    if (isRemoteClient) {
      let localId = null;
      try {
        localId = localStorage.getItem('myca_mobile_id');
      } catch (e) {
        console.warn('localStorage access blocked:', e);
      }
      
      if (!localId) {
        localId = Math.random().toString(36).substring(2, 8);
        try {
          localStorage.setItem('myca_mobile_id', localId);
        } catch (e) {}
      }
      
      const generatedId = 'mobile-' + localId;
      setMobileId(generatedId);
      setPairingStatus('pending');

      const payload = {
        node_id: generatedId,
        role: 'mobile_web',
        capabilities: ['inference', 'webgpu', 'sensors']
      };

      const backendUrl = getBackendUrl();
      const endpoints = ['/api/registry/register', `${backendUrl}/api/registry/register`];
      
      endpoints.forEach(ep => {
        fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      });

      // Poll registration status every 3s
      const pollUrl = `${window.location.origin}/api/registry/status?node_id=${generatedId}`;
      const interval = setInterval(async () => {
        try {
          const res = await fetch(pollUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'approved') {
              setPairingStatus('approved');
              clearInterval(interval);
            } else if (data.status === 'declined') {
              setPairingStatus('declined');
            }
          }
        } catch (e) {}
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [getBackendUrl]);

  const fetchNodes = useCallback(async () => {
    const backendUrl = getBackendUrl();
    try {
      const res = await fetch(`${backendUrl}/nodes/status`);
      if (!res.ok) throw new Error('not ok');
      const data = await res.json();

      if (!backendOnline) setBackendOnline(true);
      retryCountRef.current = 0;

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
        category: 'myca',
        mycelium_score: data.local.mycelium_score ?? 95.0,
      };

      const peerNodes = (data.peers || []).map(p => {
        let name = nodeNickname(p.node_id);
        if (p.source === 'h3_global') name = `H3 Global (${name})`;
        else if (p.source === 'mdns_local') name = `LAN Node (${name})`;
        return {
          id: p.node_id,
          name: name,
          role: p.role,
          status: p.status,
          latency: p.latency_ms,
          load_pct: p.load_pct ?? 0,
          tokens_per_second: p.tokens_per_second ?? 0,
          model_loaded: p.model_loaded ?? false,
          isLocal: false,
          source: p.source,
          category: 'myca',
          mycelium_score: p.mycelium_score ?? 60.0,
        };
      });

      // LAN devices (non-Myca network devices)
      const lan = (data.lan_devices || []).map(d => ({
        id: `lan_${d.ip}`,
        name: d.hostname || `Device (${d.ip})`,
        role: d.device_type,
        status: 'online',
        latency: d.latency_ms,
        load_pct: 0,
        tokens_per_second: 0,
        model_loaded: false,
        isLocal: false,
        ip: d.ip,
        mac: d.mac,
        is_myca: d.is_myca,
        category: 'lan',
      }));

      setNodes([localNode, ...peerNodes]);
      setLanDevices(lan);
      const activePeers = peerNodes.filter(n => n.status !== 'dead');
      setStatus(activePeers.length > 0 || lan.length > 0 ? 'connected' : 'single');
    } catch (e) {
      retryCountRef.current++;
      // If backend is not reachable, keep status as loading
      if (!backendOnline) {
        setStatus('loading');
        return;
      }
      // Fallback: try old /peers + /health
      try {
        const [peersRes, healthRes] = await Promise.all([
          fetch(`${backendUrl}/peers`),
          fetch(`${backendUrl}/health`),
        ]);
        if (peersRes.ok && healthRes.ok) {
          const peersData = await peersRes.json();
          const healthData = await healthRes.json();
          const myNode = {
            id: healthData.node_id, name: 'This Device', role: 'this device',
            status: 'ready', latency: 0, load_pct: 0, tokens_per_second: 0,
            model_loaded: true, isLocal: true, category: 'myca',
          };
          const peerNodes = (peersData.peers || []).map(p => {
            let name = nodeNickname(p.node_id);
            if (p.source === 'h3_global') name = `H3 Global (${name})`;
            else if (p.source === 'mdns_local') name = `LAN Node (${name})`;
            return {
              id: p.node_id, name: name, role: p.role,
              status: p.status, latency: p.latency_ms,
              load_pct: p.load_pct ?? 0, tokens_per_second: p.tokens_per_second ?? 0,
              model_loaded: p.model_loaded ?? false, isLocal: false, source: p.source,
              category: 'myca',
            };
          });
          setNodes([myNode, ...peerNodes]);
          setStatus(peerNodes.length > 0 ? 'connected' : 'single');
        }
      } catch {
        if (retryCountRef.current > 3) {
          setStatus('single');
        } else {
          setStatus('loading');
        }
      }
    }
  }, [backendOnline]);

  // WebSocket for real-time events
  useEffect(() => {
    const connectWS = () => {
      try {
        const ws = new WebSocket('ws://127.0.0.1:8420/ws');
        wsRef.current = ws;

        ws.onopen = () => {
          if (!backendOnline) setBackendOnline(true);
        };

        ws.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);
            if (event.type === 'NODE_LOAD_UPDATE') {
              setNodes(prev => prev.map(n => 
                n.id === event.node_id
                  ? { ...n, load_pct: event.load_pct, tokens_per_second: event.tokens_per_second ?? n.tokens_per_second }
                  : n
              ));
            } else if (event.type === 'NODE_READY') {
              // Backend fully booted — refetch everything
              fetchNodes();
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

    // Listen for Electron IPC 'backend-ready' event
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.on('backend-ready', () => {
          console.log('[useNodes] Backend ready signal received via IPC');
          setBackendOnline(true);
          fetchNodes();
        });
      } catch (e) {}
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const approveNode = useCallback(async (nodeId) => {
    const backendUrl = getBackendUrl();
    try {
      await fetch(`${backendUrl}/api/nodes/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId })
      });
      fetchNodes();
    } catch (e) {
      console.error('Approve failed', e);
    }
  }, [getBackendUrl, fetchNodes]);

  const declineNode = useCallback(async (nodeId) => {
    const backendUrl = getBackendUrl();
    try {
      await fetch(`${backendUrl}/api/nodes/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId })
      });
      fetchNodes();
    } catch (e) {
      console.error('Decline failed', e);
    }
  }, [getBackendUrl, fetchNodes]);

  useEffect(() => {
    fetchNodes();
    // Poll faster when backend isn't online yet
    const interval = setInterval(fetchNodes, backendOnline ? 5000 : 2000);
    return () => clearInterval(interval);
  }, [backendOnline, fetchNodes]);

  return { 
    nodes, 
    lanDevices, 
    status, 
    activeInferenceNode, 
    backendOnline, 
    pairingStatus, 
    mobileId, 
    approveNode, 
    declineNode 
  };
};
