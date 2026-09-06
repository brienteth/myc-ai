// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMycNodeRegistry
 * @notice Manages hardware identity, attestation state, and transfer unbinding for MYC Node Licenses
 */
interface IMycNodeRegistry {
    enum HardwareState {
        UNBOUND,
        BIND_REQUESTED,
        CHALLENGE_SENT,
        HARDWARE_ATTESTED,
        BOUND,
        UNBOUND_PENDING
    }

    struct HardwareBinding {
        bytes32 machineDid;
        HardwareState state;
        uint64 boundTimestamp;
        uint64 lastAttestationTimestamp;
        bytes32 activeChallenge;
        uint64 challengeDeadline;
        uint256 bindingNonce;
    }

    event MachineBindRequested(uint256 indexed tokenId, bytes32 indexed machineDid, bytes32 challenge, uint64 deadline);
    event HardwareAttested(uint256 indexed tokenId, bytes32 indexed machineDid, address indexed attester);
    event MachineBound(uint256 indexed tokenId, bytes32 indexed machineDid, address indexed owner);
    event MachineUnbound(uint256 indexed tokenId, bytes32 indexed machineDid, address indexed prevOwner);
    event RewardCheckpointed(uint256 indexed tokenId, address indexed from, address indexed to, uint64 timestamp);

    function onLicenseTransferred(uint256 tokenId, address from, address to) external;
    function requestBindMachine(uint256 tokenId, bytes32 machineDid) external returns (bytes32 challenge);
    function attestAndBind(
        uint256 tokenId,
        bytes32 machineDid,
        bytes32 challenge,
        uint256 deadline,
        bytes calldata hardwareSignature
    ) external;
    function unbindMachine(uint256 tokenId) external;
    function getBinding(uint256 tokenId) external view returns (HardwareBinding memory);
    function isMachineBound(uint256 tokenId) external view returns (bool);
    function getMachineOwner(bytes32 machineDid) external view returns (address);
}
