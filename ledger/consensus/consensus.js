import crypto from "crypto";

/**
 * MYC Standalone Consensus Engine
 * 
 * Invariant §1.1: Consensus != PoR
 * Consensus answers: "Which block/state is canonical?"
 * Responsibilities:
 *  - Validator set management
 *  - Deterministic round-robin / stake-weighted leader selection
 *  - Block proposal validation
 *  - State transition validation
 *  - Fork handling & finality
 */
export class MycConsensusEngine {
  constructor({ minValidators = 1, epochBlocks = 100 } = {}) {
    this.validators = new Map(); // address -> { address, stake, votingPower, isActive }
    this.minValidators = minValidators;
    this.epochBlocks = epochBlocks;
    this.currentEpoch = 0;
    this.currentLeaderIndex = 0;
    this.finalizedBlockNumber = 0;
    this.finalizedBlockHash = "0x" + "0".repeat(64);
  }

  registerValidator(address, stake = 1000) {
    const addr = address.toLowerCase();
    this.validators.set(addr, {
      address: addr,
      stake: parseFloat(stake) || 1000,
      votingPower: Math.floor((parseFloat(stake) || 1000) / 1000),
      isActive: true,
      lastBlockProposed: -1
    });
  }

  deregisterValidator(address) {
    this.validators.delete(address.toLowerCase());
  }

  getActiveValidators() {
    return Array.from(this.validators.values())
      .filter(v => v.isActive)
      .sort((a, b) => a.address.localeCompare(b.address));
  }

  selectBlockProposer(blockNumber) {
    const active = this.getActiveValidators();
    if (active.length === 0) {
      return "myc100000000000000000000000000000000"; // Default genesis proposer
    }
    const idx = blockNumber % active.length;
    return active[idx].address;
  }

  validateBlockProposal(block, parentBlock) {
    if (!block) {
      return { valid: false, reason: "NULL_BLOCK" };
    }

    // 1. Height check
    if (parentBlock && block.number !== parentBlock.number + 1) {
      return { valid: false, reason: `INVALID_BLOCK_NUMBER: expected ${parentBlock.number + 1}, got ${block.number}` };
    }

    // 2. Parent hash link check
    if (parentBlock && block.parentHash !== parentBlock.hash) {
      return { valid: false, reason: `INVALID_PARENT_HASH: expected ${parentBlock.hash}, got ${block.parentHash}` };
    }

    // 3. Proposer eligibility check
    const expectedProposer = this.selectBlockProposer(block.number);
    if (this.validators.size > 0 && block.validator.toLowerCase() !== expectedProposer.toLowerCase()) {
      return { valid: false, reason: `UNAUTHORIZED_PROPOSER: expected ${expectedProposer}, got ${block.validator}` };
    }

    // 4. Block hash integrity
    const recomputedHash = block.calculateBlockHash();
    if (block.hash !== recomputedHash) {
      return { valid: false, reason: `HASH_MISMATCH: claimed ${block.hash}, calculated ${recomputedHash}` };
    }

    // 5. Gas invariant check
    if (block.gasUsed !== 0) {
      return { valid: false, reason: `GAS_INVARIANT_VIOLATION: gasUsed must be 0, got ${block.gasUsed}` };
    }

    // 6. Transactions Merkle root check
    const recomputedMerkle = block.calculateTransactionsMerkleRoot();
    if (block.merkleRoot !== recomputedMerkle) {
      return { valid: false, reason: `MERKLE_ROOT_MISMATCH: claimed ${block.merkleRoot}, calculated ${recomputedMerkle}` };
    }

    return { valid: true };
  }

  finalizeBlock(block) {
    this.finalizedBlockNumber = block.number;
    this.finalizedBlockHash = block.hash;
    this.currentEpoch = Math.floor(block.number / this.epochBlocks);
    return {
      finalizedBlockNumber: this.finalizedBlockNumber,
      finalizedBlockHash: this.finalizedBlockHash,
      epoch: this.currentEpoch
    };
  }

  getConsensusStatus() {
    return {
      consensusAlgorithm: "Deterministic Round-Robin BFT Leader Proposal",
      invariant: "Consensus != PoR (Consensus decides canonical block, PoR validates execution proof)",
      activeValidatorsCount: this.getActiveValidators().length,
      finalizedBlockNumber: this.finalizedBlockNumber,
      finalizedBlockHash: this.finalizedBlockHash,
      currentEpoch: this.currentEpoch
    };
  }
}
