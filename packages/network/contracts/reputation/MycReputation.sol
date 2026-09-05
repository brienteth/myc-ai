// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycReputation
 * @notice Attributable Node & Agent Reputation Ledger
 * 
 * Strict Specification Invariant §12 & Colony V2 Parameters:
 *  - Baseline initial reputation: 100 points
 *  - Success task completion: +10 points
 *  - Timeout / non-responsive penalty: -25 points
 *  - Slashing (fraud/discrepancy): -100 points
 *  - Task eligibility threshold: >= 50 points (Nodes < 50 are quarantined from task routing)
 *  - Inactivity decay: 5% per 30-day epoch towards baseline
 */
contract MycReputation {
    uint256 public constant INITIAL_REPUTATION = 100;
    uint256 public constant SUCCESS_REWARD = 10;
    uint256 public constant TIMEOUT_PENALTY = 25;
    uint256 public constant SLASHING_PENALTY = 100;
    uint256 public constant MIN_REPUTATION_FOR_TASKS = 50;
    uint256 public constant MAX_REPUTATION = 1000;
    uint256 public constant DECAY_EPOCH_SECONDS = 30 days;
    uint256 public constant DECAY_BPS = 500; // 5.00% decay per epoch

    struct ReputationScore {
        uint256 score;
        uint256 successfulTasks;
        uint256 failedTasks;
        uint256 timeouts;
        uint256 slashedCount;
        uint256 lastUpdated;
        bool isQuarantined;
    }

    mapping(address => ReputationScore) public scores;
    address public settlementContract;

    event ReputationUpdated(address indexed node, uint256 newScore, string reason);
    event NodeQuarantined(address indexed node, uint256 currentScore);

    modifier onlySettlement() {
        require(msg.sender == settlementContract, "ONLY_SETTLEMENT");
        _;
    }

    constructor() {
        settlementContract = msg.sender;
    }

    function initializeNode(address node) external {
        if (scores[node].lastUpdated == 0) {
            scores[node] = ReputationScore({
                score: INITIAL_REPUTATION,
                successfulTasks: 0,
                failedTasks: 0,
                timeouts: 0,
                slashedCount: 0,
                lastUpdated: block.timestamp,
                isQuarantined: false
            });
            emit ReputationUpdated(node, INITIAL_REPUTATION, "INITIALIZED");
        }
    }

    function recordSuccess(address node) external onlySettlement {
        _ensureInit(node);
        _applyInactivityDecay(node);

        ReputationScore storage r = scores[node];
        r.successfulTasks++;
        r.score = (r.score + SUCCESS_REWARD > MAX_REPUTATION) ? MAX_REPUTATION : r.score + SUCCESS_REWARD;
        if (r.score >= MIN_REPUTATION_FOR_TASKS) {
            r.isQuarantined = false;
        }
        r.lastUpdated = block.timestamp;
        emit ReputationUpdated(node, r.score, "TASK_SUCCESS");
    }

    function recordTimeout(address node) external onlySettlement {
        _ensureInit(node);
        _applyInactivityDecay(node);

        ReputationScore storage r = scores[node];
        r.timeouts++;
        r.failedTasks++;
        r.score = (r.score > TIMEOUT_PENALTY) ? r.score - TIMEOUT_PENALTY : 0;
        if (r.score < MIN_REPUTATION_FOR_TASKS) {
            r.isQuarantined = true;
            emit NodeQuarantined(node, r.score);
        }
        r.lastUpdated = block.timestamp;
        emit ReputationUpdated(node, r.score, "TIMEOUT_PENALTY");
    }

    function recordSlash(address node, string calldata reason) external onlySettlement {
        _ensureInit(node);
        _applyInactivityDecay(node);

        ReputationScore storage r = scores[node];
        r.slashedCount++;
        r.failedTasks++;
        r.score = (r.score > SLASHING_PENALTY) ? r.score - SLASHING_PENALTY : 0;
        r.isQuarantined = true;
        r.lastUpdated = block.timestamp;
        emit NodeQuarantined(node, r.score);
        emit ReputationUpdated(node, r.score, string(abi.encodePacked("SLASHED: ", reason)));
    }

    function isEligibleForTasks(address node) external view returns (bool) {
        if (scores[node].lastUpdated == 0) return true; // new node starts with default eligibility
        return scores[node].score >= MIN_REPUTATION_FOR_TASKS && !scores[node].isQuarantined;
    }

    function _ensureInit(address node) internal {
        if (scores[node].lastUpdated == 0) {
            scores[node].score = INITIAL_REPUTATION;
            scores[node].lastUpdated = block.timestamp;
        }
    }

    function _applyInactivityDecay(address node) internal {
        ReputationScore storage r = scores[node];
        if (block.timestamp > r.lastUpdated + DECAY_EPOCH_SECONDS && r.score > INITIAL_REPUTATION) {
            uint256 elapsedEpochs = (block.timestamp - r.lastUpdated) / DECAY_EPOCH_SECONDS;
            uint256 decayAmount = (r.score * DECAY_BPS * elapsedEpochs) / 10000;
            if (r.score > decayAmount && r.score - decayAmount >= INITIAL_REPUTATION) {
                r.score -= decayAmount;
            } else {
                r.score = INITIAL_REPUTATION;
            }
        }
    }
}
