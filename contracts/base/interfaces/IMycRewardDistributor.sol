// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMycRewardDistributor
 * @notice Cumulative Merkle reward distributor powered by Proof-of-Quantum-Resonance (PoQR)
 */
interface IMycRewardDistributor {
    struct EpochRoot {
        bytes32 merkleRoot;
        bytes32 dataCommitment;
        uint64 proposedAt;
        uint64 challengeDeadline;
        uint16 watcherQuorum;
        bool finalized;
        bool challenged;
    }

    struct VestingSchedule {
        uint64 start;
        uint64 duration;
        uint256 totalAmount;
        uint256 claimedAmount;
    }

    event EpochProposed(uint256 indexed epochId, bytes32 merkleRoot, bytes32 dataCommitment, uint64 challengeDeadline);
    event WatcherAttested(uint256 indexed epochId, address indexed watcher, bytes32 attestationDigest);
    event EpochChallenged(uint256 indexed epochId, address indexed challenger, bytes evidence);
    event EpochResolved(uint256 indexed epochId, bool upheld);
    event EpochFinalized(uint256 indexed epochId, bytes32 merkleRoot);
    event RewardClaimed(address indexed user, bytes32 indexed rewardStream, uint256 claimable, bool autoCompound);
    event RewardVested(address indexed user, uint256 amount);
    event CompoundActivated(address indexed user, uint256 epochId, uint256 futureWeightMultiplier);

    function proposeEpochRoot(
        uint256 epochId,
        bytes32 merkleRoot,
        bytes32 dataCommitment,
        bytes[] calldata watcherSignatures,
        address[] calldata watcherAddresses
    ) external;

    function challengeEpochRoot(uint256 epochId, bytes calldata evidence) external;

    function finalizeEpochRoot(uint256 epochId) external;

    function claimRewards(
        bytes32 rewardStream,
        uint256 provenCumulativeAmount,
        bytes32[] calldata merkleProof,
        bool autoCompound
    ) external;

    function claimVested() external;

    function getClaimableAmount(
        bytes32 rewardStream,
        address user,
        uint256 provenCumulativeAmount
    ) external view returns (uint256);

    function getVestingSchedule(address user) external view returns (VestingSchedule memory);
}
