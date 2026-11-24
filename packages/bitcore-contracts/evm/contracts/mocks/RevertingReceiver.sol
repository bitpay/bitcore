// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev Rejects all incoming ETH. Test use only.
contract RevertingReceiver {
	receive() external payable {
		revert("RevertingReceiver: no thanks");
	}
}
