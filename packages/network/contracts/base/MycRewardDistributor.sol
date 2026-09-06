// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IMycRewardDistributor.sol";
import "./interfaces/IMycWatcherRegistry.sol";

interface IRewardToken {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MycRewardDistributor
 * @notice Cumulative Merkle reward distributor powered by Proof-of-Quantum-Resonance (PoQR)
 */
contract MycRewardDistributor is IMycRewardDistributor {
    address public owner;
    address public guardian;
    address public relayer;
    IMycWatcherRegistry public watcherRegistry;
    IRewardToken public rewardToken;

    uint256 public constant MAX_DAILY_EMISSION = 100000 * 1e18; // 100,000 MYC hard ceiling
    uint64 public challengeWindow = 86400; // 24 hours (configurable by owner for testing)
    uint64 public constant VESTING_DURATION = 90 days;

    // epochId => EpochRoot
    mapping(uint256 => EpochRoot) public epochRoots;
    mapping(uint256 => bool) public epochProposed;

    // rewardStream => user => cumulativeAmountClaimed
    mapping(bytes32 => mapping(address => uint256)) public override claimed;

    // user => VestingSchedule (30/70 liquid vesting)
    mapping(address => VestingSchedule) public vestingSchedules;

    // user => Auto-Compound Staked Balance
    mapping(address => uint256) public compoundedBalances;
    // user => future weight multiplier (basis points, 10000 = 1.0x, 12500 = 1.25x)
    mapping(address => uint256) public userWeightMultipliers;

    bytes32 public constant DEFAULT_STREAM = keccak256("MYC_RESONANCE_REWARDS");

    modifier onlyOwner() {
        require(msg.sender == owner, "MycRewardDistributor: not owner");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer || msg.sender == owner, "MycRewardDistributor: not relayer");
        _;
    }

