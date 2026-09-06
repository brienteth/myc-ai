// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMycWatcherRegistry
 * @notice Manages independent watchers, minimum stake, attestation verification, and deterministic slashing
 */
interface IMycWatcherRegistry {
    struct Watcher {
        address account;
        uint256 stake;
        bool active;
        uint64 registeredAt;
        uint32 slashedCount;
    }

    event WatcherRegistered(address indexed watcher, uint256 stake);
    event WatcherSlashed(address indexed watcher, uint256 amount, string reason);
    event WatcherDeregistered(address indexed watcher);
    event QuorumUpdated(uint16 requiredQuorum);

    function registerWatcher() external payable;
    function deregisterWatcher() external;
    function slashWatcher(address watcher, uint256 amount, string calldata reason) external;
    function verifyWatcherAttestation(
        bytes32 attestationDigest,
        bytes calldata signature,
        address expectedWatcher
    ) external view returns (bool);

    function isWatcher(address account) external view returns (bool);
    function getWatcherCount() external view returns (uint256);
    function requiredQuorum() external view returns (uint16);
}
