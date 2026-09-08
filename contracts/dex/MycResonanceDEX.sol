// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycResonanceDEX
 * @notice Constant Product AMM (x * y = k) for MYC/USDT Liquidity and Swaps
 */
contract MycResonanceDEX {
    uint256 public reserveMYC;
    uint256 public reserveUSDT;
    uint256 public totalLiquidityShares;

    mapping(address => uint256) public liquidityShares;

    event LiquidityAdded(address indexed provider, uint256 amountMYC, uint256 amountUSDT, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 amountMYC, uint256 amountUSDT, uint256 shares);
    event Swap(address indexed user, string tokenIn, uint256 amountIn, uint256 amountOut);

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

        // 0.3% fee: amountInWithFee = amountIn * 997
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        return numerator / denominator;
    }

    function swapMYCForUSDT(uint256 amountMYCIn) external returns (uint256 amountUSDTOut) {
        amountUSDTOut = getAmountOut(amountMYCIn, reserveMYC, reserveUSDT);
        require(amountUSDTOut > 0, "INSUFFICIENT_OUTPUT_AMOUNT");

        reserveMYC += amountMYCIn;
        reserveUSDT -= amountUSDTOut;

        emit Swap(msg.sender, "MYC", amountMYCIn, amountUSDTOut);
        return amountUSDTOut;
    }

    function swapUSDTForMYC(uint256 amountUSDTIn) external returns (uint256 amountMYCOut) {
        amountMYCOut = getAmountOut(amountUSDTIn, reserveUSDT, reserveMYC);
        require(amountMYCOut > 0, "INSUFFICIENT_OUTPUT_AMOUNT");

        reserveUSDT += amountUSDTIn;
        reserveMYC -= amountMYCOut;

        emit Swap(msg.sender, "USDT", amountUSDTIn, amountMYCOut);
        return amountMYCOut;
    }
}
