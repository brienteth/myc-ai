// ============================================================================
// OPACUS KERNEL WALLET + MYCA DUAL-POR ESCROW ADAPTER
// Unified Multi-Rail Payment Settlement: Fiat (MoonPay/Transak),
// Multichain Crypto (40+ Chains / Khalani), Native 0G (x402) -> USDC
// ============================================================================

export const OPACUS_PAYMENT_RAILS = {
  FIAT: 'MoonPay / Transak (Credit Card, Apple Pay, SEPA)',
  MULTICHAIN: '40+ Chains (Arbitrum, Base, Ethereum, Solana, Polygon via Khalani)',
  NATIVE_0G: 'Native 0G / x402 Compute Liquidity Rail'
};

export const MYC_ESCROW_BRIDGE_ADDRESS = 'myc1c4e6f0a1897130608866b20c8476163c';

export class OpacusKernelWalletBridge {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:4040';
    this.mycEscrowAddress = options.escrowAddress || MYC_ESCROW_BRIDGE_ADDRESS;
  }

  /**
   * 1. Query Unified Opacus Compute Balance (Aggregated across 3 rails)
   */
  async getBalance() {
    const res = await fetch(`${this.baseUrl}/api/opacus/balance`);
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch Opacus compute balance');
    }
    return {
      balanceUsdc: data.balanceUsdc,
      activeRails: data.rails,
      opacusWalletAddress: data.address,
      status: data.status
    };
  }

  /**
   * 2. Integration 1 & 2: Fund MYC Task Escrow using Opacus Compute Balance
   * Seamless 1-step flow: Opacus USDC -> MYC Escrow Lock -> Colony Task Execution
   */
  async fundTaskFromOpacus(taskId, amountUsdc, senderAddress = 'myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002') {
    const amt = parseFloat(amountUsdc);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('Invalid USDC amount for Opacus task funding');
    }

    // Call server endpoint that atomically validates Opacus compute balance
    // and locks Dual-PoR Escrow on Chain ID 108
    const res = await fetch(`${this.baseUrl}/api/opacus/fund-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: taskId,
        amountUsdc: amt,
        sender: senderAddress,
        memo: `task:${taskId}`
      })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Opacus funding failed');
    }

    return {
      success: true,
      taskId: taskId,
      escrowId: data.escrowId,
      amountUsdc: amt,
      opacusTxHash: data.opacusTxHash,
      dagVertex: data.dagVertex,
      escrowStatus: 'ESCROW_FUNDED_VIA_OPACUS',
      gasFee: '0.00 MYC',
      timestamp: data.timestamp
    };
  }

  /**
   * 3. Integration 3: StreamPay Sub-Millisecond Token Micropayment
   * As AI tokens are delivered, micro-payment settlement occurs to nodeAddress
   */
  async payWithOpacusPayStream(channelId, tokenCount, pricePerToken, nodeAddress) {
    const microAmount = parseFloat((tokenCount * pricePerToken).toFixed(6));
    const minThreshold = 0.01; // 0.01 USDC minimum batch settlement

    if (microAmount < minThreshold) {
      return { status: 'PENDING_ACCUMULATION', currentAccrued: microAmount };
    }

    const res = await fetch(`${this.baseUrl}/api/opacus/fund-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: `stream-${channelId}`,
        amountUsdc: microAmount,
        recipient: nodeAddress,
        memo: `stream:${channelId}:${tokenCount}tokens`
      })
    });

    return await res.json();
  }

  /**
   * 4. Integration 4: Machine / Node Economy -> Withdraw to Opacus on Base (EVM 8453)
   * DePIN machine earnings bridged back to Base USDC / Opacus wallet
   */
  async withdrawEarningsToOpacus(amountUsdc, recipientEvmAddress, machineId = 'depin-device-01') {
    const amt = parseFloat(amountUsdc);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('Invalid withdrawal amount');
    }

    const res = await fetch(`${this.baseUrl}/api/opacus/withdraw-earnings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineId: machineId,
        amountUsdc: amt,
        targetChain: 'BASE',
        recipientEvmAddress: recipientEvmAddress
      })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Withdrawal to Opacus Base failed');
    }

    return {
      success: true,
      amountUsdc: amt,
      targetChain: 'BASE (8453)',
      recipient: recipientEvmAddress,
      bridgeProofId: data.bridgeProofId,
      status: 'WITHDRAWAL_SUBMITTED_TO_BASE'
    };
  }
}

// Convenient exportable standalone functions
export async function fundTaskFromOpacus(taskId, amountUsdc, sender) {
  const bridge = new OpacusKernelWalletBridge();
  return bridge.fundTaskFromOpacus(taskId, amountUsdc, sender);
}

export async function withdrawToOpacus(amountUsdc, recipientEvmAddress, machineId) {
  const bridge = new OpacusKernelWalletBridge();
  return bridge.withdrawEarningsToOpacus(amountUsdc, recipientEvmAddress, machineId);
}

export async function getOpacusComputeBalance() {
  const bridge = new OpacusKernelWalletBridge();
  return bridge.getBalance();
}
