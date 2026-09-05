import { evaluateIotexIntent } from "./_kernel.js";
import { anchorToIotex } from "./_iotex.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const { command, ioId } = req.body || {};
  if (!command) {
    res.status(400).json({ error: "Missing 'command' in request body." });
    return;
  }

  const machineIoId = ioId || "io14d29b6c4b38b2ac4a6e2bbb9c4d7c00299f1a";
  const kernelResult = evaluateIotexIntent(command);

  let settlement = null;
  if (kernelResult.status === 0) {
    settlement = await anchorToIotex({
      device: kernelResult.device,
      action: kernelResult.action,
      coil: kernelResult.coil_hex,
      value: kernelResult.action_value,
      ioId: machineIoId,
      latencyUs: kernelResult.latency_us,
      cycles: kernelResult.cycles
    });
  }

  res.status(200).json({
    success: true,
    command: command,
    kernel: kernelResult,
    settlement: settlement
  });
}
