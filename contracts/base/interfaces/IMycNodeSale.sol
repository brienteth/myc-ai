// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IMycEligibilityRegistry.sol";

/**
 * @title IMycNodeSale
 * @notice Multi-tier Node License sale contract supporting USDC and ETH with Chainlink staleness guards
 */
interface IMycNodeSale {
    struct Tier {
        uint256 priceUSD; // In USD with 18 decimals
        uint32 supplyCap;
        uint32 minted;
        bool active;
    }

    struct TreasuryAllocation {
        address pol;            // 40% Protocol-Owned Liquidity
        address treasuryReserve;// 25% Governed Treasury Reserve
        address rdFirmware;     // 20% R&D, Security Audits & Firmware
        address ecosystemGrants;// 15% Grants & Microcontroller Subsidies
    }

    event NodePurchasedWithUSDC(address indexed buyer, uint8 indexed tierId, uint256 count, uint256 totalUSDC, address referrer);
    event NodePurchasedWithETH(address indexed buyer, uint8 indexed tierId, uint256 count, uint256 totalETH, address referrer);
    event ReferralPaid(address indexed referrer, address indexed buyer, uint256 amount);
    event TreasuryDistributed(uint256 polAmount, uint256 reserveAmount, uint256 rdAmount, uint256 grantsAmount);

    function buyNodeWithUSDC(
        uint8 tierId,
        uint256 count,
        address referrer,
        IMycEligibilityRegistry.EligibilityPermit calldata permit,
        bytes calldata permitSignature
    ) external;

    function buyNodeWithETH(
        uint8 tierId,
        uint256 count,
        address referrer,
        IMycEligibilityRegistry.EligibilityPermit calldata permit,
        bytes calldata permitSignature
    ) external payable;

    function getTier(uint8 tierId) external view returns (Tier memory);
    function totalMinted() external view returns (uint32);
}
