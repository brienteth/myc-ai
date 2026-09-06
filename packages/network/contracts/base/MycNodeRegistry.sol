// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IMycNodeRegistry.sol";
import "./interfaces/IMycNodeLicense.sol";

/**
 * @title MycNodeRegistry
 * @notice Authoritative hardware binding state machine and EIP-712 hardware attestation verifier
 */
contract MycNodeRegistry is IMycNodeRegistry {
    address public owner;
    address public licenseContract;

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant HARDWARE_ATTESTATION_TYPEHASH = keccak256(
        "HardwareAttestation(uint256 tokenId,bytes32 machineDid,bytes32 challenge,uint256 nonce,uint256 deadline)"
    );

    // tokenId => HardwareBinding
    mapping(uint256 => HardwareBinding) private _bindings;

    // machineDid => tokenId (ensure 1-to-1 machine to token binding)
    mapping(bytes32 => uint256) public machineToToken;

    // machineDid => authorized hardware signer address (derived from device public key)
    mapping(bytes32 => address) public machineSigners;

    // machineDid => true if registered
    mapping(bytes32 => bool) public registeredMachines;

    // tokenId => last checkpointed timestamp
    mapping(uint256 => uint64) public lastCheckpoint;

    modifier onlyOwner() {
        require(msg.sender == owner, "MycNodeRegistry: not owner");
        _;
    }

    modifier onlyLicense() {
        require(msg.sender == licenseContract, "MycNodeRegistry: only license contract");
        _;
    }

    constructor(address _licenseContract) {
        owner = msg.sender;
        licenseContract = _licenseContract;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("MYC Hardware Attestation")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function setLicenseContract(address _license) external onlyOwner {
        licenseContract = _license;
    }

    function registerMachineIdentity(bytes32 machineDid, address signer) external onlyOwner {
        require(machineDid != bytes32(0), "MycNodeRegistry: zero machineDid");
        require(signer != address(0), "MycNodeRegistry: zero signer");
        machineSigners[machineDid] = signer;
        registeredMachines[machineDid] = true;
    }

    function onLicenseTransferred(uint256 tokenId, address from, address to) external onlyLicense {
        HardwareBinding storage binding = _bindings[tokenId];

        if (binding.state == HardwareState.BOUND || binding.state == HardwareState.HARDWARE_ATTESTED) {
            bytes32 did = binding.machineDid;
            delete machineToToken[did];
            binding.state = HardwareState.UNBOUND_PENDING;
            emit MachineUnbound(tokenId, did, from);
        }

        // Increment nonce to cryptographically invalidate any pre-transfer hardware signatures
        binding.bindingNonce += 1;
        binding.activeChallenge = bytes32(0);
        binding.challengeDeadline = 0;

        lastCheckpoint[tokenId] = uint64(block.timestamp);
        emit RewardCheckpointed(tokenId, from, to, uint64(block.timestamp));
    }

    function requestBindMachine(uint256 tokenId, bytes32 machineDid) external returns (bytes32 challenge) {
        address tokenOwner = IMycNodeLicense(licenseContract).ownerOf(tokenId);
        require(msg.sender == tokenOwner, "MycNodeRegistry: not license owner");
        require(registeredMachines[machineDid], "MycNodeRegistry: machine not registered");
        require(machineToToken[machineDid] == 0, "MycNodeRegistry: machine already bound");

        HardwareBinding storage binding = _bindings[tokenId];
        require(
            binding.state == HardwareState.UNBOUND || binding.state == HardwareState.UNBOUND_PENDING,
            "MycNodeRegistry: invalid state for bind request"
        );

        binding.bindingNonce += 1;
        uint64 deadline = uint64(block.timestamp + 600); // 10 minute challenge window

        // Generate unique challenge binding token, machine, nonce and block
        challenge = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                tokenId,
                machineDid,
                binding.bindingNonce,
                block.timestamp,
                blockhash(block.number - 1)
            )
        );

        binding.machineDid = machineDid;
        binding.activeChallenge = challenge;
        binding.challengeDeadline = deadline;
        binding.state = HardwareState.CHALLENGE_SENT;

        emit MachineBindRequested(tokenId, machineDid, challenge, deadline);
        return challenge;
    }

    function attestAndBind(
        uint256 tokenId,
        bytes32 machineDid,
        bytes32 challenge,
        uint256 deadline,
        bytes calldata hardwareSignature
    ) external {
        address tokenOwner = IMycNodeLicense(licenseContract).ownerOf(tokenId);
        require(msg.sender == tokenOwner, "MycNodeRegistry: not license owner");

        HardwareBinding storage binding = _bindings[tokenId];
        require(binding.state == HardwareState.CHALLENGE_SENT, "MycNodeRegistry: challenge not active");
        require(binding.machineDid == machineDid, "MycNodeRegistry: wrong machineDid");
        require(binding.activeChallenge == challenge, "MycNodeRegistry: invalid challenge");
        require(block.timestamp <= binding.challengeDeadline, "MycNodeRegistry: challenge expired");
        require(block.timestamp <= deadline, "MycNodeRegistry: deadline expired");

        // Verify EIP-712 signature from the machine's authorized attestation key
        bytes32 structHash = keccak256(
            abi.encode(
                HARDWARE_ATTESTATION_TYPEHASH,
                tokenId,
                machineDid,
                challenge,
                binding.bindingNonce,
                deadline
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        address recovered = _recoverSigner(digest, hardwareSignature);
        require(recovered == machineSigners[machineDid], "MycNodeRegistry: invalid hardware signature");

        binding.state = HardwareState.BOUND;
        binding.boundTimestamp = uint64(block.timestamp);
        binding.lastAttestationTimestamp = uint64(block.timestamp);
        binding.activeChallenge = bytes32(0);
        binding.challengeDeadline = 0;

        machineToToken[machineDid] = tokenId;

        emit HardwareAttested(tokenId, machineDid, recovered);
        emit MachineBound(tokenId, machineDid, tokenOwner);
    }

    function unbindMachine(uint256 tokenId) external {
        address tokenOwner = IMycNodeLicense(licenseContract).ownerOf(tokenId);
        require(msg.sender == tokenOwner || msg.sender == owner, "MycNodeRegistry: not authorized");

        HardwareBinding storage binding = _bindings[tokenId];
        require(binding.state == HardwareState.BOUND, "MycNodeRegistry: not bound");

        bytes32 did = binding.machineDid;
        delete machineToToken[did];
        binding.state = HardwareState.UNBOUND;
        binding.machineDid = bytes32(0);
        binding.bindingNonce += 1;

        emit MachineUnbound(tokenId, did, tokenOwner);
    }

    function getBinding(uint256 tokenId) external view returns (HardwareBinding memory) {
        return _bindings[tokenId];
    }

    function isMachineBound(uint256 tokenId) external view returns (bool) {
        return _bindings[tokenId].state == HardwareState.BOUND;
    }

    function getMachineOwner(bytes32 machineDid) external view returns (address) {
        uint256 tokenId = machineToToken[machineDid];
        if (tokenId == 0) return address(0);
        return IMycNodeLicense(licenseContract).ownerOf(tokenId);
    }

    function _recoverSigner(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "MycNodeRegistry: invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "MycNodeRegistry: invalid v");
        return ecrecover(digest, v, r, s);
    }
}
