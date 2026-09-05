/**
 * Resonance SDK - Express.js Microservice Integration Example
 * Embeds Resonance AI Engine into a secure B2B REST microservice.
 * 
 * Run with: node sdk/examples/express_integration.js
 */

import express from 'express';
import { ResonanceEngine, LicenseManager } from '../index.js';

const app = express();
app.use(express.json());

// Initialize Sovereign / Business Engine
const licenseKey = process.env.RESONANCE_LICENSE_KEY || LicenseManager.generateLicenseKey({
  tier: 'SOVEREIGN',
  expiresAt: Date.now() + 365 * 24 * 3600 * 1000,
  clientId: 'internal-enterprise'
});

const engine = new ResonanceEngine({ licenseKey });
await engine.init();

// 1. Q&A and Reasoning Endpoint (< 1ms)
app.post('/api/ask', async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await engine.ask(prompt);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Document Ingestion Endpoint
app.post('/api/ingest', async (req, res) => {
  try {
    const { data, type, title, metadata } = req.body;
    const result = await engine.ingest({ data, type, title, metadata });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Summarization Endpoint
app.post('/api/summarize', (req, res) => {
  const { page, document, mode } = req.body;
  const summary = engine.summarize({ page, document, mode });
  res.json({ summary });
});

// 4. Telemetry Endpoint
app.get('/api/telemetry', (req, res) => {
  res.json(engine.getTelemetry());
});

const PORT = process.env.PORT || 4100;
app.listen(PORT, () => {
  console.log(`📡 Resonance B2B Microservice active on http://localhost:${PORT}`);
});
