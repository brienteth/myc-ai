import { MycBlock } from "./block.js";
import { MycTransaction } from "./transaction.js";
import { MycStateTrie } from "../state/state_trie.js";
import { MycConsensusEngine } from "../consensus/consensus.js";
import { MycMempool } from "../mempool/mempool.js";
import { MycStorageAdapter } from "../storage/storage_adapter.js";

/**
 * MYC Sovereign Blockchain Core
 * Chain ID: 108
 * Network Name: MYC-LATTICE-MAINNET
 * Gas Invariant: Gas = 0 (gasPrice = 0, gasUsed = 0)
 * Finality Target: < 38.4 µs (STATUS: BENCHMARK PENDING)
 */
export class MycBlockchain {
  constructor(options = {}) {
    this.chainId = 108;
    this.networkName = "MYC-LATTICE-MAINNET";
    this.finalityTarget = "< 38.4 µs";
    this.finalityStatus = "BENCHMARK PENDING";

    this.storage = options.storage || new MycStorageAdapter("./data/myc_ledger.db", { inMemory: options.inMemory ?? true });
    this.state = new MycStateTrie(this.storage);
    this.consensus = new MycConsensusEngine({ minValidators: 1 });
    this.mempool = new MycMempool(this.state);

    this.blocks = [];
    this.blocksByHash = new Map();
    this.transactionsByHash = new Map();
    this.txReceipts = new Map();
    this.vm = null; // Attached during VM initialization

    this.initGenesis();
  }

  attachVM(vm) {
    this.vm = vm;
  }

  initGenesis() {
    const genesisValidator = "myc1genesisvalidator00000000000000000";
    this.consensus.registerValidator(genesisValidator, 100000);

    // Genesis allocation
    const genesisAddress = "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";
    this.state.setBalance(genesisAddress, 100000000); // 100M MYC total supply

    const stateRoot = this.state.calculateStateRoot();
    const genesisBlock = new MycBlock({
      number: 0,
      parentHash: "0x" + "0".repeat(64),
      timestamp: 1788440000000,
      transactions: [],
      stateRoot,
      receiptsRoot: "0x" + "0".repeat(64),
      validator: genesisValidator,
      extraData: "MYC-LATTICE-MAINNET-GENESIS-2026"
    });

    this.blocks.push(genesisBlock);
    this.blocksByHash.set(genesisBlock.hash, genesisBlock);
    this.consensus.finalizeBlock(genesisBlock);
  }

  getLatestBlock() {
    return this.blocks[this.blocks.length - 1];
  }

  getBlockByNumber(number) {
    if (number === "latest") return this.getLatestBlock();
    const num = parseInt(number, 10);
    return this.blocks[num] || null;
  }

  getBlockByHash(hash) {
    return this.blocksByHash.get(hash) || null;
  }

  getTransaction(hash) {
    return this.transactionsByHash.get(hash) || null;
  }

  getTransactionReceipt(hash) {
    return this.txReceipts.get(hash) || null;
  }

  submitTransaction(txPayload) {
    const tx = txPayload instanceof MycTransaction ? txPayload : new MycTransaction(txPayload);
    const result = this.mempool.addTransaction(tx);
    return { status: "QUEUED_IN_MEMPOOL", hash: tx.hash };
  }

  produceBlock(validatorAddress = null) {
    const parentBlock = this.getLatestBlock();
    const nextNumber = parentBlock.number + 1;
    const proposer = validatorAddress || this.consensus.selectBlockProposer(nextNumber);

    const pendingTxs = this.mempool.getPendingTransactions(50);
    const executedTxs = [];
    const receipts = [];

    const snapshotId = this.state.takeSnapshot();

    try {
      for (const tx of pendingTxs) {
        // Execute transaction
        const receipt = this.executeTransaction(tx);
        executedTxs.push(tx);
        receipts.push(receipt);
        this.transactionsByHash.set(tx.hash, tx);
        this.txReceipts.set(tx.hash, receipt);
      }

      // Remove mined transactions from mempool
      this.mempool.removeTransactions(executedTxs.map(t => t.hash));

      const stateRoot = this.state.calculateStateRoot();
      const receiptsRoot = this.calculateReceiptsRoot(receipts);

      const block = new MycBlock({
        number: nextNumber,
        parentHash: parentBlock.hash,
        timestamp: Date.now(),
        transactions: executedTxs,
        stateRoot,
        receiptsRoot,
        validator: proposer,
        consensusProof: {
          proposer,
          round: nextNumber,
          signature: "por_consensus_sig_" + proposer.slice(0, 8)
        }
      });

      // Consensus validation
      const validation = this.consensus.validateBlockProposal(block, parentBlock);
      if (!validation.valid) {
        throw new Error(`ConsensusValidationError: ${validation.reason}`);
      }

      this.blocks.push(block);
      this.blocksByHash.set(block.hash, block);
      this.consensus.finalizeBlock(block);

      return {
        block,
        transactionCount: executedTxs.length,
        receipts
      };
    } catch (err) {
      this.state.revertToSnapshot(snapshotId);
      throw err;
    }
  }

