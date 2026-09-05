// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycDeviceRegistry
 * @notice DePIN Machine Identity and Silicon PUF Hardware Registry
 */
contract MycDeviceRegistry {
    enum DeviceType { TURBINE, VALVE, PUMP, MOTOR, FAN, SENSOR, GATEWAY }

    struct DeviceRecord {
        string did;
        bytes32 pufPublicKey;
        DeviceType deviceType;
        uint16 baseRegister;
        uint16 maxRegister;
        uint256 registeredAt;
        uint256 lastHeartbeat;
        uint16 resonanceScoreBps; // 0 - 10000 basis points
        bool isActive;
        address operator;
    }

    mapping(string => DeviceRecord) public devices;
    string[] public registeredDids;
    address public admin;

    event DeviceRegistered(string indexed did, address indexed operator, DeviceType deviceType);
    event HeartbeatRecorded(string indexed did, uint16 resonanceScoreBps, uint256 timestamp);
    event DeviceStatusChanged(string indexed did, bool isActive);

    modifier onlyAdmin() {
        require(msg.sender == admin, "ONLY_ADMIN");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function registerDevice(
        string calldata did,
        bytes32 pufPublicKey,
        DeviceType deviceType,
        uint16 baseRegister,
        uint16 maxRegister
    ) external {
        require(devices[did].registeredAt == 0, "DEVICE_ALREADY_REGISTERED");
        require(baseRegister <= maxRegister, "INVALID_REGISTER_BOUNDS");

        devices[did] = DeviceRecord({
            did: did,
            pufPublicKey: pufPublicKey,
            deviceType: deviceType,
            baseRegister: baseRegister,
            maxRegister: maxRegister,
            registeredAt: block.timestamp,
            lastHeartbeat: block.timestamp,
            resonanceScoreBps: 10000,
            isActive: true,
            operator: msg.sender
        });

        registeredDids.push(did);
        emit DeviceRegistered(did, msg.sender, deviceType);
    }

    function recordHeartbeat(string calldata did, uint16 resonanceScoreBps) external {
        require(devices[did].registeredAt > 0, "DEVICE_NOT_FOUND");
        require(msg.sender == devices[did].operator || msg.sender == admin, "UNAUTHORIZED");

        devices[did].lastHeartbeat = block.timestamp;
        devices[did].resonanceScoreBps = resonanceScoreBps;
        emit HeartbeatRecorded(did, resonanceScoreBps, block.timestamp);
    }

    function setDeviceStatus(string calldata did, bool isActive) external {
        require(devices[did].registeredAt > 0, "DEVICE_NOT_FOUND");
        require(msg.sender == devices[did].operator || msg.sender == admin, "UNAUTHORIZED");
        devices[did].isActive = isActive;
        emit DeviceStatusChanged(did, isActive);
    }

    function getDeviceCount() external view returns (uint256) {
        return registeredDids.length;
    }
}
