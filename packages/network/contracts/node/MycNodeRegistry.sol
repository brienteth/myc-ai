// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycNodeRegistry
 * @notice On-Chain Node Directory with Colony Peer & Resonance NFT Integration
 */
contract MycNodeRegistry {
    enum NodeRole { VALIDATOR, ACTUATOR, COLONY_PEER, DEPIN_GATEWAY }
    enum NodeTier { SEED, RESONANT, SOVEREIGN }

    struct NodeEntry {
        uint256 nodeId;          // NFT tokenId = nodeId
        address nodeAddress;     // Node Operator / Wallet
        address owner;           // NFT Holder (Beneficiary)
        address operator;        // Delegated hardware operator
        bool isDelegated;        // True if hardware tasks are delegated
        uint256 revenueShareOwner;    // Percentage to owner (e.g. 70)
        uint256 revenueShareOperator; // Percentage to operator (e.g. 30)
        uint256 minUptime;            // Required uptime SLA (e.g. 95)
        NodeRole role;
        NodeTier tier;
        uint256 energyScore;
        uint256 registeredAt;
        bool isWhitelisted;
        uint256 stakedNFT;
    }

    mapping(uint256 => NodeEntry) public nodes;
    uint256[] public allNodeIds;
    address public resonanceAssetContract;

    event NodeRegistered(uint256 indexed nodeId, address indexed nodeAddress);
    event NodeActivated(uint256 indexed nodeId, address indexed owner, NodeTier tier);
    event NodeTierUpdated(uint256 indexed nodeId, NodeTier newTier, uint256 newEnergy);
    event NodeOwnershipTransferred(uint256 indexed nodeId, address indexed oldOwner, address indexed newOwner);
    event NodeDelegated(uint256 indexed nodeId, address indexed owner, address indexed operator, uint256 revenueShareOwner);
    event NodeUndelegated(uint256 indexed nodeId, address indexed owner);

    modifier onlyResonanceAsset() {
        if (resonanceAssetContract != address(0)) {
            require(msg.sender == resonanceAssetContract, "ONLY_RESONANCE_ASSET");
        }
        _;
    }

    function setResonanceAssetContract(address _assetContract) external {
        resonanceAssetContract = _assetContract;
    }

    function registerNode(uint256 nodeId, address owner, NodeRole role, NodeTier tier, uint256 energy) external {
        require(nodes[nodeId].registeredAt == 0, "NODE_ALREADY_REGISTERED");
        nodes[nodeId] = NodeEntry({
            nodeId: nodeId,
            nodeAddress: owner,
            owner: owner,
            operator: owner,
            isDelegated: false,
            revenueShareOwner: 100,
            revenueShareOperator: 0,
            minUptime: 99,
            role: role,
            tier: tier,
            energyScore: energy,
            registeredAt: block.timestamp,
            isWhitelisted: true,
            stakedNFT: nodeId
        });
        allNodeIds.push(nodeId);
        emit NodeActivated(nodeId, owner, tier);
    }

    function updateNodeEnergy(uint256 nodeId, uint256 energy) external {
        NodeEntry storage n = nodes[nodeId];
        require(n.registeredAt != 0, "NODE_NONEXISTENT");
        n.energyScore = energy;
        if (energy < 3000) {
            n.tier = NodeTier.SEED;
        } else if (energy < 8000) {
            n.tier = NodeTier.RESONANT;
        } else {
            n.tier = NodeTier.SOVEREIGN;
        }
        emit NodeTierUpdated(nodeId, n.tier, energy);
    }

    function transferNodeOwnership(uint256 nodeId, address newOwner) external {
        NodeEntry storage n = nodes[nodeId];
        require(n.registeredAt != 0, "NODE_NONEXISTENT");
        require(msg.sender == n.owner || msg.sender == resonanceAssetContract, "UNAUTHORIZED");
        address old = n.owner;
        n.owner = newOwner;
        n.nodeAddress = newOwner;
        if (!n.isDelegated) {
            n.operator = newOwner;
        }
        emit NodeOwnershipTransferred(nodeId, old, newOwner);
    }

    function delegateNode(uint256 nodeId, address operator, uint256 revenueShareOwner, uint256 minUptime) external {
        NodeEntry storage n = nodes[nodeId];
        require(n.registeredAt != 0, "NODE_NONEXISTENT");
        require(msg.sender == n.owner || msg.sender == resonanceAssetContract, "UNAUTHORIZED");
        require(operator != address(0) && operator != n.owner, "INVALID_OPERATOR");
        require(revenueShareOwner <= 100, "INVALID_SHARE");

        n.operator = operator;
        n.nodeAddress = operator;
        n.isDelegated = true;
        n.revenueShareOwner = revenueShareOwner;
        n.revenueShareOperator = 100 - revenueShareOwner;
        n.minUptime = minUptime;

        emit NodeDelegated(nodeId, n.owner, operator, revenueShareOwner);
    }

    function undelegateNode(uint256 nodeId) external {
        NodeEntry storage n = nodes[nodeId];
        require(n.registeredAt != 0, "NODE_NONEXISTENT");
        require(msg.sender == n.owner || msg.sender == resonanceAssetContract, "UNAUTHORIZED");
        require(n.isDelegated, "NOT_DELEGATED");

        n.operator = n.owner;
        n.nodeAddress = n.owner;
        n.isDelegated = false;
        n.revenueShareOwner = 100;
        n.revenueShareOperator = 0;

        emit NodeUndelegated(nodeId, n.owner);
    }

    function getNode(uint256 nodeId) external view returns (NodeEntry memory) {
        return nodes[nodeId];
    }
}
