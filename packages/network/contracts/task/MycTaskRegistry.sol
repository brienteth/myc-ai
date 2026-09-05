// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycTaskRegistry
 * @notice On-Chain Task Lifecycle and Escrow Binding
 */
contract MycTaskRegistry {
    enum TaskStatus { CREATED, ASSIGNED, EXECUTING, COMPLETED, FAILED, REFUNDED }

    struct TaskRecord {
        bytes32 taskId;
        address creator;
        address assignedNode;
        bytes32 escrowId;
        string requiredCapability;
        bytes32 proofHash;
        TaskStatus status;
        uint256 createdAt;
    }

    mapping(bytes32 => TaskRecord) public tasks;

    event TaskCreated(bytes32 indexed taskId, address indexed creator, bytes32 escrowId);
    event TaskAssigned(bytes32 indexed taskId, address indexed assignedNode);
    event TaskCompleted(bytes32 indexed taskId, bytes32 proofHash);

    function registerTask(
        bytes32 taskId,
        bytes32 escrowId,
        string calldata requiredCapability
    ) external {
        require(tasks[taskId].createdAt == 0, "TASK_ALREADY_EXISTS");

        tasks[taskId] = TaskRecord({
            taskId: taskId,
            creator: msg.sender,
            assignedNode: address(0),
            escrowId: escrowId,
            requiredCapability: requiredCapability,
            proofHash: bytes32(0),
            status: TaskStatus.CREATED,
            createdAt: block.timestamp
        });

        emit TaskCreated(taskId, msg.sender, escrowId);
    }

    function assignTask(bytes32 taskId, address node) external {
        TaskRecord storage record = tasks[taskId];
        require(record.createdAt > 0, "TASK_NOT_FOUND");
        require(msg.sender == record.creator, "ONLY_CREATOR_CAN_ASSIGN");
        record.assignedNode = node;
        record.status = TaskStatus.ASSIGNED;
        emit TaskAssigned(taskId, node);
    }

    function completeTask(bytes32 taskId, bytes32 proofHash) external {
        TaskRecord storage record = tasks[taskId];
        require(record.createdAt > 0, "TASK_NOT_FOUND");
        require(msg.sender == record.assignedNode || msg.sender == record.creator, "UNAUTHORIZED");

        record.proofHash = proofHash;
        record.status = TaskStatus.COMPLETED;
        emit TaskCompleted(taskId, proofHash);
    }
}
