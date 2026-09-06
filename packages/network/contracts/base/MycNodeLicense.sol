// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IMycNodeLicense.sol";
import "./interfaces/IMycNodeRegistry.sol";

/**
 * @title MycNodeLicense
 * @notice ERC-721 + ERC-2981 Node License NFT for MYC Base DePIN
 * @dev Enforces hardware unbinding on transfer via hook without requiring ERC721Enumerable
 */
contract MycNodeLicense is IMycNodeLicense {
    string public name;
    string public symbol;

    address public owner;
    address public minter;
    address public guardian;
    IMycNodeRegistry public nodeRegistry;

    bool public paused;
    uint256 private _nextTokenId = 1;

    // Royalty support (EIP-2981)
    address public royaltyReceiver;
    uint96 public royaltyFeeBps = 500; // 5%

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    mapping(uint256 => LicenseMetadata) private _licenseData;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event Paused(address account);
    event Unpaused(address account);

    modifier onlyOwner() {
        require(msg.sender == owner, "MycNodeLicense: not owner");
        _;
    }

    modifier onlyMinter() {
        require(msg.sender == minter || msg.sender == owner, "MycNodeLicense: not minter");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "MycNodeLicense: paused");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _royaltyReceiver
    ) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        guardian = msg.sender;
        royaltyReceiver = _royaltyReceiver != address(0) ? _royaltyReceiver : msg.sender;
    }

    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }

    function setGuardian(address _guardian) external onlyOwner {
        guardian = _guardian;
    }

    function setNodeRegistry(address _registry) external onlyOwner {
        nodeRegistry = IMycNodeRegistry(_registry);
        emit RegistryUpdated(_registry);
    }

    function pause() external {
        require(msg.sender == owner || msg.sender == guardian, "MycNodeLicense: not authorized to pause");
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function mintLicense(address to, uint8 tierId) external onlyMinter whenNotPaused returns (uint256) {
        require(to != address(0), "MycNodeLicense: mint to zero");
        uint256 tokenId = _nextTokenId++;
        
        _balances[to] += 1;
        _owners[tokenId] = to;

        _licenseData[tokenId] = LicenseMetadata({
            tierId: tierId,
            mintTimestamp: uint64(block.timestamp),
            serialNumber: uint32(tokenId),
            status: LicenseStatus.ACTIVE
        });

        emit Transfer(address(0), to, tokenId);
        emit NodePurchased(to, tokenId, tierId, 0);

        return tokenId;
    }

    function getLicenseMetadata(uint256 tokenId) external view returns (LicenseMetadata memory) {
        require(_owners[tokenId] != address(0), "MycNodeLicense: non-existent token");
        return _licenseData[tokenId];
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "MycNodeLicense: query for nonexistent token");
        return tokenOwner;
    }

    function balanceOf(address account) external view returns (uint256) {
        require(account != address(0), "MycNodeLicense: balance of zero address");
        return _balances[account];
    }

    function approve(address to, uint256 tokenId) external whenNotPaused {
        address tokenOwner = ownerOf(tokenId);
        require(to != tokenOwner, "MycNodeLicense: approval to current owner");
        require(msg.sender == tokenOwner || isApprovedForAll(tokenOwner, msg.sender), "MycNodeLicense: not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "MycNodeLicense: non-existent token");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external whenNotPaused {
        require(operator != msg.sender, "MycNodeLicense: approve to caller");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address tokenOwner, address operator) public view returns (bool) {
        return _operatorApprovals[tokenOwner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public whenNotPaused {
        require(_isApprovedOrOwner(msg.sender, tokenId), "MycNodeLicense: transfer caller is not owner nor approved");
        require(ownerOf(tokenId) == from, "MycNodeLicense: transfer from incorrect owner");
        require(to != address(0), "MycNodeLicense: transfer to zero address");

        // Clear approval
        delete _tokenApprovals[tokenId];

        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);

        // Hardware unbinding & reward checkpoint hook
        if (address(nodeRegistry) != address(0)) {
            nodeRegistry.onLicenseTransferred(tokenId, from, to);
        }
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        transferFrom(from, to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = ownerOf(tokenId);
        return (spender == tokenOwner || isApprovedForAll(tokenOwner, spender) || getApproved(tokenId) == spender);
    }

    // EIP-2981 Royalty
    function royaltyInfo(uint256, uint256 salePrice) external view returns (address receiver, uint256 royaltyAmount) {
        return (royaltyReceiver, (salePrice * royaltyFeeBps) / 10000);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd // ERC721
            || interfaceId == 0x5b5e139f // ERC721Metadata
            || interfaceId == 0x2a55205a // ERC2981
            || interfaceId == 0x01ffc9a7; // ERC165
    }
}
