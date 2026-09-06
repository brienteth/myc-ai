// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IMycEligibilityRegistry.sol";

/**
 * @title MycEligibilityRegistry
 * @notice On-chain EIP-712 permit verification and compliance registry
 */
contract MycEligibilityRegistry is IMycEligibilityRegistry {
    address public owner;
    uint32 public override currentPolicyVersion = 1;

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant ELIGIBILITY_PERMIT_TYPEHASH = keccak256(
        "EligibilityPermit(address buyer,uint8 tierId,uint256 count,uint256 unitPrice,address currency,uint256 chainId,address saleContract,uint256 nonce,uint256 deadline,uint32 policyVersion)"
    );

    mapping(address => bool) private _signers;
    mapping(bytes32 => bool) private _consumedPermits;
    mapping(address => uint256) public buyerNonces;

    modifier onlyOwner() {
        require(msg.sender == owner, "MycEligibilityRegistry: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        _signers[msg.sender] = true;
        emit PermitSignerUpdated(msg.sender, true);

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("MYC Eligibility Registry")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function setSigner(address signer, bool active) external onlyOwner {
        require(signer != address(0), "MycEligibilityRegistry: zero signer");
        _signers[signer] = active;
        emit PermitSignerUpdated(signer, active);
    }

    function setPolicyVersion(uint32 newVersion) external onlyOwner {
        require(newVersion >= currentPolicyVersion, "MycEligibilityRegistry: cannot downgrade policy");
        currentPolicyVersion = newVersion;
        emit PolicyVersionUpdated(newVersion);
    }

    function verifyAndConsumePermit(
        EligibilityPermit calldata permit,
        bytes calldata signature
    ) external override returns (bool) {
        require(permit.chainId == block.chainid, "MycEligibilityRegistry: wrong chainId");
        require(permit.deadline >= block.timestamp, "MycEligibilityRegistry: permit expired");
        require(permit.policyVersion == currentPolicyVersion, "MycEligibilityRegistry: outdated policy version");
        require(permit.nonce == buyerNonces[permit.buyer], "MycEligibilityRegistry: invalid nonce");

        bytes32 structHash = keccak256(
            abi.encode(
                ELIGIBILITY_PERMIT_TYPEHASH,
                permit.buyer,
                permit.tierId,
                permit.count,
                permit.unitPrice,
                permit.currency,
                permit.chainId,
                permit.saleContract,
                permit.nonce,
                permit.deadline,
                permit.policyVersion
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        require(!_consumedPermits[digest], "MycEligibilityRegistry: permit already consumed");

        address recovered = _recoverSigner(digest, signature);
        require(_signers[recovered], "MycEligibilityRegistry: invalid permit signer");

        _consumedPermits[digest] = true;
        buyerNonces[permit.buyer] += 1;

        emit PermitConsumed(digest, permit.buyer, permit.nonce);
        return true;
    }

    function isSigner(address account) external view override returns (bool) {
        return _signers[account];
    }

    function isPermitConsumed(bytes32 permitHash) external view override returns (bool) {
        return _consumedPermits[permitHash];
    }

    function _recoverSigner(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "MycEligibilityRegistry: invalid sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "MycEligibilityRegistry: invalid v");
        return ecrecover(digest, v, r, s);
    }
}
