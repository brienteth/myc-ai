// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycPolicyRegistry
 * @notice On-Chain Verification of Deterministic Authorization Policies
 */
contract MycPolicyRegistry {
    struct Policy {
        bytes32 policyHash;
        address author;
        string policyAstJson;
        uint256 registeredAt;
        bool isActive;
    }

    mapping(bytes32 => Policy) public policies;
    event PolicyRegistered(bytes32 indexed policyHash, address indexed author);

    function registerPolicy(bytes32 policyHash, string calldata policyAstJson) external {
        require(policies[policyHash].registeredAt == 0, "POLICY_ALREADY_EXISTS");
        policies[policyHash] = Policy({
            policyHash: policyHash,
            author: msg.sender,
            policyAstJson: policyAstJson,
            registeredAt: block.timestamp,
            isActive: true
        });
        emit PolicyRegistered(policyHash, msg.sender);
    }
}
