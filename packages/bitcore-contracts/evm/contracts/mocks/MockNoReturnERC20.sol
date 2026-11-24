// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev USDT-style ERC20: transfer/transferFrom return nothing and revert on failure. Test use only.
contract MockNoReturnERC20 {
	mapping(address => uint256) public balanceOf;
	mapping(address => mapping(address => uint256)) public allowance;

	event Transfer(address indexed from, address indexed to, uint256 tokens);

	function mint(address to, uint256 amount) external {
		balanceOf[to] += amount;
	}

	function approve(address spender, uint256 amount) external {
		allowance[msg.sender][spender] = amount;
	}

	function transfer(address to, uint256 amount) external {
		_transfer(msg.sender, to, amount);
	}

	function transferFrom(address from, address to, uint256 amount) external {
		require(allowance[from][msg.sender] >= amount, "insufficient allowance");
		allowance[from][msg.sender] -= amount;
		_transfer(from, to, amount);
	}

	function _transfer(address from, address to, uint256 amount) internal {
		require(balanceOf[from] >= amount, "insufficient balance");
		balanceOf[from] -= amount;
		balanceOf[to] += amount;
		emit Transfer(from, to, amount);
	}
}
