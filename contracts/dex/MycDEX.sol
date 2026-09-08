// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycDEX
 * @author MYC Network Protocol Engineering
 * @notice Constant Product AMM (x * y = k) for MYC/USDT Liquidity and Swaps.
 * Includes Slippage Protection, Whale Guard, and Zero-Gas compatibility.
 */
contract MycDEX {
    uint256 public reserveMYC;
    uint256 public reserveUSDT;
    uint256 public totalLiquidityShares;

    // Security parameters
    uint256 public constant MAX_TRADE_PERCENT_BPS = 200; // 2% max pool size
    uint256 public constant FEE_BPS = 30; // 0.3%

    mapping(address => uint256) public liquidityShares;
    mapping(address => uint256) public lastSwapTimestamp;

    event LiquidityAdded(address indexed provider, uint256 amountMYC, uint256 amountUSDT, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 amountMYC, uint256 amountUSDT, uint256 shares);
    event Swap(address indexed user, string tokenIn, string tokenOut, uint256 amountIn, uint256 amountOut);

    constructor(uint256 initialMYC, uint256 initialUSDT) {
        require(initialMYC > 0 && initialUSDT > 0, "INVALID_INITIAL_RESERVES");
        reserveMYC = initialMYC;
        reserveUSDT = initialUSDT;
        totalLiquidityShares = 10000;
        liquidityShares[msg.sender] = 10000;
        emit LiquidityAdded(msg.sender, initialMYC, initialUSDT, 10000);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        require(amountIn > 0, "INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQUIDITY");

        // 0.3% fee: amountInWithFee = amountIn * (10000 - FEE_BPS) / 10000
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        return numerator / denominator;
    }

    function swapMYCForUSDT(uint256 amountMYCIn, uint256 minAmountUSDTOut) external returns (uint256 amountUSDTOut) {
        // Whale Guard: max 2% of reserveMYC
        require(amountMYCIn <= (reserveMYC * MAX_TRADE_PERCENT_BPS) / 10000, "WHALE_GUARD_EXCEEDED");

        amountUSDTOut = getAmountOut(amountMYCIn, reserveMYC, reserveUSDT);
        require(amountUSDTOut >= minAmountUSDTOut, "SLIPPAGE_EXCEEDED");
        require(amountUSDTOut > 0, "INSUFFICIENT_OUTPUT_AMOUNT");

        reserveMYC += amountMYCIn;
        reserveUSDT -= amountUSDTOut;
        lastSwapTimestamp[msg.sender] = block.timestamp;

        emit Swap(msg.sender, "MYC", "USDT", amountMYCIn, amountUSDTOut);
        return amountUSDTOut;
    }

    function swapUSDTForMYC(uint256 amountUSDTIn, uint256 minAmountMYCOut) external returns (uint256 amountMYCOut) {
        // Whale Guard: max 2% of reserveUSDT
        require(amountUSDTIn <= (reserveUSDT * MAX_TRADE_PERCENT_BPS) / 10000, "WHALE_GUARD_EXCEEDED");

        amountMYCOut = getAmountOut(amountUSDTIn, reserveUSDT, reserveMYC);
        require(amountMYCOut >= minAmountMYCOut, "SLIPPAGE_EXCEEDED");
        require(amountMYCOut > 0, "INSUFFICIENT_OUTPUT_AMOUNT");

        reserveUSDT += amountUSDTIn;
        reserveMYC -= amountMYCOut;
        lastSwapTimestamp[msg.sender] = block.timestamp;

        emit Swap(msg.sender, "USDT", "MYC", amountUSDTIn, amountMYCOut);
        return amountMYCOut;
    }
}
