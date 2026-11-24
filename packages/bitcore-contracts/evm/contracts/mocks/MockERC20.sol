// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev Minimal standard ERC20 (returns bool, reverts on failure). Test use only.
contract MockERC20 {
	mapping(address => uint256) public balanceOf;
	mapping(address => mapping(address => uint256)) public allowance;
	uint256 public totalSupply;

	event Transfer(address indexed from, address indexed to, uint256 tokens);
	event Approval(address indexed tokenOwner, address indexed spender, uint256 tokens);

	function mint(address to, uint256 amount) external {
		balanceOf[to] += amount;
		totalSupply += amount;
		emit Transfer(address(0), to, amount);
	}

	function approve(address spender, uint256 amount) external returns (bool) {
		allowance[msg.sender][spender] = amount;
		emit Approval(msg.sender, spender, amount);
		return true;
	}

	function transfer(address to, uint256 amount) external returns (bool) {
		_transfer(msg.sender, to, amount);
		return true;
	}

	function transferFrom(address from, address to, uint256 amount) external returns (bool) {
		require(allowance[from][msg.sender] >= amount, "ERC20: insufficient allowance");
		allowance[from][msg.sender] -= amount;
		_transfer(from, to, amount);
		return true;
	}

	function _transfer(address from, address to, uint256 amount) internal {
		require(balanceOf[from] >= amount, "ERC20: insufficient balance");
		balanceOf[from] -= amount;
		balanceOf[to] += amount;
		emit Transfer(from, to, amount);
	}
}
