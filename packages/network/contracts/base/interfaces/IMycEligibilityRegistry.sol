// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMycEligibilityRegistry
 * @notice Compliance, sanctions-screening authorization, and EIP-712 permit signer registry
 */
interface IMycEligibilityRegistry {
    struct EligibilityPermit {
        address buyer;
        uint8 tierId;
        uint256 count;
        uint256 unitPrice;
        address currency;
        uint256 chainId;
        address saleContract;
        uint256 nonce;
        uint256 deadline;
        uint32 policyVersion;
    }

    event PermitSignerUpdated(address indexed signer, bool active);
    event PolicyVersionUpdated(uint32 indexed newVersion);
    event PermitConsumed(bytes32 indexed permitHash, address indexed buyer, uint256 indexed nonce);

    function verifyAndConsumePermit(
        EligibilityPermit calldata permit,
        bytes calldata signature
    ) external returns (bool);

    function isSigner(address account) external view returns (bool);
    function currentPolicyVersion() external view returns (uint32);
    function isPermitConsumed(bytes32 permitHash) external view returns (bool);
}
