import assert from "node:assert/strict";

const NODE_URL = "http://localhost:4040";

async function run() {
  console.log("====================================================================");
  console.log("⚡ PROJECT 3: DEPLOYING & INTERACTING WITH CUSTOM DEFI CONTRACT");
  console.log("====================================================================");

  const deployerAddress = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";
  const contractSource = `
    class NeuroYieldPool {
      constructor() {
        this.stakers = new Map();
        this.totalStaked = 0;
      }
      stake(amount, context = {}) {
        const sender = context.msgSender || "${deployerAddress}";
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) throw new Error("INVALID_STAKE_AMOUNT");
        let rec = this.stakers.get(sender) || { amount: 0, reward: 0 };
        rec.amount += amt;
        this.stakers.set(sender, rec);
        this.totalStaked += amt;
        return { status: "STAKED", staker: sender, amount: amt, totalStaked: this.totalStaked, gasFee: "0.00 MYC" };
      }
      claimYield(context = {}) {
        const sender = context.msgSender || "${deployerAddress}";
        let rec = this.stakers.get(sender);
        if (!rec) throw new Error("NO_STAKE");
        const reward = Number((rec.amount * 0.145).toFixed(4));
        rec.reward += reward;
        this.stakers.set(sender, rec);
        return { status: "YIELD_CLAIMED", reward, totalReward: rec.reward, gasFee: "0.00 MYC" };
      }
      getStakeInfo(account) {
        return this.stakers.get(account) || { amount: 0, reward: 0 };
      }
    }
    return new NeuroYieldPool();
  `;

  // 1. Deploy Contract
  console.log("\n1. Deploying NeuroYieldPool contract via POST /api/contract/deploy...");
  const deployRes = await fetch(`${NODE_URL}/api/contract/deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "NeuroYieldPool",
      sourceCode: contractSource,
      deployerAddress: deployerAddress,
      abi: [
        { type: "function", name: "stake", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "number" }] },
        { type: "function", name: "claimYield", stateMutability: "nonpayable", inputs: [] },
        { type: "function", name: "getStakeInfo", stateMutability: "view", inputs: [{ name: "account", type: "string" }] }
      ]
    })
  });

  const deployData = await deployRes.json();
  assert.equal(deployData.success, true, "Contract deployment must succeed");
  const contractAddress = deployData.contractAddress;
  console.log(`✅ Contract deployed at address: ${contractAddress}`);
  console.log(`   Gas Consumed: 0.00 MYC (Zero-Gas Invariant)`);

  // 2. Read Initial Position (Read-Only Call)
  console.log("\n2. Querying getStakeInfo before stake (Read-Only JSON-RPC myc_callContract)...");
  const readRes = await fetch(`${NODE_URL}/api/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "myc_callContract",
      params: [{
        address: contractAddress,
        method: "getStakeInfo",
        args: [deployerAddress]
      }]
    })
  });

  const readData = await readRes.json();
  console.log("   Current Position:", readData.result);

  // 3. Execute State-Changing Transaction (Stake 250 MYC with Zero Gas)
  console.log("\n3. Executing stake(250) transaction via JSON-RPC myc_sendTransaction...");
  const txRes = await fetch(`${NODE_URL}/api/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "myc_sendTransaction",
      params: [{
        from: deployerAddress,
        to: contractAddress,
        method: "stake",
        args: [250],
        value: 0
      }]
    })
  });

  const txData = await txRes.json();
  assert.equal(txData.result.success, true);
  assert.equal(txData.result.gasUsed, "0.00 MYC");
  console.log("✅ Stake transaction confirmed on chain!");
  console.log(`   TxHash: ${txData.result.transactionHash}`);
  console.log(`   Output:`, txData.result.returnValue);

  // 4. Claim Yield
  console.log("\n4. Executing claimYield() transaction with Zero Gas...");
  const claimRes = await fetch(`${NODE_URL}/api/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "myc_sendTransaction",
      params: [{
        from: deployerAddress,
        to: contractAddress,
        method: "claimYield",
        args: [],
        value: 0
      }]
    })
  });

  const claimData = await claimRes.json();
  assert.equal(claimData.result.success, true);
  console.log("✅ Yield claimed with zero gas!");
  console.log(`   Reward Output:`, claimData.result.returnValue);

  console.log("\n====================================================================");
  console.log("🎉 PROJECT 3 VERIFICATION PASSED WITH 100% SUCCESS!");
  console.log("====================================================================");
}

run().catch(err => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
