// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MycToken
 * @notice Sovereign Zero-Gas Native DePIN Token for MYC Network (Chain ID 108)
 * ERC-20 compatible with Proof-of-Resonance admission hooks.
 */
contract MycToken {
    string public name = "MYC Network Sovereign Token";
    string public symbol = "MYC";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(uint256 initialSupply) {
        owner = msg.sender;
        _mint(msg.sender, initialSupply);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address tokenOwner, address spender) external view returns (uint256) {
        return _allowances[tokenOwner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "ERC20_ALLOWANCE_EXCEEDED");
        _allowances[sender][msg.sender] = currentAllowance - amount;
        _transfer(sender, recipient, amount);
        return true;
    }

    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "TRANSFER_FROM_ZERO_ADDRESS");
        require(to != address(0), "TRANSFER_TO_ZERO_ADDRESS");
        require(_balances[from] >= amount, "INSUFFICIENT_BALANCE");

        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "MINT_TO_ZERO_ADDRESS");
        totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
        emit Mint(account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "BURN_FROM_ZERO_ADDRESS");
        require(_balances[account] >= amount, "BURN_AMOUNT_EXCEEDS_BALANCE");
        _balances[account] -= amount;
        totalSupply -= amount;
        emit Transfer(account, address(0), amount);
        emit Burn(account, amount);
    }
}
