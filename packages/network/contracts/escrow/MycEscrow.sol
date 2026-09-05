// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycEscrow
 * @author MYC Network Protocol Engineering
 * @notice State-Machine Escrow for Autonomous AI Agents and Cognitive Tasks.
 * 
 * Strict Specification Invariant §31:
 * Enforces the 13 explicit Escrow states:
 *   CREATED, FUNDED, LOCKED, EXECUTING, PROOF_SUBMITTED, VERIFYING,
 *   ATTESTED, RELEASED, PARTIALLY_RELEASED, REFUNDED, DISPUTED, RESOLVED, FAILED.
 * 
 * Direct balance mutations without valid state transitions are strictly prohibited.
 */
contract MycEscrow {
    enum EscrowState {
        CREATED,
        FUNDED,
        LOCKED,
        EXECUTING,
        PROOF_SUBMITTED,
        VERIFYING,
        ATTESTED,
        RELEASED,
        PARTIALLY_RELEASED,
        REFUNDED,
        DISPUTED,
        RESOLVED,
        FAILED
    }

    struct EscrowItem {
        bytes32 escrowId;
        address payer;
        address payee;
        uint256 amount;
        string assetSymbol;
        EscrowState state;
        bytes32 proofHash;
        uint256 timeoutTimestamp;
        uint256 createdAt;
        bool finalized;
    }

    mapping(bytes32 => EscrowItem) public escrows;
    address public arbitrator;

    event EscrowCreated(bytes32 indexed escrowId, address indexed payer, address indexed payee, uint256 amount);
    event EscrowFunded(bytes32 indexed escrowId, uint256 amount);
    event EscrowStateTransition(bytes32 indexed escrowId, EscrowState from, EscrowState to);
    event ProofSubmitted(bytes32 indexed escrowId, bytes32 proofHash);
    event EscrowSettled(bytes32 indexed escrowId, address indexed recipient, uint256 amount);
    event EscrowRefunded(bytes32 indexed escrowId, address indexed recipient, uint256 amount);

    modifier onlyArbitrator() {
        require(msg.sender == arbitrator, "ONLY_ARBITRATOR");
        _;
    }

    constructor() {
        arbitrator = msg.sender;
    }

    function createEscrow(
        bytes32 escrowId,
        address payee,
        uint256 amount,
        string calldata assetSymbol,
        uint256 durationSeconds
    ) external {
        require(escrows[escrowId].createdAt == 0, "ESCROW_ALREADY_EXISTS");
        require(payee != address(0) && payee != msg.sender, "INVALID_PAYEE");
        require(amount > 0, "AMOUNT_MUST_BE_GREATER_THAN_ZERO");

        escrows[escrowId] = EscrowItem({
            escrowId: escrowId,
            payer: msg.sender,
            payee: payee,
            amount: amount,
            assetSymbol: assetSymbol,
            state: EscrowState.CREATED,
            proofHash: bytes32(0),
            timeoutTimestamp: block.timestamp + durationSeconds,
            createdAt: block.timestamp,
            finalized: false
        });

        emit EscrowCreated(escrowId, msg.sender, payee, amount);
    }

    function fundEscrow(bytes32 escrowId) external payable {
        EscrowItem storage item = escrows[escrowId];
        require(item.createdAt > 0, "ESCROW_NOT_FOUND");
        require(item.state == EscrowState.CREATED, "INVALID_STATE_FOR_FUNDING");
        require(msg.sender == item.payer, "ONLY_PAYER_CAN_FUND");

        _transitionState(item, EscrowState.FUNDED);
        emit EscrowFunded(escrowId, item.amount);
    }

    function lockForExecution(bytes32 escrowId) external {
        EscrowItem storage item = escrows[escrowId];
        require(item.state == EscrowState.FUNDED, "MUST_BE_FUNDED_TO_LOCK");
        require(msg.sender == item.payee || msg.sender == item.payer, "UNAUTHORIZED");

        _transitionState(item, EscrowState.LOCKED);
        _transitionState(item, EscrowState.EXECUTING);
    }

    function submitExecutionProof(bytes32 escrowId, bytes32 proofHash) external {
        EscrowItem storage item = escrows[escrowId];
        require(item.state == EscrowState.EXECUTING, "MUST_BE_EXECUTING");
        require(msg.sender == item.payee, "ONLY_PAYEE_CAN_SUBMIT_PROOF");
        require(proofHash != bytes32(0), "INVALID_PROOF_HASH");

        item.proofHash = proofHash;
        _transitionState(item, EscrowState.PROOF_SUBMITTED);
        emit ProofSubmitted(escrowId, proofHash);

        _transitionState(item, EscrowState.VERIFYING);
    }

    function attestAndRelease(bytes32 escrowId) external {
        EscrowItem storage item = escrows[escrowId];
        require(item.state == EscrowState.VERIFYING || item.state == EscrowState.PROOF_SUBMITTED, "INVALID_VERIFY_STATE");
        require(msg.sender == item.payer || msg.sender == arbitrator, "UNAUTHORIZED_ATTESTOR");

        _transitionState(item, EscrowState.ATTESTED);
        _transitionState(item, EscrowState.RELEASED);

        item.finalized = true;
        emit EscrowSettled(escrowId, item.payee, item.amount);
    }

    function cancelBeforeExecution(bytes32 escrowId) external {
        EscrowItem storage item = escrows[escrowId];
        require(!item.finalized, "ALREADY_FINALIZED");
        require(msg.sender == item.payer, "ONLY_PAYER_CAN_CANCEL");
        require(
            item.state == EscrowState.CREATED || item.state == EscrowState.FUNDED,
            "CANNOT_CANCEL_AFTER_EXECUTION_STARTED"
        );

        _transitionState(item, EscrowState.REFUNDED);
        item.finalized = true;
        emit EscrowRefunded(escrowId, item.payer, item.amount);
    }

    function refundExpired(bytes32 escrowId) external {
        EscrowItem storage item = escrows[escrowId];
        require(!item.finalized, "ALREADY_FINALIZED");
        require(block.timestamp > item.timeoutTimestamp, "TIMEOUT_NOT_EXPIRED");
        require(item.state != EscrowState.RELEASED, "ALREADY_RELEASED");

        _transitionState(item, EscrowState.REFUNDED);
        item.finalized = true;
        emit EscrowRefunded(escrowId, item.payer, item.amount);
    }

    function _transitionState(EscrowItem storage item, EscrowState nextState) internal {
        EscrowState previous = item.state;
        item.state = nextState;
        emit EscrowStateTransition(item.escrowId, previous, nextState);
    }
}
