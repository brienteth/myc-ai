import test from "node:test";
import assert from "node:assert";
import http from "http";
import crypto from "crypto";
import { MycaSDK } from "../sdk/index.js";
import { MycContract } from "../sdk/contract.js";
import { globalCapabilityRegistry } from "../colony/scheduler/capability_registry.js";
import { globalEventBus } from "../core/events/event_bus.js";

test("Platform Blockchain: User Contract Deployment & Invocation Suite", async (t) => {
  const sdk = new MycaSDK({
    node: "http://localhost:4040",
    wsUrl: "ws://localhost:4041"
  });

  // Sample ERC20-like token ABI
  const sampleTokenAbi = [
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "string" }] },
    { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "string" }, { name: "amount", type: "number" }] },
    { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "string" }, { name: "amount", type: "number" }] }
  ];

  let deployedAddress = "";

  await t.test("1. Should deploy custom user contract via REST POST /api/contract/deploy", async () => {
    const postData = JSON.stringify({
      name: "AgriToken",
      abi: sampleTokenAbi,
      bytecode: "0x608060405234801561001057600080fd5b50",
      constructorArgs: [100000, "AGRI"],
      deployerAddress: "myc1agridev000000000000000000000000"
    });

    const res = await new Promise((resolve, reject) => {
      const req = http.request("http://localhost:4040/api/contract/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on("error", reject);
      req.write(postData);
      req.end();
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.contractAddress.startsWith("myc1c"));
    assert.ok(res.body.transactionHash.startsWith("0x"));
    assert.strictEqual(res.body.zeroGas, true);

    deployedAddress = res.body.contractAddress;
  });

  await t.test("2. Should deploy custom user contract via JSON-RPC myc_deployUserContract", async () => {
    const rpcPayload = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "myc_deployUserContract",
      params: [{
        name: "SolarPowerBond",
        abi: sampleTokenAbi,
        constructorArgs: [500000, "SOLAR"],
        deployerAddress: sdk.address
      }]
    });

    const res = await new Promise((resolve, reject) => {
      const req = http.request("http://localhost:4040/api/rpc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(rpcPayload)
        }
      }, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve(JSON.parse(data)));
      });
      req.on("error", reject);
      req.write(rpcPayload);
      req.end();
    });

    assert.strictEqual(res.jsonrpc, "2.0");
    assert.ok(res.result.success);
    assert.ok(res.result.contractAddress.startsWith("myc1c"));
    assert.strictEqual(res.result.name, "SolarPowerBond");
  });

  await t.test("3. Should call read-only method on deployed user contract via RPC myc_callContract", async () => {
    const rpcPayload = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "myc_callContract",
      params: [{
        address: deployedAddress,
        method: "balanceOf",
        args: ["myc1agridev000000000000000000000000"]
      }]
    });

    const res = await new Promise((resolve, reject) => {
      const req = http.request("http://localhost:4040/api/rpc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(rpcPayload)
        }
      }, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve(JSON.parse(data)));
      });
      req.on("error", reject);
      req.write(rpcPayload);
      req.end();
    });

    assert.strictEqual(res.result, 100000);
  });

  await t.test("4. Should execute state-changing transaction on user contract with zero gas via myc_sendTransaction", async () => {
    const recipient = "myc1recipient000000000000000000000";
    const rpcPayload = JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "myc_sendTransaction",
      params: [{
        from: "myc1agridev000000000000000000000000",
        to: deployedAddress,
        method: "transfer",
        args: [recipient, 2500]
      }]
    });

    const res = await new Promise((resolve, reject) => {
      const req = http.request("http://localhost:4040/api/rpc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(rpcPayload)
        }
      }, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve(JSON.parse(data)));
      });
      req.on("error", reject);
      req.write(rpcPayload);
      req.end();
    });

    assert.ok(res.result.success);
    assert.strictEqual(res.result.gasUsed, "0.00 MYC");
    assert.strictEqual(res.result.logs.length, 1);
    assert.strictEqual(res.result.logs[0].event, "Transfer");

    // Verify recipient balance
    const verifyPayload = JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "myc_callContract",
      params: [{
        address: deployedAddress,
        method: "balanceOf",
        args: [recipient]
      }]
    });

    const verifyRes = await new Promise((resolve, reject) => {
      const req = http.request("http://localhost:4040/api/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(verifyPayload) }
      }, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve(JSON.parse(data)));
      });
      req.on("error", reject);
      req.write(verifyPayload);
      req.end();
    });

    assert.strictEqual(verifyRes.result, 2500);
  });

  await t.test("5. Should support SDK MycContract wrapper for deployment, calling and sending", async () => {
    const contractInstance = new MycContract(sampleTokenAbi, deployedAddress, sdk);
    assert.strictEqual(typeof contractInstance.balanceOf, "function");
    assert.strictEqual(typeof contractInstance.transfer, "function");

    // Query balance through SDK
    const balance = await contractInstance.balanceOf("myc1agridev000000000000000000000000");
    assert.strictEqual(balance, 97500); // 100,000 - 2,500 transferred
  });

  await t.test("6. Should register external AI / DePIN capability on Colony Capability Marketplace", async () => {
    const regRes = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        name: "protein_folding",
        minVramMb: 40000,
        pricePerTask: 5,
        priceAsset: "USDC",
        description: "AlphaFold 3 Biomolecular structure prediction"
      });

      const req = http.request("http://localhost:4040/api/capability/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) }
      }, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on("error", reject);
      req.write(postData);
      req.end();
    });

    assert.strictEqual(regRes.status, 200);
    assert.strictEqual(regRes.body.name, "protein_folding");
    assert.strictEqual(regRes.body.pricePerTask, 5);

    // Query capability list
    const listRes = await new Promise((resolve, reject) => {
      http.get("http://localhost:4040/api/capabilities", (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve(JSON.parse(data)));
      }).on("error", reject);
    });

    assert.ok(listRes.capabilities.some(c => c.name === "protein_folding"));
  });

  await t.test("7. Should register DePIN IoT device with Silicon PUF authentication and 0-byte shield", () => {
    const device = sdk.registerDevice({
      did: "did:myc:turbine_sensor_09",
      pufKey: "PUF_SILICON_KEY_998822",
      type: "WIND_TURBINE_TELEMETRY",
      capabilities: ["DATA_FEED_TELEMETRY", "WIND_VELOCITY_PREDICTION"]
    });

    assert.strictEqual(device.success, true);
    assert.strictEqual(device.did, "did:myc:turbine_sensor_09");
    assert.strictEqual(device.protectedBy, "0-BYTE-NEGATION-SHIELD");
  });

  await t.test("8. Should stream real-time events via Event Bus and SSE endpoint", async () => {
    let receivedEvent = null;

    const sseReq = http.get("http://localhost:4040/api/events", (res) => {
      res.on("data", chunk => {
        const text = chunk.toString();
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data:")) {
            try {
              const jsonStr = line.replace(/^data:\s*/, "").trim();
              const data = JSON.parse(jsonStr);
              if (data.topic === "colony:capability:registered" && data.payload?.name === "satellite_radar_lidar") {
                receivedEvent = data;
                sseReq.destroy();
              }
            } catch (e) {}
          }
        }
      });
    });

    // Wait 50ms for SSE stream to open
    await new Promise(r => setTimeout(r, 60));

    // Trigger capability registration on server, which fires globalEventBus.emitEvent on server
    const postData = JSON.stringify({
      name: "satellite_radar_lidar",
      minVramMb: 32000,
      pricePerTask: 2.5,
      priceAsset: "USDC"
    });

    await new Promise((resolve, reject) => {
      const triggerReq = http.request("http://localhost:4040/api/capability/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) }
      }, (res) => {
        let d = "";
        res.on("data", c => d += c);
        res.on("end", resolve);
      });
      triggerReq.on("error", reject);
      triggerReq.write(postData);
      triggerReq.end();
    });

    // Wait for SSE stream reception
    await new Promise(r => setTimeout(r, 120));
    assert.ok(receivedEvent !== null, "SSE event should be received from server event stream");
    assert.strictEqual(receivedEvent.payload.name, "satellite_radar_lidar");
  });
});
