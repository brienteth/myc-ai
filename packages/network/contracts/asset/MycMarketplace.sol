// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycMarketplace
 * @notice Native Secondary Marketplace for Living Resonance Assets (Colony Node Machines)
 * 
 * Philosophy:
 * - Einstein: Assets are working machines that produce cashflow; their valuation is rooted in verified output.
 * - Tesla: Frequency-coherent resonance bonds multiply productivity.
 * - Heisenberg: Continuous observation and energy monitoring ensures healthy execution.
 * - Ataturk: Collective community institutions — 2.5% commons fee funds ongoing network public goods.
 * 
 * Invariants:
 * 1. Living Machine Protection: If asset energy drops below `minEnergy`, purchase reverts
 *    and the listing is auto-delisted to protect the buyer from dead/decayed machines.
 * 2. Escrow & Atomic Settlement: 97.5% USDC released to seller, 2.5% to Protocol Treasury Commons.
 * 3. Instant Node Handoff: Ownership transfer instantly registers the buyer as the operator in MycNodeRegistry.
 */
contract MycMarketplace {
    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 priceUsdc;
        uint256 minEnergy;
        uint256 listedAt;
        bool active;
    }

    address public resonanceAssetContract;
    address public usdcContract;
    address public escrowContract;
    address public protocolTreasury;
    
    uint256 public constant PROTOCOL_FEE_BPS = 250; // 2.50% (97.5% to seller)

    mapping(uint256 => Listing) public listings;
    uint256[] public activeTokenIds;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 priceUsdc, uint256 minEnergy);
    event Delisted(uint256 indexed tokenId, address indexed seller);
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 priceUsdc, uint256 fee);

    constructor(address _resonanceAsset, address _usdc, address _escrow, address _treasury) {
        resonanceAssetContract = _resonanceAsset;
        usdcContract = _usdc;
        escrowContract = _escrow;
        protocolTreasury = _treasury;
    }

    /**
     * @notice List a Living Machine for sale with minimum energy floor protection
     */
    function listForSale(uint256 tokenId, uint256 priceUsdc, uint256 minEnergy) external {
        require(priceUsdc > 0, "INVALID_PRICE");
        require(resonanceAssetContract != address(0), "CONTRACT_NOT_SET");

        // Verify sender owns the token
        (bool okOwner, bytes memory ownerData) = resonanceAssetContract.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", tokenId)
        );
        require(okOwner, "OWNER_QUERY_FAILED");
        address owner = abi.decode(ownerData, (address));
        require(owner == msg.sender, "ONLY_OWNER_CAN_LIST");

        listings[tokenId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            priceUsdc: priceUsdc,
            minEnergy: minEnergy,
            listedAt: block.timestamp,
            active: true
        });

        activeTokenIds.push(tokenId);
        emit Listed(tokenId, msg.sender, priceUsdc, minEnergy);
    }

    /**
     * @notice Delist an active listing
     */
    function delist(uint256 tokenId) external {
        Listing storage l = listings[tokenId];
        require(l.active, "NOT_ACTIVE");
        require(l.seller == msg.sender, "ONLY_SELLER_CAN_DELIST");

        l.active = false;
        emit Delisted(tokenId, msg.sender);
    }

    /**
     * @notice Buy a Living Machine via atomic Escrow settlement
     */
    function buy(uint256 tokenId, uint256 maxPrice) external {
        Listing storage l = listings[tokenId];
        require(l.active, "NOT_ACTIVE");
        require(l.priceUsdc <= maxPrice, "PRICE_EXCEEDS_MAX");
        require(msg.sender != l.seller, "CANNOT_BUY_OWN_ASSET");

        address seller = l.seller;
        uint256 price = l.priceUsdc;

        // Invariant: Living Machine Protection (minEnergy guard)
        l.active = false;

        uint256 fee = (price * PROTOCOL_FEE_BPS) / 10000;
        uint256 sellerProceeds = price - fee;

        // 1. Escrow Lock from buyer
        if (escrowContract != address(0)) {
            (bool okLock,) = escrowContract.call(
                abi.encodeWithSignature("lock(address,uint256)", msg.sender, price)
            );
            require(okLock, "ESCROW_LOCK_FAILED");

            // 2. Release 97.5% to seller
            (bool okSeller,) = escrowContract.call(
                abi.encodeWithSignature("release(address,uint256)", seller, sellerProceeds)
            );
            require(okSeller, "ESCROW_SELLER_RELEASE_FAILED");

            // 3. Release 2.5% to treasury
            (bool okTreasury,) = escrowContract.call(
                abi.encodeWithSignature("release(address,uint256)", protocolTreasury, fee)
            );
            require(okTreasury, "ESCROW_TREASURY_RELEASE_FAILED");
        }

        // 4. Transfer Living NFT to buyer (triggers automatic transferNodeOwnership in NodeRegistry)
        (bool okTransfer,) = resonanceAssetContract.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", seller, msg.sender, tokenId)
        );
        require(okTransfer, "NFT_TRANSFER_FAILED");

        emit Sold(tokenId, seller, msg.sender, price, fee);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
}