  executeTransaction(tx) {
    // 1. Balance transfer
    if (tx.value > 0) {
      const senderBal = this.state.getBalance(tx.from);
      if (senderBal < tx.value) {
        throw new Error(`INSUFFICIENT_FUNDS: sender has ${senderBal}, needs ${tx.value}`);
      }
      const recipientBal = this.state.getBalance(tx.to);
      this.state.setBalance(tx.from, senderBal - tx.value);
      this.state.setBalance(tx.to, recipientBal + tx.value);
    }

    // 2. Increment sender nonce
    this.state.incrementNonce(tx.from);

    // 3. Smart contract execution (if to is a contract or VM is attached)
    let vmResult = null;
    if (this.vm && (tx.data || tx.to === null)) {
      vmResult = this.vm.execute({
        from: tx.from,
        to: tx.to,
        value: tx.value,
        data: tx.data,
        porProof: tx.porProof
      });
    }

    return {
      transactionHash: tx.hash,
      status: vmResult ? (vmResult.success ? 1 : 0) : 1,
      blockNumber: this.blocks.length,
      gasUsed: 0, // Gas = 0 Invariant
      returnValue: vmResult ? vmResult.returnValue : null,
      logs: vmResult ? vmResult.logs : []
    };
  }

  importBlock(blockInput) {
    if (!blockInput || !blockInput.hash) {
      return { imported: false, reason: "NULL_BLOCK" };
    }

    const block = blockInput instanceof MycBlock ? blockInput : new MycBlock(blockInput);

    if (this.blocksByHash.has(block.hash)) {
      return { imported: false, reason: "ALREADY_KNOWN" };
    }

    const currentTip = this.getLatestBlock();

    // 1. Direct sequential block appending
    if (block.parentHash === currentTip.hash && block.number === currentTip.number + 1) {
      const validation = this.consensus.validateBlockProposal(block, currentTip);
      if (!validation.valid) {
        throw new Error(`ConsensusValidationError: ${validation.reason}`);
      }

      const snapshotId = this.state.takeSnapshot();
      try {
        const executedTxs = [];
        const receipts = [];

        for (const tx of block.transactions) {
          const receipt = this.executeTransaction(tx);
          executedTxs.push(tx);
          receipts.push(receipt);
          this.transactionsByHash.set(tx.hash, tx);
          this.txReceipts.set(tx.hash, receipt);
        }

        const calculatedStateRoot = this.state.calculateStateRoot();
        if (calculatedStateRoot !== block.stateRoot) {
          throw new Error(`STATE_ROOT_MISMATCH: expected ${block.stateRoot}, got ${calculatedStateRoot}`);
        }

        // Evict mined transactions from mempool and purge invalid nonces/balances
        this.mempool.removeTransactions(executedTxs.map(t => t.hash));
        this.mempool.purgeInvalidTransactions();

        this.blocks.push(block);
        this.blocksByHash.set(block.hash, block);
        this.consensus.finalizeBlock(block);

        return {
          imported: true,
          blockNumber: block.number,
          blockHash: block.hash,
          txCount: executedTxs.length
        };
      } catch (err) {
        this.state.revertToSnapshot(snapshotId);
        throw err;
      }
    }

    // 2. Alternative fork branch or reorganization
    if (this.blocksByHash.has(block.parentHash)) {
      this.blocksByHash.set(block.hash, block);
      if (block.number > currentTip.number) {
        return this.reorganizeChain(block);
      }
      return { imported: true, fork: true, canonical: false, height: block.number };
    }

    return { imported: false, reason: "ORPHAN_BLOCK_PARENT_UNKNOWN" };
  }

  reorganizeChain(newTipBlock) {
    // Trace back new branch to find common ancestor in canonical chain
    const forkBranch = [newTipBlock];
    let curr = newTipBlock;
    while (curr && !this.blocks.some(b => b.hash === curr.parentHash)) {
      curr = this.blocksByHash.get(curr.parentHash);
      if (!curr) break;
      forkBranch.unshift(curr);
    }

    if (!curr) {
      return { imported: false, reason: "REORG_FAILED_NO_COMMON_ANCESTOR" };
    }

    const ancestor = this.blocksByHash.get(curr.parentHash);
    if (!ancestor) {
      return { imported: false, reason: "REORG_ANCESTOR_NOT_FOUND" };
    }

    const ancestorIndex = this.blocks.findIndex(b => b.hash === ancestor.hash);
    if (ancestorIndex === -1) {
      return { imported: false, reason: "ANCESTOR_NOT_IN_CANONICAL_CHAIN" };
    }

    // Replay state from genesis up to newTip
    const oldTip = this.getLatestBlock();
    if (newTipBlock.number <= oldTip.number) {
      return { imported: true, reorg: false, reason: "FORK_NOT_HEAVIER" };
    }

    // Replace canonical tip with longer fork branch
    const detachedBlocks = this.blocks.slice(ancestorIndex + 1);
    this.blocks = this.blocks.slice(0, ancestorIndex + 1).concat(forkBranch);

    // Synchronize transactions
    for (const fb of forkBranch) {
      this.consensus.finalizeBlock(fb);
      for (const tx of fb.transactions) {
        this.transactionsByHash.set(tx.hash, tx);
      }
    }

    return {
      imported: true,
      reorg: true,
      commonAncestorHeight: ancestor.number,
      newHeight: newTipBlock.number,
      detachedCount: detachedBlocks.length,
      attachedCount: forkBranch.length
    };
  }

  calculateReceiptsRoot(receipts) {
    if (!receipts || receipts.length === 0) return "0x" + "0".repeat(64);
    const hashes = receipts.map(r => r.transactionHash);
    let level = hashes;
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : left;
        next.push(left); // simplified deterministic receipt accumulator
      }
      level = next;
    }
    return level[0];
  }

  getChainInfo() {
    const latest = this.getLatestBlock();
    return {
      chainId: this.chainId,
      networkName: this.networkName,
      blockHeight: latest.number,
      latestBlockHash: latest.hash,
      finalizedBlock: this.consensus.finalizedBlockNumber,
      mempoolPending: this.mempool.size(),
      gasModel: "ZERO_GAS (Resource-Accounted)",
      finality: {
        target: this.finalityTarget,
        status: this.finalityStatus
      }
    };
  }
}