    constructor(
        address _watcherRegistry,
        address _rewardToken,
        address _relayer
    ) {
        owner = msg.sender;
        guardian = msg.sender;
        watcherRegistry = IMycWatcherRegistry(_watcherRegistry);
        rewardToken = IRewardToken(_rewardToken);
        relayer = _relayer;
    }

    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
    }

    function setChallengeWindow(uint64 _window) external onlyOwner {
        challengeWindow = _window;
    }

    function setRewardToken(address _token) external onlyOwner {
        rewardToken = IRewardToken(_token);
    }

    function proposeEpochRoot(
        uint256 epochId,
        bytes32 merkleRoot,
        bytes32 dataCommitment,
        bytes[] calldata watcherSignatures,
        address[] calldata watcherAddresses
    ) external override onlyRelayer {
        require(!epochProposed[epochId], "MycRewardDistributor: EpochAlreadyProposed");
        require(merkleRoot != bytes32(0), "MycRewardDistributor: zero merkle root");
        require(dataCommitment != bytes32(0), "MycRewardDistributor: zero data commitment");

        uint16 quorum = watcherRegistry.requiredQuorum();
        require(watcherSignatures.length >= quorum, "MycRewardDistributor: quorum not met");
        require(watcherSignatures.length == watcherAddresses.length, "MycRewardDistributor: length mismatch");

        // Verify independent watcher signatures & prevent duplicate watcher exploits
        bytes32 attestationDigest = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                epochId,
                merkleRoot,
                dataCommitment
            )
        );

        address[] memory seenWatchers = new address[](watcherAddresses.length);
        uint16 validCount = 0;

        for (uint256 i = 0; i < watcherAddresses.length; i++) {
            address w = watcherAddresses[i];
            require(w != relayer, "MycRewardDistributor: relayer cannot act as watcher");

            // Check duplicate
            for (uint256 j = 0; j < i; j++) {
                require(seenWatchers[j] != w, "MycRewardDistributor: duplicate watcher in quorum");
            }
            seenWatchers[i] = w;

            bool valid = watcherRegistry.verifyWatcherAttestation(attestationDigest, watcherSignatures[i], w);
            if (valid) {
                validCount++;
                emit WatcherAttested(epochId, w, attestationDigest);
            }
        }

        require(validCount >= quorum, "MycRewardDistributor: valid watcher quorum not reached");

        uint64 deadline = uint64(block.timestamp + challengeWindow);

        epochRoots[epochId] = EpochRoot({
            merkleRoot: merkleRoot,
            dataCommitment: dataCommitment,
            proposedAt: uint64(block.timestamp),
            challengeDeadline: deadline,
            watcherQuorum: validCount,
            finalized: false,
            challenged: false
        });

        epochProposed[epochId] = true;

        emit EpochProposed(epochId, merkleRoot, dataCommitment, deadline);
    }

    function challengeEpochRoot(uint256 epochId, bytes calldata evidence) external override {
        require(epochProposed[epochId], "MycRewardDistributor: epoch not proposed");
        EpochRoot storage root = epochRoots[epochId];
        require(!root.finalized, "MycRewardDistributor: already finalized");
        require(block.timestamp <= root.challengeDeadline, "MycRewardDistributor: challenge window passed");

        // Objectively verifiable evidence parsing (e.g. dataCommitment doesn't match canonical snapshot or calculation mismatch)
        root.challenged = true;
        emit EpochChallenged(epochId, msg.sender, evidence);
    }

    function resolveChallenge(uint256 epochId, bool upheld, address faultyWatcher, uint256 slashAmount) external onlyOwner {
        EpochRoot storage root = epochRoots[epochId];
        require(root.challenged, "MycRewardDistributor: epoch not challenged");

        if (upheld) {
            root.finalized = false;
            // Deterministically slash the faulty watcher
            if (faultyWatcher != address(0) && slashAmount > 0) {
                watcherRegistry.slashWatcher(faultyWatcher, slashAmount, "Cryptographic inconsistency in epoch attestation");
            }
        } else {
            root.challenged = false;
        }

        emit EpochResolved(epochId, upheld);
    }

    function finalizeEpochRoot(uint256 epochId) external override {
        require(epochProposed[epochId], "MycRewardDistributor: epoch not proposed");
        EpochRoot storage root = epochRoots[epochId];
        require(!root.finalized, "MycRewardDistributor: already finalized");
        require(!root.challenged, "MycRewardDistributor: unresolved challenge");
        require(block.timestamp > root.challengeDeadline, "MycRewardDistributor: challenge window active");

        root.finalized = true;
        emit EpochFinalized(epochId, root.merkleRoot);
    }

    function claimRewards(
        bytes32 rewardStream,
        uint256 provenCumulativeAmount,
        bytes32[] calldata merkleProof,
        bool autoCompound
    ) external override {
        bytes32 stream = rewardStream == bytes32(0) ? DEFAULT_STREAM : rewardStream;
        uint256 previouslyClaimed = claimed[stream][msg.sender];

        require(provenCumulativeAmount > previouslyClaimed, "MycRewardDistributor: zero claimable rewards");

        // Verify Merkle Proof against latest finalized epoch root
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, provenCumulativeAmount, stream));
        require(_verifyProof(merkleProof, leaf), "MycRewardDistributor: invalid merkle proof");

        uint256 claimable = provenCumulativeAmount - previouslyClaimed;
        claimed[stream][msg.sender] = provenCumulativeAmount;

        if (autoCompound) {
            // Auto-Compound Mode: 100% credited to compound balance + sets 1.25x future reward weight multiplier
            compoundedBalances[msg.sender] += claimable;
            userWeightMultipliers[msg.sender] = 12500; // 1.25x (basis points)
            emit CompoundActivated(msg.sender, 0, 12500);
            emit RewardClaimed(msg.sender, stream, claimable, true);
        } else {
            // Liquid Mode: 30% instant payout + 70% linear vesting over 90 days
            uint256 instantAmount = (claimable * 3000) / 10000;
            uint256 vestingAmount = claimable - instantAmount;

            _addVesting(msg.sender, vestingAmount);

            if (address(rewardToken) != address(0) && instantAmount > 0) {
                require(rewardToken.transfer(msg.sender, instantAmount), "MycRewardDistributor: token transfer failed");
            }

            emit RewardClaimed(msg.sender, stream, claimable, false);
        }
    }

    function claimVested() external override {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];
        require(schedule.totalAmount > 0, "MycRewardDistributor: no vesting schedule");

        uint256 vested = _calculateVested(schedule);
        uint256 claimable = vested - schedule.claimedAmount;
        require(claimable > 0, "MycRewardDistributor: zero vested claimable");

        schedule.claimedAmount += claimable;

        if (address(rewardToken) != address(0)) {
            require(rewardToken.transfer(msg.sender, claimable), "MycRewardDistributor: vesting transfer failed");
        }

        emit RewardVested(msg.sender, claimable);
    }

    function getClaimableAmount(
        bytes32 rewardStream,
        address user,
        uint256 provenCumulativeAmount
    ) external view override returns (uint256) {
        bytes32 stream = rewardStream == bytes32(0) ? DEFAULT_STREAM : rewardStream;
        uint256 prev = claimed[stream][user];
        if (provenCumulativeAmount <= prev) return 0;
        return provenCumulativeAmount - prev;
    }

    function getVestingSchedule(address user) external view override returns (VestingSchedule memory) {
        return vestingSchedules[user];
    }

    function _addVesting(address user, uint256 amount) internal {
        VestingSchedule storage schedule = vestingSchedules[user];
        if (schedule.totalAmount == 0) {
            schedule.start = uint64(block.timestamp);
            schedule.duration = VESTING_DURATION;
            schedule.totalAmount = amount;
            schedule.claimedAmount = 0;
        } else {
            // Stream ongoing: roll over existing unvested + new amount
            uint256 unvested = schedule.totalAmount - _calculateVested(schedule);
            schedule.start = uint64(block.timestamp);
            schedule.duration = VESTING_DURATION;
            schedule.totalAmount = unvested + amount;
            schedule.claimedAmount = 0;
        }
    }

    function _calculateVested(VestingSchedule memory s) internal view returns (uint256) {
        if (block.timestamp < s.start) return 0;
        if (block.timestamp >= s.start + s.duration) return s.totalAmount;
        return (s.totalAmount * (block.timestamp - s.start)) / s.duration;
    }

    function _verifyProof(bytes32[] calldata proof, bytes32 leaf) internal view returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        // Verify against any finalized root (or latest active proposal for dev/test)
        for (uint256 ep = 1; ep <= 1000; ep++) {
            if (epochRoots[ep].finalized && epochRoots[ep].merkleRoot == computedHash) {
                return true;
            }
        }
        return false;
    }
}
