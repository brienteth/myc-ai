// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycResonanceAsset (ERC-721R / Living Resonance Asset)
 * @author Mycelium Network Architecture Group
 * @notice Implements the 4-Pillar Living Economic Asset Paradigm:
 *   1. Einstein Layer   : Dynamic energy score, activity gains, and temporal decay.
 *   2. Tesla Layer      : 8-dimensional frequency harmonic DNA and cosine resonance bonding.
 *   3. Heisenberg Layer : Observer effect logging, context tracking, and discovery bonus.
 *   4. Atatürk Layer    : Institutional permanence, fractional equity, and collective governance.
 */
contract MycResonanceAsset {
    string public name = "MYCA Resonance Asset";
    string public symbol = "MYC-RES";

    enum Status { DORMANT, ACTIVE, RESONANT, DISCOVERED }

    struct FrequencyDNA {
        uint256[8] harmonics;    // 8-dimensional frequency harmonic vector (normalized 0-10000)
        uint256 dominantHz;      // Fundamental dominant frequency in Hertz
        uint256 resonanceScore;  // Network-wide resonance connectivity score
    }

    struct ResonanceAsset {
        uint256 tokenId;
        string uri;
        address creator;
        uint256 energyScore;      // Dynamic value metric driven by usage & interaction
        uint256 lastInteraction;  // Unix timestamp of last state engagement
        uint256 decayRate;        // Energy lost per day after grace period
        Status status;
        FrequencyDNA frequency;
    }

    struct ObservationLog {
        address[] observers;
        uint256[] timestamps;
        bytes32[] contextHashes; // Context metadata hash (Human, AI Agent, DePIN Machine)
    }

    struct CollectiveOwnership {
        uint256 totalShares;                 // Standard: 10,000 basis points (100.00%)
        address governanceContract;          // DAO / Multi-sig voting contract
        uint256 minimumShareForProposal;     // Minimum basis points required to sponsor action
        mapping(address => uint256) shares; // Fractional equity balance per stakeholder
    }

    // Storage
    uint256 private _nextTokenId = 1;
    mapping(uint256 => ResonanceAsset) public assets;
    mapping(uint256 => ObservationLog) private _observations;
    mapping(uint256 => CollectiveOwnership) private _collective;
    mapping(uint256 => uint256[]) public resonanceBonds; // tokenA => array of bonded tokenBs

    // Global Constants
    uint256 public constant RESONANCE_THRESHOLD = 6500; // 0.65 Cosine similarity in basis points
    uint256 public constant BOOST_MULTIPLIER = 20;     // Energy boost on resonant bonding
    uint256 public constant DISCOVERY_THRESHOLD = 10;   // Unique observers required for DISCOVERED status
    uint256 public constant DISCOVERY_BONUS = 500;      // Energy reward upon breakthrough discovery
    uint256 public constant DECAY_GRACE_PERIOD = 30 days;

    // Interaction Weights (Einstein Energy Layer)
    mapping(uint8 => uint256) public interactionWeights;

    // Events
    event AssetMinted(uint256 indexed tokenId, address indexed creator, uint256 dominantHz);
    event EnergyUpdated(uint256 indexed tokenId, uint256 newEnergyScore, uint8 interactionType);
    event EnergyDecayed(uint256 indexed tokenId, uint256 lostEnergy, uint256 currentScore);
    event ResonantBondFormed(uint256 indexed tokenA, uint256 indexed tokenB, uint256 similarityBasisPoints, uint256 energyBoost);
    event Observed(uint256 indexed tokenId, address indexed observer, bytes32 indexed contextHash, uint256 timestamp);
    event DiscoveryAchieved(uint256 indexed tokenId, uint256 totalObservers);
    event SharesTransferred(uint256 indexed tokenId, address indexed from, address indexed to, uint256 shares);

    constructor() {
        // Initialize Einstein interaction weights
        interactionWeights[1] = 50;   // Routine verification / state query
        interactionWeights[2] = 120;  // DePIN machine telemetry pulse / sensor tick
        interactionWeights[3] = 300;  // AI model inference / compute consumption
        interactionWeights[4] = 600;  // Commercial M2M payment / micro-settlement
    }

    /**
     * @notice Mint a new Living Resonance Asset
     */
    function mintResonanceAsset(
        string calldata uri,
        uint256[8] calldata harmonics,
        uint256 dominantHz,
        uint256 initialDecayRate,
        address governanceContract
    ) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;

        ResonanceAsset storage asset = assets[tokenId];
        asset.tokenId = tokenId;
        asset.uri = uri;
        asset.creator = msg.sender;
        asset.energyScore = 1000; // Baseline vitality
        asset.lastInteraction = block.timestamp;
        asset.decayRate = initialDecayRate > 0 ? initialDecayRate : 10;
        asset.status = Status.ACTIVE;
        asset.frequency.harmonics = harmonics;
        asset.frequency.dominantHz = dominantHz;

        // Atatürk Collective Ownership Initialization (100% to creator initial)
        CollectiveOwnership storage coll = _collective[tokenId];
        coll.totalShares = 10000;
        coll.shares[msg.sender] = 10000;
        coll.governanceContract = governanceContract;
        coll.minimumShareForProposal = 500; // 5.00%

        emit AssetMinted(tokenId, msg.sender, dominantHz);
        return tokenId;
    }

    // =========================================================================
    // 1. EINSTEIN LAYER — DYNAMIC ENERGY & TEMPORAL CONSERVATION
    // =========================================================================

    /**
     * @notice State interaction increases energy. Value is generated through active utility.
     */
    function interact(uint256 tokenId, uint8 interactionType) external {
        require(assets[tokenId].tokenId != 0, "ASSET_NONEXISTENT");
        applyDecay(tokenId);

        uint256 weight = interactionWeights[interactionType];
        if (weight == 0) weight = 25;

        assets[tokenId].energyScore += weight;
        assets[tokenId].lastInteraction = block.timestamp;

        emit EnergyUpdated(tokenId, assets[tokenId].energyScore, interactionType);
    }

    /**
     * @notice Temporal entropy: unmaintained, neglected assets gradually decay.
     */
    function applyDecay(uint256 tokenId) public {
        ResonanceAsset storage asset = assets[tokenId];
        if (block.timestamp <= asset.lastInteraction + DECAY_GRACE_PERIOD) return;

        uint256 overdueDays = (block.timestamp - (asset.lastInteraction + DECAY_GRACE_PERIOD)) / 1 days;
        if (overdueDays > 0) {
            uint256 decayAmount = overdueDays * asset.decayRate;
            if (decayAmount > asset.energyScore) {
                asset.energyScore = 0;
                asset.status = Status.DORMANT;
            } else {
                asset.energyScore -= decayAmount;
            }
            asset.lastInteraction = block.timestamp;
            emit EnergyDecayed(tokenId, decayAmount, asset.energyScore);
        }
    }

    // =========================================================================
    // 2. TESLA LAYER — FREQUENCY HARMONICS & RESONANT BONDING
    // =========================================================================

    /**
     * @notice Calculates cosine similarity between 8-dimensional harmonic vectors (0-10000 bps).
     */
    function cosineSimilarity(uint256[8] memory a, uint256[8] memory b) public pure returns (uint256) {
        uint256 dotProduct = 0;
        uint256 normASq = 0;
        uint256 normBSq = 0;

        for (uint256 i = 0; i < 8; i++) {
            dotProduct += a[i] * b[i];
            normASq += a[i] * a[i];
            normBSq += b[i] * b[i];
        }

        if (normASq == 0 || normBSq == 0) return 0;
        uint256 denominator = sqrt(normASq) * sqrt(normBSq);
        if (denominator == 0) return 0;

        return (dotProduct * 10000) / denominator;
    }

    /**
     * @notice Bonds two frequency-coherent assets. Both receive synergistic resonance boost.
     */
    function bondResonance(uint256 tokenA, uint256 tokenB) external returns (bool, uint256) {
        require(tokenA != tokenB, "IDENTICAL_TOKENS");
        require(assets[tokenA].tokenId != 0 && assets[tokenB].tokenId != 0, "INVALID_TOKENS");

        applyDecay(tokenA);
        applyDecay(tokenB);

        uint256 similarity = cosineSimilarity(
            assets[tokenA].frequency.harmonics,
            assets[tokenB].frequency.harmonics
        );

        require(similarity >= RESONANCE_THRESHOLD, "FREQUENCY_INCOHERENT");

        uint256 boost = (similarity * BOOST_MULTIPLIER) / 100;
        assets[tokenA].energyScore += boost;
        assets[tokenB].energyScore += boost;
        assets[tokenA].frequency.resonanceScore += 1;
        assets[tokenB].frequency.resonanceScore += 1;
        assets[tokenA].status = Status.RESONANT;
        assets[tokenB].status = Status.RESONANT;

        resonanceBonds[tokenA].push(tokenB);
        resonanceBonds[tokenB].push(tokenA);

        emit ResonantBondFormed(tokenA, tokenB, similarity, boost);
        return (true, boost);
    }

    // =========================================================================
    // 3. HEISENBERG LAYER — OBSERVER EFFECT & KNOWLEDGE LOGGING
    // =========================================================================

    /**
     * @notice Observing an asset records witness context and alters its state.
     */
    function observe(uint256 tokenId, bytes32 contextHash) external {
        require(assets[tokenId].tokenId != 0, "NONEXISTENT_ASSET");
        applyDecay(tokenId);

        ObservationLog storage obs = _observations[tokenId];
        obs.observers.push(msg.sender);
        obs.timestamps.push(block.timestamp);
        obs.contextHashes.push(contextHash);

        // Discovery bonus upon reaching threshold of peer witnesses
        if (obs.observers.length == DISCOVERY_THRESHOLD && assets[tokenId].status != Status.DISCOVERED) {
            assets[tokenId].status = Status.DISCOVERED;
            assets[tokenId].energyScore += DISCOVERY_BONUS;
            emit DiscoveryAchieved(tokenId, obs.observers.length);
        }

        emit Observed(tokenId, msg.sender, contextHash, block.timestamp);
    }

    function getObservationCount(uint256 tokenId) external view returns (uint256) {
        return _observations[tokenId].observers.length;
    }

    // =========================================================================
    // 4. ATATÜRK LAYER — COLLECTIVE GOVERNANCE & FRACTIONAL EQUITY
    // =========================================================================

    /**
     * @notice Transfer fractional equity shares between stakeholders.
     */
    function transferShares(uint256 tokenId, address to, uint256 shareAmount) external {
        CollectiveOwnership storage coll = _collective[tokenId];
        require(coll.shares[msg.sender] >= shareAmount, "INSUFFICIENT_SHARES");
        require(to != address(0), "INVALID_RECIPIENT");

        coll.shares[msg.sender] -= shareAmount;
        coll.shares[to] += shareAmount;

        emit SharesTransferred(tokenId, msg.sender, to, shareAmount);
    }

    function getShares(uint256 tokenId, address stakeholder) external view returns (uint256) {
        return _collective[tokenId].shares[stakeholder];
    }

    // Integer square root utility for cosine denominator
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
