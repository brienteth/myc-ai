// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Minimal interface for ERC20 with standard transferFrom and transfer
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
}

interface IMycNodeLicense {
    function mintLicense(address to, uint8 tierId) external returns (uint256);
}

/**
 * @title HodlerAirdropVault
 * @notice Distributes 20% of deposited $MIND from the Node Portal to wallets holding >= 20,000 $MIND
 */
contract HodlerAirdropVault {
    address public owner;
    address public portalContract;
    IERC20 public mindToken;

    uint256 public constant MIN_HOLD_REQUIREMENT = 20_000 * 10**18; // 20,000 $MIND
    uint256 public totalAirdropReceived;
    uint256 public totalAirdropClaimed;

    mapping(address => uint256) public claimedByAccount;
    mapping(address => uint256) public lastClaimTimestamp;

    event AirdropFunded(uint256 amount, uint256 totalPool);
    event AirdropClaimed(address indexed holder, uint256 amount);
    event PortalUpdated(address indexed newPortal);

    modifier onlyOwner() {
        require(msg.sender == owner, "Vault: not owner");
        _;
    }

    modifier onlyPortal() {
        require(msg.sender == portalContract, "Vault: only portal");
        _;
    }

    constructor(address _mindToken) {
        owner = msg.sender;
        mindToken = IERC20(_mindToken);
    }

    function setPortalContract(address _portal) external onlyOwner {
        require(_portal != address(0), "Vault: zero address");
        portalContract = _portal;
        emit PortalUpdated(_portal);
    }

    /**
     * @notice Called by MindNodeClaimPortal to register incoming 20% airdrop share
     */
    function notifyDeposit(uint256 amount) external onlyPortal {
        totalAirdropReceived += amount;
        emit AirdropFunded(amount, totalAirdropReceived);
    }

    /**
     * @notice Check whether an account is eligible and compute claimable rewards
     */
    function getClaimableAirdrop(address holder) public view returns (uint256) {
        uint256 balance = mindToken.balanceOf(holder);
        if (balance < MIN_HOLD_REQUIREMENT) {
            return 0;
        }

        uint256 poolBalance = mindToken.balanceOf(address(this));
        if (poolBalance == 0) return 0;

        // Proportional share based on balance against an estimated eligible supply baseline (or fixed batch drip)
        // 0.1% max drip per claim cycle (1 day cooldown)
        uint256 baseDrip = (balance * poolBalance) / (600_000_000 * 10**18);
        if (baseDrip > poolBalance) {
            baseDrip = poolBalance;
        }
        return baseDrip;
    }

    /**
     * @notice Claim accumulated airdrop share
     */
    function claimAirdrop() external {
        uint256 claimable = getClaimableAirdrop(msg.sender);
        require(claimable > 0, "Vault: no claimable airdrop or balance < 20,000 MIND");
        require(block.timestamp >= lastClaimTimestamp[msg.sender] + 1 days, "Vault: cooldown 24h active");

        lastClaimTimestamp[msg.sender] = block.timestamp;
        claimedByAccount[msg.sender] += claimable;
        totalAirdropClaimed += claimable;

        require(mindToken.transfer(msg.sender, claimable), "Vault: transfer failed");
        emit AirdropClaimed(msg.sender, claimable);
    }
}

/**
 * @title MindNodeClaimPortal
 * @notice Allows users to deposit $MIND tokens to claim MYCA Living Spore Node NFTs
 * @dev 60% of total supply (600,000,000 $MIND) allocated for 2,000 Genesis Node NFTs:
 *      - 300,000 $MIND per Node NFT
 *      - 80% (240,000 $MIND) burned permanently to 0x000...dEaD
 *      - 20% (60,000 $MIND) sent to HodlerAirdropVault
 */
contract MindNodeClaimPortal {
    address public owner;
    IERC20 public mindToken;
    IMycNodeLicense public nodeLicense;
    HodlerAirdropVault public airdropVault;

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    uint256 public constant NODE_PRICE = 300_000 * 10**18; // 300,000 $MIND per Node NFT
    uint256 public constant MAX_GENESIS_NODES = 2_000;      // 2,000 total Node NFTs
    uint256 public constant TOTAL_MIND_CAP = 600_000_000 * 10**18; // 60% of 1B supply
    
    uint256 public totalNodesMinted;
    uint256 public totalMindDeposited;
    uint256 public totalMindBurned;
    uint256 public totalMindToAirdrop;

    bool public portalActive = true;

    event NodeClaimedViaMind(
        address indexed buyer,
        uint256 count,
        uint256 totalMindDeposited,
        uint256 amountBurned,
        uint256 amountToAirdrop,
        uint256 startingTokenId
    );

    event PortalStateChanged(bool active);

    modifier onlyOwner() {
        require(msg.sender == owner, "Portal: not owner");
        _;
    }

    constructor(
        address _mindToken,
        address _nodeLicense,
        address payable _airdropVault
    ) {
        owner = msg.sender;
        mindToken = IERC20(_mindToken);
        nodeLicense = IMycNodeLicense(_nodeLicense);
        airdropVault = HodlerAirdropVault(_airdropVault);
    }

    function setPortalActive(bool _active) external onlyOwner {
        portalActive = _active;
        emit PortalStateChanged(_active);
    }

    function remainingNodes() public view returns (uint256) {
        if (totalNodesMinted >= MAX_GENESIS_NODES) return 0;
        return MAX_GENESIS_NODES - totalNodesMinted;
    }

    /**
     * @notice Deposit $MIND to claim one or more MYCA Genesis Spore Node NFTs
     * @param count Number of Node NFTs to purchase (e.g. 1, 2, 5)
     */
    function claimNodesWithMind(uint256 count) external {
        require(portalActive, "Portal: currently paused");
        require(count > 0, "Portal: count must be > 0");
        require(totalNodesMinted + count <= MAX_GENESIS_NODES, "Portal: exceeds max available nodes");

        uint256 totalMindCost = count * NODE_PRICE;
        require(mindToken.balanceOf(msg.sender) >= totalMindCost, "Portal: insufficient MIND balance");
        require(mindToken.allowance(msg.sender, address(this)) >= totalMindCost, "Portal: allowance insufficient");

        // 80% Burn / 20% Airdrop calculation
        uint256 burnAmount = (totalMindCost * 80) / 100;
        uint256 airdropAmount = totalMindCost - burnAmount;

        totalMindDeposited += totalMindCost;
        totalMindBurned += burnAmount;
        totalMindToAirdrop += airdropAmount;
        totalNodesMinted += count;

        // 1. Transfer 80% directly to 0x000...dEaD
        require(mindToken.transferFrom(msg.sender, DEAD_ADDRESS, burnAmount), "Portal: burn transfer failed");

        // 2. Transfer 20% to the Hodler Airdrop Vault
        require(mindToken.transferFrom(msg.sender, address(airdropVault), airdropAmount), "Portal: airdrop transfer failed");
        airdropVault.notifyDeposit(airdropAmount);

        // 3. Mint MYCA Spore Node NFT(s) (Tier 1 = Spore Node)
        uint256 firstTokenId = 0;
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = nodeLicense.mintLicense(msg.sender, 1);
            if (i == 0) firstTokenId = tokenId;
        }

        emit NodeClaimedViaMind(msg.sender, count, totalMindCost, burnAmount, airdropAmount, firstTokenId);
    }
}
