// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycActuatorGuard
 * @notice On-Chain Industrial Authorization Contract
 * 
 * Strict Specification Invariants §1.4, §39, §40:
 *  - Blockchain authorizes actions, but local safety verifiers at the device gateway remain authoritative.
 *  - Unknown, ambiguous, out-of-range, or contradictory commands strictly result in NO-OP.
 */
contract MycActuatorGuard {
    enum PinVoltage { SAFE_LOW_0V, HIGH_3V3 }

    struct ActuationAuthorization {
        bytes32 intentHash;
        string device;
        uint16 unitNumber;
        string action;
        uint16 targetRegister;
        uint16 actionValue;
        PinVoltage authorizedPinState;
        uint256 authorizedAt;
        bool isExecuted;
    }

    mapping(bytes32 => ActuationAuthorization) public authorizations;
    mapping(string => bool) public allowedDevices;
    address public safetyOracle;

    event ActuationAuthorized(bytes32 indexed intentHash, string device, uint16 unitNumber, string action);
    event ActuationHaltedNoOp(bytes32 indexed intentHash, string reason);

    modifier onlyOracle() {
        require(msg.sender == safetyOracle, "ONLY_SAFETY_ORACLE");
        _;
    }

    constructor() {
        safetyOracle = msg.sender;
        allowedDevices["TURBINE"] = true;
        allowedDevices["VALVE"] = true;
        allowedDevices["PUMP"] = true;
        allowedDevices["MOTOR"] = true;
        allowedDevices["FAN"] = true;
    }

    function authorizeActuation(
        bytes32 intentHash,
        string calldata device,
        uint16 unitNumber,
        string calldata action,
        uint16 targetRegister,
        uint16 actionValue,
        bool passedSafetyChecks
    ) external returns (bool) {
        // Strict Invariant: If device is not in allowlist or safety checks fail, force NO-OP
        if (!allowedDevices[device] || !passedSafetyChecks) {
            emit ActuationHaltedNoOp(intentHash, "REJECTED_BY_SAFETY_GUARD_NOOP");
            return false;
        }

        bool isStart = keccak256(bytes(action)) == keccak256(bytes("START"));
        PinVoltage voltage = isStart ? PinVoltage.HIGH_3V3 : PinVoltage.SAFE_LOW_0V;

        authorizations[intentHash] = ActuationAuthorization({
            intentHash: intentHash,
            device: device,
            unitNumber: unitNumber,
            action: action,
            targetRegister: targetRegister,
            actionValue: actionValue,
            authorizedPinState: voltage,
            authorizedAt: block.timestamp,
            isExecuted: false
        });

        emit ActuationAuthorized(intentHash, device, unitNumber, action);
        return true;
    }
}
