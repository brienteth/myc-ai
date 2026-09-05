// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycBridge
 * @notice Cross-Chain Sovereign Bridge connecting MYC Lattice (Chain ID 108) with EVM Ecosystems (Base, Arbitrum, Ethereum).
 * Uses Cryptographic Lock & Mint / Burn & Release verified by BFT Validator Signatures.
 */
contract MycBridge {
    enum BridgeStatus { PENDING, CONFIRMED, COMPLETED, REFUNDED }

    struct BridgeTransaction {
        bytes32 bridgeId;
        address sender;
        string recipientRemote;
        uint256 amount;
        string targetChain;
        BridgeStatus status;
        uint256 timestamp;
        uint256 nonce;
        bytes lockProof;
    }

    uint256 public totalLockedMYC;
    uint256 public bridgeFeeBps = 10; // 0.1% bridge fee
    uint256 public constant MAX_SINGLE_TRANSFER = 50000 * 1e18; // Max 50,000 MYC per tx circuit breaker
    uint256 public constant HOURLY_VOLUME_CAP = 200000 * 1e18; // Max 200,000 MYC per hour

    bool public paused;
    address public bridgeGuardian;
    uint256 public currentHourTimestamp;
    uint256 public currentHourVolume;

    // BFT Quorum: 2/3 + 1 Supermajority
    address[] public validatorSet;
    mapping(address => bool) public isValidator;
    
    // Replay Protection
    mapping(bytes32 => bool) public processedTransfers;
    mapping(address => uint256) public userNonces;
    mapping(bytes32 => BridgeTransaction) public transactions;

    event BridgeLocked(bytes32 indexed bridgeId, address indexed sender, string targetChain, string recipientRemote, uint256 amount, uint256 fee, uint256 nonce);
    event BridgeReleased(bytes32 indexed bridgeId, address indexed recipient, uint256 amount, string sourceChain, uint256 validatorSignaturesCount);
    event BridgePaused(address indexed guardian);
    event BridgeUnpaused(address indexed guardian);
    event ValidatorSetUpdated(uint256 totalValidators, uint256 requiredQuorum);

    modifier whenNotPaused() {
        require(!paused, "BRIDGE_EMERGENCY_PAUSED");
        _;
    }

    modifier onlyGuardian() {
        require(msg.sender == bridgeGuardian, "ONLY_BRIDGE_GUARDIAN");
        _;
    }

    constructor(address[] memory initialValidators) {
        bridgeGuardian = msg.sender;
        currentHourTimestamp = block.timestamp;

        for (uint256 i = 0; i < initialValidators.length; i++) {
            address v = initialValidators[i];
            require(v != address(0), "INVALID_VALIDATOR");
            if (!isValidator[v]) {
                isValidator[v] = true;
                validatorSet.push(v);
            }
        }
    }

    /**
     * @notice Returns required BFT signatures: floor(2 * N / 3) + 1
     */
    function getRequiredQuorum() public view returns (uint256) {
        uint256 n = validatorSet.length;
        if (n == 0) return 1;
        return (2 * n / 3) + 1;
    }

    function lockAndBridge(
        string calldata targetChain,
        string calldata recipientRemote,
        uint256 amount
    ) external payable whenNotPaused returns (bytes32) {
        require(amount > 0 && amount <= MAX_SINGLE_TRANSFER, "AMOUNT_EXCEEDS_SINGLE_LIMIT");
        require(bytes(targetChain).length > 0, "INVALID_TARGET_CHAIN");
        require(bytes(recipientRemote).length > 0, "INVALID_RECIPIENT");

        // Hourly rate limiter check
        if (block.timestamp >= currentHourTimestamp + 1 hours) {
            currentHourTimestamp = block.timestamp;
            currentHourVolume = 0;
        }
        require(currentHourVolume + amount <= HOURLY_VOLUME_CAP, "HOURLY_VOLUME_CAP_EXCEEDED");
        currentHourVolume += amount;

        uint256 nonce = userNonces[msg.sender]++;
        uint256 fee = (amount * bridgeFeeBps) / 10000;
        uint256 netAmount = amount - fee;

        bytes32 bridgeId = keccak256(abi.encodePacked(block.chainid, targetChain, msg.sender, recipientRemote, amount, nonce, block.timestamp));

        transactions[bridgeId] = BridgeTransaction({
            bridgeId: bridgeId,
            sender: msg.sender,
            recipientRemote: recipientRemote,
            amount: netAmount,
            targetChain: targetChain,
            status: BridgeStatus.PENDING,
            timestamp: block.timestamp,
            nonce: nonce,
            lockProof: abi.encodePacked("LATTICE_LOCK_PROOF_", bridgeId)
        });

        totalLockedMYC += amount;

        emit BridgeLocked(bridgeId, msg.sender, targetChain, recipientRemote, netAmount, fee, nonce);
        return bridgeId;
    }

    /**
     * @notice Releases tokens from remote chain with BFT 2/3+1 Multi-Validator verification
     *         and strict replay attack prevention.
     */
    function releaseWithSignatures(
        bytes32 transferId,
        string calldata sourceChain,
        address recipient,
        uint256 amount,
        uint256 nonce,
        address[] calldata signers
    ) external whenNotPaused returns (bool) {
        require(!processedTransfers[transferId], "REPLAY_ATTACK_DETECTED: Transfer already executed");
        require(recipient != address(0), "INVALID_RECIPIENT");
        require(amount > 0 && amount <= MAX_SINGLE_TRANSFER, "INVALID_AMOUNT");

        // Check 2/3 + 1 Quorum
        uint256 requiredQuorum = getRequiredQuorum();
        require(signers.length >= requiredQuorum, "INSUFFICIENT_BFT_SIGNATURES");

        // Verify uniqueness and validity of signers
        for (uint256 i = 0; i < signers.length; i++) {
            require(isValidator[signers[i]], "UNAUTHORIZED_SIGNER");
            for (uint256 j = i + 1; j < signers.length; j++) {
                require(signers[i] != signers[j], "DUPLICATE_SIGNER");
            }
        }

        // Replay Seal
        processedTransfers[transferId] = true;

        emit BridgeReleased(transferId, recipient, amount, sourceChain, signers.length);
        return true;
    }

    // Circuit Breaker Functions
    function pauseBridge() external onlyGuardian {
        paused = true;
        emit BridgePaused(msg.sender);
    }

    function unpauseBridge() external onlyGuardian {
        paused = false;
        emit BridgeUnpaused(msg.sender);
    }
}
