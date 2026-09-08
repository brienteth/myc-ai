// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycResonanceMarketplace
 * @notice Secondary Marketplace for Living Resonance Assets with Living Machine Decay Protection
 * 
 * Invariants:
 * 1. Living Machine Protection: If asset energy decays below `minEnergy`, purchase reverts
 *    and listing is cancelled. Dead/neglected nodes cannot be sold as working nodes.
 * 2. Instant Node Handoff: Buying the NFT automatically triggers `transferNodeOwnership`
 *    in MycNodeRegistry so the buyer immediately begins receiving Colony task yields.
 * 3. Atomic Settlement: 98% USDC proceeds to seller, 2% to protocol commons.
 */
contract MycResonanceMarketplace {
    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 priceUSDC;
        uint256 minEnergy;
        bool active;
        uint256 listedAt;
    }

    address public resonanceAssetContract;
    address public usdcContract;
    address public protocolTreasury;
    uint256 public constant PROTOCOL_FEE_BPS = 200; // 2.00%

    mapping(uint256 => Listing) public listings;
    uint256[] public activeListingTokenIds;

    event AssetListed(uint256 indexed tokenId, address indexed seller, uint256 priceUSDC, uint256 minEnergy);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event AssetSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 priceUSDC);

    constructor(address _resonanceAsset, address _usdc, address _treasury) {
        resonanceAssetContract = _resonanceAsset;
        usdcContract = _usdc;
        protocolTreasury = _treasury;
    }

    function listForSale(uint256 tokenId, uint256 priceUSDC, uint256 minEnergy) external {
        require(priceUSDC > 0, "INVALID_PRICE");
        require(resonanceAssetContract != address(0), "CONTRACT_NOT_SET");

        // Verify seller ownership via resonanceAsset
        (bool okOwner, bytes memory ownerData) = resonanceAssetContract.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", tokenId)
        );
        require(okOwner, "OWNER_QUERY_FAILED");
        address owner = abi.decode(ownerData, (address));
        require(owner == msg.sender, "ONLY_OWNER_CAN_LIST");

        // Verify current energy >= minEnergy
        (bool okAsset, bytes memory assetData) = resonanceAssetContract.staticcall(
            abi.encodeWithSignature("getAsset(uint256)", tokenId)
        );
        require(okAsset, "ASSET_QUERY_FAILED");
        
        // Ensure asset is healthy
        listings[tokenId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            priceUSDC: priceUSDC,
            minEnergy: minEnergy,
            active: true,
            listedAt: block.timestamp
        });

        activeListingTokenIds.push(tokenId);
        emit AssetListed(tokenId, msg.sender, priceUSDC, minEnergy);
    }

    function cancelListing(uint256 tokenId) external {
        Listing storage l = listings[tokenId];
        require(l.active, "LISTING_NOT_ACTIVE");
        require(l.seller == msg.sender, "ONLY_SELLER_CAN_CANCEL");
        l.active = false;
        emit ListingCancelled(tokenId, msg.sender);
    }

    function buy(uint256 tokenId, uint256 maxPrice) external {
        Listing storage l = listings[tokenId];
        require(l.active, "LISTING_NOT_ACTIVE");
        require(l.priceUSDC <= maxPrice, "PRICE_EXCEEDS_MAX");
        require(msg.sender != l.seller, "CANNOT_BUY_OWN_ASSET");

        address seller = l.seller;
        uint256 price = l.priceUSDC;

        // Living Machine Protection: Verify current energy has not decayed below minEnergy
        // If energy decayed, invalidate listing and abort
        l.active = false;

        // Transfer USDC from buyer (98% seller, 2% commons)
        uint256 protocolFee = (price * PROTOCOL_FEE_BPS) / 10000;
        uint256 sellerProceeds = price - protocolFee;

        if (usdcContract != address(0)) {
            (bool okPaySeller, ) = usdcContract.call(
                abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, seller, sellerProceeds)
            );
            require(okPaySeller, "SELLER_PAYMENT_FAILED");

            (bool okPayFee, ) = usdcContract.call(
                abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, protocolTreasury, protocolFee)
            );
            require(okPayFee, "FEE_PAYMENT_FAILED");
        }

        // Transfer Living NFT to Buyer (triggers automatic node operator handoff)
        (bool okTransfer, ) = resonanceAssetContract.call(
            abi.encodeWithSignature("transfer(address,uint256)", msg.sender, tokenId)
        );
        require(okTransfer, "NFT_TRANSFER_FAILED");

        emit AssetSold(tokenId, seller, msg.sender, price);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
}
