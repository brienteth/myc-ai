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
  const [pairingCode, setPairingCode] = useState(null);
  const wsRef = useRef(null);
  const retryCountRef = useRef(0);
  const backendOnlineRef = useRef(false);

  // Keep ref in sync so callbacks never read stale state
  useEffect(() => { backendOnlineRef.current = backendOnline; }, [backendOnline]);

  const getBackendUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const hostParam = params.get('host');
    if (hostParam) return `http://${hostParam}:8420`;
    
    try {
      const storedIp = localStorage.getItem('myca_desktop_ip');
      if (storedIp) return `http://${storedIp}:8420`;
    } catch (e) {}
    
    const isElectron = /Electron/i.test(navigator.userAgent);
    const isFileProtocol = window.location.protocol === 'file:';
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalHost || isElectron || isFileProtocol || !window.location.hostname) {
      return 'http://127.0.0.1:8420';
    }
    return window.location.origin;
  }, []);

  // ── Cryptographic helper functions (WebCrypto Ed25519) ──
  const bufToHex = useCallback((buffer) => {
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }, []);

  const hexToBuf = useCallback((hex) => {
    return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  }, []);

  const getOrCreateBrowserIdentity = useCallback(async () => {
    try {
      let pubHex = localStorage.getItem('myca_node_pubkey');
      let privHex = localStorage.getItem('myca_node_privkey');
      let nodeId = localStorage.getItem('myca_node_id');

      if (pubHex && privHex && nodeId) {
        return { pubHex, privHex, nodeId };
      }

      const keyPair = await window.crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify']
      );

      const rawPubKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
      const pkcs8PrivKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

      pubHex = bufToHex(rawPubKey);
      privHex = bufToHex(pkcs8PrivKey);
      nodeId = 'm_' + pubHex.substring(0, 12);

      localStorage.setItem('myca_node_pubkey', pubHex);
      localStorage.setItem('myca_node_privkey', privHex);
      localStorage.setItem('myca_node_id', nodeId);

      return { pubHex, privHex, nodeId };
    } catch (e) {
      console.error('Failed to initialize WebCrypto identity:', e);
      const fallbackId = 'm_' + Math.random().toString(36).substring(2, 14);
      return { pubHex: 'mock_pubkey', privHex: 'mock_privkey', nodeId: fallbackId };
    }
  }, [bufToHex]);

  const signChallengeBytes = useCallback(async (privHex, challenge) => {
    try {
      const privKeyBytes = hexToBuf(privHex);
      const privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        privKeyBytes,
        { name: 'Ed25519' },
        true,
        ['sign']
      );
      const encoder = new TextEncoder();
      const sig = await window.crypto.subtle.sign(
        { name: 'Ed25519' },
        privateKey,
        encoder.encode(challenge)
      );
      return bufToHex(sig);
    } catch (e) {
      console.error('Signature failed:', e);
      return 'mock_signature';
    }
  }, [hexToBuf, bufToHex]);

  // ── Remote client pairing ──
  useEffect(() => {
    const isElectron = /Electron/i.test(navigator.userAgent);
    const isFileProtocol = window.location.protocol === 'file:';
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHostApp = isElectron || isFileProtocol || isLocalHost || !window.location.hostname;
    const isRemoteClient = !isHostApp;

    if (isRemoteClient) {
      let isCancelled = false;
      let interval = null;

      const runPairing = async () => {
        setPairingStatus('pending');
        const identity = await getOrCreateBrowserIdentity();
        if (isCancelled) return;
        setMobileId(identity.nodeId);

        const backendUrl = getBackendUrl();
        const payload = {
          node_id: identity.nodeId,
          public_key: identity.pubHex,
          device_name: navigator.userAgent.includes('Mobile') ? 'Mobile Phone' : 'Web Client',
          device_type: navigator.userAgent.includes('Mobile') ? 'mobile' : 'laptop',
          capabilities: ['inference', 'webgpu', 'sensors']
        };

        try {
          const res = await fetch(`${backendUrl}/api/registry/pair/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('Request rejected');
          const data = await res.json();
          if (isCancelled) return;
          if (data.code) setPairingCode(data.code);

          // Reconnecting auth
          if (data.status === 'reconnecting') {
            const timestamp = (Date.now() / 1000).toString();
            const signatureRec = await signChallengeBytes(identity.privHex, timestamp);
            const authRes = await fetch(`${backendUrl}/api/registry/pair/reconnect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                node_id: identity.nodeId,
                timestamp: parseFloat(timestamp),
                signature: signatureRec
              })
            });
            if (authRes.ok) {
              setPairingStatus('approved');
              return;
            }
          }

          // Generate or get desktop challenge
          const desktopChallenge = data.challenge;

          // Start polling verify status
          interval = setInterval(async () => {
            if (isCancelled) {
              clearInterval(interval);
              return;
            }
            try {
              const clientSignature = await signChallengeBytes(identity.privHex, desktopChallenge);
              const verifyRes = await fetch(`${backendUrl}/api/registry/pair/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  node_id: identity.nodeId,
                  signature: clientSignature
                })
              });
              if (verifyRes.ok) {
                const verifyData = await verifyRes.json();
                if (verifyData.status === 'approved') {
                  setPairingStatus('approved');
                  clearInterval(interval);
                } else if (verifyData.status === 'declined') {
                  setPairingStatus('declined');
                  clearInterval(interval);
                }
              }
            } catch (e) {
              console.error('Verify poll failed:', e);
            }
          }, 3000);
        } catch (err) {
          console.error('Pair request failed:', err);
          setPairingStatus('declined');
        }
      };

      runPairing();
      return () => {
        isCancelled = true;
        if (interval) clearInterval(interval);
      };
    }
  }, [getBackendUrl, getOrCreateBrowserIdentity, signChallengeBytes]);

  // ── Core data fetcher — uses refs, never stale ──
  const fetchNodes = useCallback(async () => {
    const backendUrl = getBackendUrl();
    try {
      const res = await fetch(`${backendUrl}/nodes/status`);
      if (!res.ok) throw new Error('not ok');
      const data = await res.json();

      if (!backendOnlineRef.current) {
        setBackendOnline(true);
        backendOnlineRef.current = true;
      }
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
        let name = p.device_name || nodeNickname(p.node_id);
        if (p.source === 'h3_global') name = `H3 Global (${name})`;
        else if (p.source === 'mdns_local') name = `LAN Node (${name})`;
        else if (p.source === 'trusted_db') name = `${name}`;
        
        return {
          id: p.node_id,
          name,
          role: p.role,
          status: p.status,
          latency: p.latency_ms || 0,
          load_pct: p.load_pct ?? 0,
          tokens_per_second: p.tokens_per_second ?? 0,
          model_loaded: p.model_loaded ?? false,
          isLocal: false,
          source: p.source,
          category: 'myca',
          mycelium_score: p.mycelium_score ?? 60.0,
          code: p.code,
          fingerprint: p.fingerprint
        };
      });

      // LAN devices (non-Myca network devices)
      const lan = (data.lan_devices || []).map(d => ({
        id: `lan_${d.ip}`,
        name: d.hostname || `Device (${d.ip})`,
        role: d.device_type || 'unknown',
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
      if (!backendOnlineRef.current) {
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
              id: p.node_id, name, role: p.role,
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
  }, [getBackendUrl]); // NO backendOnline dependency — uses ref instead

  // ── WebSocket for real-time events ──
  useEffect(() => {
    const backendUrl = getBackendUrl();
    const wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws';

    const connectWS = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!backendOnlineRef.current) {
            setBackendOnline(true);
            backendOnlineRef.current = true;
          }
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
              fetchNodes();
            } else if (event.type === 'LAN_SCAN_COMPLETE') {
              fetchNodes(); // Refresh when LAN scan finishes
            }
          } catch (err) {}
        };

        ws.onerror = () => {};
        ws.onclose = () => {
          setTimeout(connectWS, 3000);
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
          backendOnlineRef.current = true;
          fetchNodes();
        });
      } catch (e) {}
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchNodes, getBackendUrl]);

  const approveNode = useCallback(async (nodeId) => {
    const backendUrl = getBackendUrl();
    try {
      await fetch(`${backendUrl}/api/registry/pair/approve`, {
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
      await fetch(`${backendUrl}/api/registry/pair/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId })
      });
      fetchNodes();
    } catch (e) {
      console.error('Decline failed', e);
    }
  }, [getBackendUrl, fetchNodes]);

  const revokeNode = useCallback(async (nodeId) => {
    const backendUrl = getBackendUrl();
    try {
      await fetch(`${backendUrl}/api/nodes/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId })
      });
      fetchNodes();
    } catch (e) {
      console.error('Revoke failed', e);
    }
  }, [getBackendUrl, fetchNodes]);

  // ── Polling loop ──
  useEffect(() => {
    fetchNodes();
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
    pairingCode,
    approveNode, 
    declineNode,
    revokeNode
  };
};
