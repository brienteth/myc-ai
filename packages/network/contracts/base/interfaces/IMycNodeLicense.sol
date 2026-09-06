// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMycNodeLicense
 * @notice Interface for the MYC Base DePIN Living Node License NFT
 */
interface IMycNodeLicense {
    enum LicenseStatus { ACTIVE, SUSPENDED, REVOKED }

    struct LicenseMetadata {
        uint8 tierId;
        uint64 mintTimestamp;
        uint32 serialNumber;
        LicenseStatus status;
    }

    event NodePurchased(address indexed buyer, uint256 indexed tokenId, uint8 indexed tierId, uint256 pricePaid);
    event LicenseStatusUpdated(uint256 indexed tokenId, LicenseStatus newStatus);
    event RegistryUpdated(address indexed registry);

    function mintLicense(address to, uint8 tierId) external returns (uint256);
    function getLicenseMetadata(uint256 tokenId) external view returns (LicenseMetadata memory);
    function exists(uint256 tokenId) external view returns (bool);
    function ownerOf(uint256 tokenId) external view returns (address);
}
