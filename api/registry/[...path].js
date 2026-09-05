// Vercel Serverless Function for Opacus H3 Signaling (In-Memory fallback with approval)
let _h3_agents = {};
let _h3_signals = {};

export default function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url, method } = req;
  const now = Date.now();
  const parsedUrl = new URL(url, 'http://localhost');

  // Route: /api/registry/register (POST)
  if (parsedUrl.pathname.endsWith('/api/registry/register') && method === 'POST') {
    try {
      const body = req.body || {};
      const node_id = body.node_id || 'node-' + Math.random().toString(36).substring(2, 8);
      body.last_seen = now;
      
      // Preserve existing status if it exists (e.g. if already approved/declined)
      const existing = _h3_agents[node_id];
      if (existing) {
        body.status = existing.status || body.status || 'ready';
      } else {
        body.status = body.role === 'mobile_web' ? 'pending' : 'ready';
      }
      
      _h3_agents[node_id] = body;
      return res.status(200).json({ status: body.status, node_id: node_id });
    } catch (e) {
      return res.status(400).json({ error: e.toString() });
    }
  }

  // Route: /api/registry/agents (GET)
  if (parsedUrl.pathname.endsWith('/api/registry/agents') && method === 'GET') {
    // Filter active agents (last 120 seconds)
    const active_agents = Object.values(_h3_agents).filter(
      (agent) => now - (agent.last_seen || 0) < 120000
    );
    return res.status(200).json({ agents: active_agents, total: active_agents.length });
  }

  // Route: /api/registry/status (GET)
  if (parsedUrl.pathname.endsWith('/api/registry/status') && method === 'GET') {
    const node_id = parsedUrl.searchParams.get('node_id');
    if (!node_id) {
      return res.status(400).json({ error: 'Missing node_id parameter' });
    }
    const agent = _h3_agents[node_id];
    if (!agent) {
      return res.status(200).json({ status: 'not_found' });
    }
    // Update heartbeat on status query
    agent.last_seen = now;
    return res.status(200).json({ status: agent.status });
  }

  // ── Pairing Endpoints for Colony Mesh (Cloud & Mobile Sync) ──
  const UNAMBIGUOUS_PAIR_CHARS = "2346789ACDEFGHJKLMNPQRTUVWXYZ";

  if (!_h3_agents._active_pair_session) {
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += UNAMBIGUOUS_PAIR_CHARS.charAt(Math.floor(Math.random() * UNAMBIGUOUS_PAIR_CHARS.length));
    }
    _h3_agents._active_pair_session = {
      session_id: "ps_" + Math.random().toString(36).substring(2, 14),
      host_node_id: "myca-host",
      security_code: code,
      challenge: Math.random().toString(36).substring(2, 18),
      created_at: now,
      expires_at: now + 600000,
      status: "WAITING",
      requesting_node_id: null,
      requesting_device_name: null
    };
  }

  // Route: /api/registry/pair/session (GET or POST)
  if (parsedUrl.pathname.includes('/api/registry/pair/session')) {
    const session = _h3_agents._active_pair_session;
    if (session.expires_at < now) {
      let code = "";
      for (let i = 0; i < 4; i++) {
        code += UNAMBIGUOUS_PAIR_CHARS.charAt(Math.floor(Math.random() * UNAMBIGUOUS_PAIR_CHARS.length));
      }
      session.session_id = "ps_" + Math.random().toString(36).substring(2, 14);
      session.security_code = code;
      session.expires_at = now + 600000;
      session.status = "WAITING";
      session.requesting_node_id = null;
    }
    // Allow host to set the active security_code / session
    if (method === 'POST') {
      const body = req.body || {};
      if (body.security_code) session.security_code = body.security_code;
      if (body.session_id) session.session_id = body.session_id;
      if (body.host_node_id) session.host_node_id = body.host_node_id;
    }
    return res.status(200).json(session);
  }

  // Route: /api/registry/pair/request (POST)
  if (parsedUrl.pathname.includes('/api/registry/pair/request') && method === 'POST') {
    const body = req.body || {};
    const session = _h3_agents._active_pair_session;
    session.requesting_node_id = body.node_id || "mobile-client";
    session.requesting_device_name = body.device_name || "Mobile Device";
    session.requesting_pubkey = body.public_key || "";
    session.status = "REQUESTED";

    // Also register the node in _h3_agents
    _h3_agents[body.node_id] = {
      node_id: body.node_id,
      public_key: body.public_key || "",
      device_name: body.device_name || "Remote Device",
      device_type: body.device_type || "mobile",
      capabilities: body.capabilities || [],
      role: body.device_type === 'tablet' ? 'tablet_web' : 'mobile_web',
      status: 'pending',
      code: session.security_code,
      security_code: session.security_code,
      last_seen: now
    };

    return res.status(200).json({
      status: "pending",
      session_id: session.session_id,
      code: session.security_code,
      security_code: session.security_code,
      challenge: session.challenge,
      expires_at: session.expires_at
    });
  }

  // Route: /api/registry/pair/verify (POST)
  if (parsedUrl.pathname.includes('/api/registry/pair/verify') && method === 'POST') {
    const body = req.body || {};
    const session = _h3_agents._active_pair_session;
    const node_id = body.node_id;
    const agent = _h3_agents[node_id];

    if (session.status === "APPROVED" || (agent && agent.status === "approved")) {
      return res.status(200).json({ status: "approved", message: "Device paired successfully" });
    }
    if (session.status === "DECLINED" || (agent && agent.status === "declined")) {
      return res.status(200).json({ status: "declined", message: "Pairing declined" });
    }
    return res.status(200).json({ status: "pending" });
  }

  // Route: /api/registry/approve (POST) or /api/registry/pair/approve (POST)
  if ((parsedUrl.pathname.endsWith('/api/registry/approve') || parsedUrl.pathname.endsWith('/api/registry/pair/approve')) && method === 'POST') {
    const body = req.body || {};
    const node_id = body.node_id;
    if (_h3_agents._active_pair_session) {
      _h3_agents._active_pair_session.status = "APPROVED";
    }
    if (node_id && _h3_agents[node_id]) {
      _h3_agents[node_id].status = 'approved';
      _h3_agents[node_id].last_seen = now;
      return res.status(200).json({ status: 'approved', node_id });
    }
    if (node_id) {
      _h3_agents[node_id] = {
        node_id,
        role: 'mobile_web',
        status: 'approved',
        last_seen: now
      };
      return res.status(200).json({ status: 'approved', node_id });
    }
    return res.status(200).json({ status: 'approved' });
  }

  // Route: /api/registry/decline (POST) or /api/registry/pair/decline (POST)
  if ((parsedUrl.pathname.endsWith('/api/registry/decline') || parsedUrl.pathname.endsWith('/api/registry/pair/decline')) && method === 'POST') {
    const body = req.body || {};
    const node_id = body.node_id;
    if (_h3_agents._active_pair_session) {
      _h3_agents._active_pair_session.status = "DECLINED";
    }
    if (node_id && _h3_agents[node_id]) {
      _h3_agents[node_id].status = 'declined';
      _h3_agents[node_id].last_seen = now;
    }
    return res.status(200).json({ status: 'declined', node_id });
  }

  // Route: /api/learning/sync (POST)
  if (parsedUrl.pathname.endsWith('/api/learning/sync') && method === 'POST') {
    const body = req.body || {};
    const updates = body.updates || [];
    console.log(`[Vercel Federated Aggregator] Accepted ${updates.length} federated learning updates.`);
    return res.status(200).json({ status: 'success', synced: updates.length });
  }

  // Fallback 404
  return res.status(404).json({ error: 'Endpoint not found in H3 Serverless Registry', path: parsedUrl.pathname });
}
