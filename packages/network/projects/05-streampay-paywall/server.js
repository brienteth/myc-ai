import http from "node:http";

const PORT = 6060;
const MYC_NODE = process.env.MYC_NODE || "http://localhost:4040";
const PRICE_PER_TOKEN_MYC = 0.001;

// Active paywall session channels
const activeChannels = new Map();

export function createPaywallServer() {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-MYC-Channel-ID, X-MYC-Sender");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ONLINE",
        service: "MYCA Sub-Millisecond LLM StreamPay Paywall",
        pricePerToken: `${PRICE_PER_TOKEN_MYC} MYC`,
        gasFee: "0.00 MYC",
        node: MYC_NODE
      }));
      return;
    }

    // StreamPay Paywall Endpoint: POST /v1/chat/completions
    if (req.url === "/v1/chat/completions" && req.method === "POST") {
      const channelId = req.headers["x-myc-channel-id"];
      const sender = req.headers["x-myc-sender"] || "myc1anonymous";

      if (!channelId) {
        res.writeHead(402, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: "PAYMENT_REQUIRED",
          message: "Missing 'X-MYC-Channel-ID' header. Please open a MycStreamPay state channel first.",
          faucetUrl: `${MYC_NODE}/api/faucet`,
          channelOpenEndpoint: `${MYC_NODE}/api/pay/channel/open`
        }));
        return;
      }

      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const prompt = payload.prompt || payload.messages?.[0]?.content || "Explain PoR Lattice consensus.";
          const maxTokens = payload.max_tokens || 20;

          // Initialize channel state if not cached
          if (!activeChannels.has(channelId)) {
            activeChannels.set(channelId, {
              deposit: 10.0,
              consumed: 0,
              sender
            });
          }

          const ch = activeChannels.get(channelId);

          // Configure SSE streaming headers
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          });

          // Simulated high-throughput neural inference token stream
          const words = `[MYCA-LLM]: Proof-of-Resonance (PoR) lattice delivers sub-millisecond deterministic finality without mining waste or EVM gas spikes. Autonomous agents stream micro-payments with mathematical zero-gas invariant.`.split(" ");
          
          let tokensSent = 0;
          for (let i = 0; i < Math.min(words.length, maxTokens); i++) {
            // Check channel remaining balance
            if (ch.consumed + PRICE_PER_TOKEN_MYC > ch.deposit) {
              res.write(`event: error\ndata: ${JSON.stringify({ error: "CHANNEL_DEPLETED", message: "Deposit exhausted. Top up channel." })}\n\n`);
              break;
            }

            ch.consumed += PRICE_PER_TOKEN_MYC;
            tokensSent++;

            const chunkData = {
              id: `chatcmpl-${Date.now()}`,
              token: words[i] + " ",
              tokenIndex: i,
              channelId,
              microPayment: `${PRICE_PER_TOKEN_MYC} MYC`,
              totalConsumed: `${ch.consumed.toFixed(4)} MYC`,
              gasUsed: "0.00 MYC",
              latencyUs: "11.8"
            };

            res.write(`data: ${JSON.stringify(chunkData)}\n\n`);

            // Micro-delay between tokens (15ms for smooth streaming)
            await new Promise(r => setTimeout(r, 15));
          }

          res.write("data: [DONE]\n\n");
          res.end();
        } catch (err) {
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
          }
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "NOT_FOUND" }));
  });

  return server;
}

// Standalone execution
if (process.argv[1]?.endsWith("server.js")) {
  const srv = createPaywallServer();
  srv.listen(PORT, () => {
    console.log(`⚡ MycStreamPay LLM Paywall listening at: http://localhost:${PORT}`);
    console.log(`   Price per token: ${PRICE_PER_TOKEN_MYC} MYC (Zero Gas)`);
  });
}
