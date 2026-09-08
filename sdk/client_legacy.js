/**
 * @myc-network/sdk (Legacy Client)
 * Core Embedded & Safe-Sign Blockchain Client for MYC Network
 */
export class MycClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || "http://localhost:4040";
    this.network = options.network || "mainnet";
  }

  async sendIntent(params = {}) {
    const { command, signer } = params;
    if (!command) throw new Error("Intent command string is required");

    const res = await fetch(`${this.endpoint}/api/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, signer })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Execution failed");
    }

    return await res.json();
  }

  async getStatus() {
    const res = await fetch(`${this.endpoint}/api/status`);
    return await res.json();
  }

  async swap(from, to, amount) {
    const res = await fetch(`${this.endpoint}/api/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, amount })
    });
    return await res.json();
  }

  async stake(amount) {
    const res = await fetch(`${this.endpoint}/api/stake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount })
    });
    return await res.json();
  }

  decodeSafeSign(intentText, kernelResult) {
    if (kernelResult.status === 0) {
      return {
        plainLanguageAction: `START Industrial ${kernelResult.device} Unit #${kernelResult.unit}`,
        actuatorCoil: kernelResult.coil,
        pinVoltage: kernelResult.voltage,
        riskLevel: "NORMAL (CONTROLLED)",
        blindSigningSuppressed: true
      };
    } else {
      return {
        plainLanguageAction: "ADVERSARIAL/INVALID INTENT BLOCKED",
        actuatorCoil: "0x0000",
        pinVoltage: "0.00V (Safe Low)",
        riskLevel: "CRITICAL (HALTED)",
        blindSigningSuppressed: true
      };
    }
  }
}
