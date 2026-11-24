// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev ERC20 that signals failure by returning false instead of reverting. Test use only.
contract MockFalseERC20 {
	function transfer(address, uint256) external pure returns (bool) {
		return false;
	}

	function transferFrom(address, address, uint256) external pure returns (bool) {
		return false;
	}
}
