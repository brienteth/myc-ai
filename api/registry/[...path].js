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

  // Route: /api/registry/approve (POST)
  if (parsedUrl.pathname.endsWith('/api/registry/approve') && method === 'POST') {
    const body = req.body || {};
    const node_id = body.node_id;
    if (!node_id) {
      return res.status(400).json({ error: 'Missing node_id in body' });
    }
    if (_h3_agents[node_id]) {
      _h3_agents[node_id].status = 'approved';
      _h3_agents[node_id].last_seen = now;
      return res.status(200).json({ status: 'approved', node_id });
    }
    // If not registered yet, pre-approve it
    _h3_agents[node_id] = {
      node_id,
      role: 'mobile_web',
      status: 'approved',
      last_seen: now
    };
    return res.status(200).json({ status: 'approved', node_id });
  }

  // Route: /api/registry/decline (POST)
  if (parsedUrl.pathname.endsWith('/api/registry/decline') && method === 'POST') {
    const body = req.body || {};
    const node_id = body.node_id;
    if (!node_id) {
      return res.status(400).json({ error: 'Missing node_id in body' });
    }
    if (_h3_agents[node_id]) {
      _h3_agents[node_id].status = 'declined';
      _h3_agents[node_id].last_seen = now;
    }
    return res.status(200).json({ status: 'declined', node_id });
  }

  // Fallback 404
  return res.status(404).json({ error: 'Endpoint not found in H3 Serverless Registry', path: parsedUrl.pathname });
}
