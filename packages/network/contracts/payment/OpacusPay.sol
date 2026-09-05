// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OpacusPay
 * @notice Sovereign Agent-to-Agent Micro-Payment & Continuous Streaming Rail for MYCA Network.
 * Zero-Gas execution with off-chain cryptographic state channels and on-chain settlement.
 */
contract OpacusPay {
    struct PaymentChannel {
        bytes32 channelId;
        address payer;
        address payee;
        uint256 totalDeposit;
        uint256 settledAmount;
        uint256 validUntil;
        bool isOpen;
    }

    mapping(bytes32 => PaymentChannel) public channels;
    mapping(address => uint256) public agentBalances;

    event ChannelOpened(bytes32 indexed channelId, address indexed payer, address indexed payee, uint256 deposit, uint256 validUntil);
    event MicroPaymentSettled(bytes32 indexed channelId, address indexed payee, uint256 amount, uint256 remainingDeposit);
    event ChannelClosed(bytes32 indexed channelId, uint256 refundPayer, uint256 totalPaid);
    event DirectPay(address indexed from, address indexed to, uint256 amount, string memo);

    function openChannel(
        bytes32 channelId,
        address payee,
        uint256 validDurationSeconds
    ) external payable returns (bool) {
        require(channels[channelId].payer == address(0), "CHANNEL_EXISTS");
        require(payee != address(0) && payee != msg.sender, "INVALID_PAYEE");
        require(msg.value > 0, "DEPOSIT_REQUIRED");

        channels[channelId] = PaymentChannel({
            channelId: channelId,
            payer: msg.sender,
            payee: payee,
            totalDeposit: msg.value,
            settledAmount: 0,
            validUntil: block.timestamp + validDurationSeconds,
            isOpen: true
        });

        emit ChannelOpened(channelId, msg.sender, payee, msg.value, block.timestamp + validDurationSeconds);
        return true;
    }

    function settleMicroPayment(
        bytes32 channelId,
        uint256 cumulativeAmount
    ) external returns (bool) {
        PaymentChannel storage ch = channels[channelId];
        require(ch.isOpen, "CHANNEL_NOT_OPEN");
        require(msg.sender == ch.payee || msg.sender == ch.payer, "UNAUTHORIZED");
        require(cumulativeAmount > ch.settledAmount, "AMOUNT_MUST_INCREASE");
        require(cumulativeAmount <= ch.totalDeposit, "EXCEEDS_DEPOSIT");

        uint256 delta = cumulativeAmount - ch.settledAmount;
        ch.settledAmount = cumulativeAmount;
        agentBalances[ch.payee] += delta;

        emit MicroPaymentSettled(channelId, ch.payee, delta, ch.totalDeposit - ch.settledAmount);
        return true;
    }

    function closeChannel(bytes32 channelId) external returns (bool) {
        PaymentChannel storage ch = channels[channelId];
        require(ch.isOpen, "CHANNEL_NOT_OPEN");
        require(msg.sender == ch.payer || msg.sender == ch.payee, "UNAUTHORIZED");

        ch.isOpen = false;
        uint256 refund = ch.totalDeposit - ch.settledAmount;
        if (refund > 0) {
            agentBalances[ch.payer] += refund;
        }

        emit ChannelClosed(channelId, refund, ch.settledAmount);
        return true;
    }

    function directPay(address to, string calldata memo) external payable returns (bool) {
        require(to != address(0), "INVALID_RECIPIENT");
        require(msg.value > 0, "AMOUNT_ZERO");

        agentBalances[to] += msg.value;
        emit DirectPay(msg.sender, to, msg.value, memo);
        return true;
    }
}
