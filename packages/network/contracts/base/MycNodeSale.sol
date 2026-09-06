// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IMycNodeSale.sol";
import "./interfaces/IMycNodeLicense.sol";
import "./interfaces/IMycEligibilityRegistry.sol";

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

interface IAggregatorV3 {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

/**
 * @title MycNodeSale
 * @notice Hardened Production-v2.1 Node License sale contract on Base L2
 */
contract MycNodeSale is IMycNodeSale {
    address public owner;
    address public guardian;
    bool public paused;
    bool private _locked;

    IMycNodeLicense public nodeLicense;
    IMycEligibilityRegistry public eligibilityRegistry;
    IERC20 public usdc;
    IAggregatorV3 public ethUsdPriceFeed;

    uint256 public constant MAX_STALENESS = 3600 seconds;
    uint32 public override totalMinted;
    uint32 public constant GLOBAL_HARDCAP = 10000;

    mapping(uint8 => Tier) public tiers;
    TreasuryAllocation public treasury;

    // Referrer => accrued claimable USDC rewards (5%)
    mapping(address => uint256) public referralBalancesUSDC;
    mapping(address => uint256) public referralBalancesETH;

    modifier onlyOwner() {
        require(msg.sender == owner, "MycNodeSale: not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "MycNodeSale: paused");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "MycNodeSale: reentrancy guard");
        _locked = true;
        _;
        _locked = false;
    }

    constructor(
        address _nodeLicense,
        address _eligibilityRegistry,
        address _usdc,
        address _ethUsdPriceFeed,
        TreasuryAllocation memory _treasury
    ) {
        owner = msg.sender;
        guardian = msg.sender;
        nodeLicense = IMycNodeLicense(_nodeLicense);
        eligibilityRegistry = IMycEligibilityRegistry(_eligibilityRegistry);
        usdc = IERC20(_usdc);
        ethUsdPriceFeed = IAggregatorV3(_ethUsdPriceFeed);
        treasury = _treasury;

        // Initialize 4 Hardened Tiers
        tiers[1] = Tier({ priceUSD: 299 * 1e18, supplyCap: 1000, minted: 0, active: true });
        tiers[2] = Tier({ priceUSD: 449 * 1e18, supplyCap: 2500, minted: 0, active: true });
        tiers[3] = Tier({ priceUSD: 699 * 1e18, supplyCap: 4000, minted: 0, active: true });
        tiers[4] = Tier({ priceUSD: 1099 * 1e18, supplyCap: 2500, minted: 0, active: true });
    }

    function pause() external {
        require(msg.sender == owner || msg.sender == guardian, "MycNodeSale: not authorized to pause");
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    function setTreasury(TreasuryAllocation calldata _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function buyNodeWithUSDC(
        uint8 tierId,
        uint256 count,
        address referrer,
        IMycEligibilityRegistry.EligibilityPermit calldata permit,
        bytes calldata permitSignature
    ) external override whenNotPaused nonReentrant {
        require(count > 0 && count <= 50, "MycNodeSale: invalid count");
        Tier storage t = tiers[tierId];
        require(t.active, "MycNodeSale: tier not active");
        require(t.minted + count <= t.supplyCap, "MycNodeSale: tier sold out");
        require(totalMinted + count <= GLOBAL_HARDCAP, "MycNodeSale: global cap reached");

        // Verify EIP-712 Compliance Permit
        require(permit.buyer == msg.sender, "MycNodeSale: permit buyer mismatch");
        require(permit.tierId == tierId, "MycNodeSale: permit tier mismatch");
        require(permit.count == count, "MycNodeSale: permit count mismatch");
        require(permit.currency == address(usdc), "MycNodeSale: permit currency mismatch");
        require(permit.saleContract == address(this), "MycNodeSale: permit contract mismatch");
        require(eligibilityRegistry.verifyAndConsumePermit(permit, permitSignature), "MycNodeSale: invalid permit");

        uint8 usdcDec = usdc.decimals();
        uint256 unitPriceUSDC = (t.priceUSD * (10 ** usdcDec)) / 1e18;
        uint256 totalCostUSDC = unitPriceUSDC * count;

        // State update (Checks-Effects)
        t.minted += uint32(count);
        totalMinted += uint32(count);

        // Mint licenses
        for (uint256 i = 0; i < count; i++) {
            nodeLicense.mintLicense(msg.sender, tierId);
        }

        // Referral handling (5%)
        uint256 referralShare = 0;
        if (referrer != address(0) && referrer != msg.sender) {
            referralShare = (totalCostUSDC * 500) / 10000;
            referralBalancesUSDC[referrer] += referralShare;
            emit ReferralPaid(referrer, msg.sender, referralShare);
        }

        // Transfer USDC from buyer
        require(usdc.transferFrom(msg.sender, address(this), totalCostUSDC), "MycNodeSale: USDC transfer failed");

        // Distribute remaining proceeds to Treasury (40% / 25% / 20% / 15%)
        uint256 netProceeds = totalCostUSDC - referralShare;
        _distributeUSDC(netProceeds);

        emit NodePurchasedWithUSDC(msg.sender, tierId, count, totalCostUSDC, referrer);
    }

    function buyNodeWithETH(
        uint8 tierId,
        uint256 count,
        address referrer,
        IMycEligibilityRegistry.EligibilityPermit calldata permit,
        bytes calldata permitSignature
    ) external payable override whenNotPaused nonReentrant {
        require(count > 0 && count <= 50, "MycNodeSale: invalid count");
        Tier storage t = tiers[tierId];
        require(t.active, "MycNodeSale: tier not active");
        require(t.minted + count <= t.supplyCap, "MycNodeSale: tier sold out");
        require(totalMinted + count <= GLOBAL_HARDCAP, "MycNodeSale: global cap reached");

        // Verify EIP-712 Compliance Permit
        require(permit.buyer == msg.sender, "MycNodeSale: permit buyer mismatch");
        require(permit.tierId == tierId, "MycNodeSale: permit tier mismatch");
        require(permit.count == count, "MycNodeSale: permit count mismatch");
        require(permit.currency == address(0), "MycNodeSale: permit currency mismatch for ETH");
        require(permit.saleContract == address(this), "MycNodeSale: permit contract mismatch");
        require(eligibilityRegistry.verifyAndConsumePermit(permit, permitSignature), "MycNodeSale: invalid permit");

        // Chainlink Oracle with Hardened Staleness Check
        ( , int256 answer, , uint256 updatedAt, ) = ethUsdPriceFeed.latestRoundData();
        require(answer > 0, "MycNodeSale: invalid oracle price");
        require(updatedAt != 0, "MycNodeSale: incomplete oracle round");
        require(block.timestamp - updatedAt <= MAX_STALENESS, "MycNodeSale: stale oracle price");

        uint8 feedDec = ethUsdPriceFeed.decimals();
        uint256 ethPriceUSD = uint256(answer); // in feedDec decimals
        uint256 totalUSD = t.priceUSD * count; // in 18 decimals
        uint256 requiredETH = (totalUSD * (10 ** feedDec)) / ethPriceUSD;

        require(msg.value >= requiredETH, "MycNodeSale: insufficient ETH sent");

        // State update (Checks-Effects)
        t.minted += uint32(count);
        totalMinted += uint32(count);

        // Mint licenses
        for (uint256 i = 0; i < count; i++) {
            nodeLicense.mintLicense(msg.sender, tierId);
        }

        // Referral handling (5%)
        uint256 referralShare = 0;
        if (referrer != address(0) && referrer != msg.sender) {
            referralShare = (requiredETH * 500) / 10000;
            referralBalancesETH[referrer] += referralShare;
            emit ReferralPaid(referrer, msg.sender, referralShare);
        }

        // Distribute net ETH proceeds
        uint256 netETH = requiredETH - referralShare;
        _distributeETH(netETH);

        // Refund excess ETH
        if (msg.value > requiredETH) {
            uint256 refund = msg.value - requiredETH;
            (bool refSuccess, ) = payable(msg.sender).call{value: refund}("");
            require(refSuccess, "MycNodeSale: refund failed");
        }

        emit NodePurchasedWithETH(msg.sender, tierId, count, requiredETH, referrer);
    }

    function claimReferralUSDC() external nonReentrant {
        uint256 amount = referralBalancesUSDC[msg.sender];
        require(amount > 0, "MycNodeSale: zero balance");
        referralBalancesUSDC[msg.sender] = 0;
        require(usdc.transfer(msg.sender, amount), "MycNodeSale: transfer failed");
    }

    function claimReferralETH() external nonReentrant {
        uint256 amount = referralBalancesETH[msg.sender];
        require(amount > 0, "MycNodeSale: zero balance");
        referralBalancesETH[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "MycNodeSale: transfer failed");
    }

    function _distributeUSDC(uint256 amount) internal {
        uint256 pol = (amount * 4000) / 10000; // 40%
        uint256 res = (amount * 2500) / 10000; // 25%
        uint256 rd = (amount * 2000) / 10000;  // 20%
        uint256 grants = amount - pol - res - rd; // Remaining 15% (conserves dust)

        usdc.transfer(treasury.pol, pol);
        usdc.transfer(treasury.treasuryReserve, res);
        usdc.transfer(treasury.rdFirmware, rd);
        usdc.transfer(treasury.ecosystemGrants, grants);

        emit TreasuryDistributed(pol, res, rd, grants);
    }

    function _distributeETH(uint256 amount) internal {
        uint256 pol = (amount * 4000) / 10000;
        uint256 res = (amount * 2500) / 10000;
        uint256 rd = (amount * 2000) / 10000;
        uint256 grants = amount - pol - res - rd;

        payable(treasury.pol).transfer(pol);
        payable(treasury.treasuryReserve).transfer(res);
        payable(treasury.rdFirmware).transfer(rd);
        payable(treasury.ecosystemGrants).transfer(grants);

        emit TreasuryDistributed(pol, res, rd, grants);
    }

    function getTier(uint8 tierId) external view override returns (Tier memory) {
        return tiers[tierId];
    }
}
