// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycAgentRegistry
 * @notice On-Chain Agent Identity and Capability Directory
 */
contract MycAgentRegistry {
    struct AgentProfile {
        string agentId;
        address operator;
        string name;
        string[] capabilities;
        bytes32 policyHash;
        uint256 registeredAt;
        bool isActive;
    }

    mapping(string => AgentProfile) public agents;
    string[] public allAgentIds;

    event AgentRegistered(string indexed agentId, address indexed operator, string name);
    event AgentStatusChanged(string indexed agentId, bool isActive);

    function registerAgent(
        string calldata agentId,
        string calldata name,
        string[] calldata capabilities,
        bytes32 policyHash
    ) external {
        require(agents[agentId].registeredAt == 0, "AGENT_ALREADY_REGISTERED");

        agents[agentId] = AgentProfile({
            agentId: agentId,
            operator: msg.sender,
            name: name,
            capabilities: capabilities,
            policyHash: policyHash,
            registeredAt: block.timestamp,
            isActive: true
        });

        allAgentIds.push(agentId);
        emit AgentRegistered(agentId, msg.sender, name);
    }

    function setAgentStatus(string calldata agentId, bool isActive) external {
        require(agents[agentId].registeredAt > 0, "AGENT_NOT_FOUND");
        require(agents[agentId].operator == msg.sender, "UNAUTHORIZED_OPERATOR");
        agents[agentId].isActive = isActive;
        emit AgentStatusChanged(agentId, isActive);
    }

    function getAgent(string calldata agentId) external view returns (AgentProfile memory) {
        return agents[agentId];
    }
}
