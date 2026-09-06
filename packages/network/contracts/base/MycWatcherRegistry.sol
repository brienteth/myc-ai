// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IMycWatcherRegistry.sol";

/**
 * @title MycWatcherRegistry
 * @notice Manages registered independent watchers, EIP-712 attestation quorum, and deterministic slashing
 */
contract MycWatcherRegistry is IMycWatcherRegistry {
    address public owner;
    address public rewardDistributor;
    uint256 public minimumStake = 0.1 ether;
    uint16 public override requiredQuorum = 2; // e.g. 2 of 3

    mapping(address => Watcher) public watchers;
    address[] public watcherList;

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant WATCHER_ATTESTATION_TYPEHASH = keccak256(
        "WatcherAttestation(uint256 epochId,bytes32 merkleRoot,bytes32 dataCommitment,uint32 snapshotVersion,uint32 watcherSetId,address watcherAddress)"
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "MycWatcherRegistry: not owner");
        _;
    }

    modifier onlyDistributor() {
        require(msg.sender == rewardDistributor, "MycWatcherRegistry: only distributor");
        _;
    }

    constructor() {
        owner = msg.sender;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("MYC Watcher Registry")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function setRewardDistributor(address _distributor) external onlyOwner {
        rewardDistributor = _distributor;
    }

    function setRequiredQuorum(uint16 _quorum) external onlyOwner {
        require(_quorum > 0, "MycWatcherRegistry: quorum cannot be zero");
        requiredQuorum = _quorum;
        emit QuorumUpdated(_quorum);
    }

    function registerWatcher() external payable override {
        require(msg.value >= minimumStake, "MycWatcherRegistry: insufficient stake");
        require(!watchers[msg.sender].active, "MycWatcherRegistry: already registered");

        watchers[msg.sender] = Watcher({
            account: msg.sender,
            stake: msg.value,
            active: true,
            registeredAt: uint64(block.timestamp),
            slashedCount: 0
        });

        watcherList.push(msg.sender);
        emit WatcherRegistered(msg.sender, msg.value);
    }

    function deregisterWatcher() external override {
        require(watchers[msg.sender].active, "MycWatcherRegistry: not active");
        uint256 amount = watchers[msg.sender].stake;
        watchers[msg.sender].active = false;
        watchers[msg.sender].stake = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "MycWatcherRegistry: transfer failed");

        emit WatcherDeregistered(msg.sender);
    }

    function slashWatcher(address watcher, uint256 amount, string calldata reason) external override {
        require(msg.sender == owner || msg.sender == rewardDistributor, "MycWatcherRegistry: unauthorized slash");
        require(watchers[watcher].active, "MycWatcherRegistry: watcher not active");

        uint256 slashAmount = amount > watchers[watcher].stake ? watchers[watcher].stake : amount;
        watchers[watcher].stake -= slashAmount;
        watchers[watcher].slashedCount += 1;

        if (watchers[watcher].stake < minimumStake) {
            watchers[watcher].active = false;
        }

        emit WatcherSlashed(watcher, slashAmount, reason);
    }

    function verifyWatcherAttestation(
        bytes32 attestationDigest,
        bytes calldata signature,
        address expectedWatcher
    ) external view override returns (bool) {
        if (!watchers[expectedWatcher].active) return false;

        address recovered = _recoverSigner(attestationDigest, signature);
        return recovered == expectedWatcher;
    }

    function isWatcher(address account) external view override returns (bool) {
        return watchers[account].active;
    }

    function getWatcherCount() external view override returns (uint256) {
        return watcherList.length;
    }

    function _recoverSigner(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "MycWatcherRegistry: invalid sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }
}
