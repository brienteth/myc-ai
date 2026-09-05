// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycNodeRegistry
 * @notice On-Chain Node Directory with Strict Role Separation
 */
contract MycNodeRegistry {
    struct NodeEntry {
        bytes32 nodeId;
        address nodeAddress;
        string[] roles;
        uint256 registeredAt;
        bool isWhitelisted;
    }

    mapping(bytes32 => NodeEntry) public nodes;
    bytes32[] public allNodeIds;

    event NodeRegistered(bytes32 indexed nodeId, address indexed nodeAddress);

    function registerNode(bytes32 nodeId, string[] calldata roles) external {
        require(nodes[nodeId].registeredAt == 0, "NODE_ALREADY_REGISTERED");
        nodes[nodeId] = NodeEntry({
            nodeId: nodeId,
            nodeAddress: msg.sender,
            roles: roles,
            registeredAt: block.timestamp,
            isWhitelisted: true
        });
        allNodeIds.push(nodeId);
        emit NodeRegistered(nodeId, msg.sender);
    }
}
