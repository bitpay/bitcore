// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @dev On receiving ETH, makes one call to a configured target (e.g. back into MultiSend) and records
 *      the result instead of bubbling it up, so tests can inspect why the reentrant call failed while
 *      the outer call still succeeds. Can also make arbitrary calls (e.g. to acceptAdmin). Test use only.
 */
contract ReentrantReceiver {
	address public attackTarget;
	bytes public attackData;
	bool public attempted;
	bool public lastSuccess;
	bytes public lastReturnData;

	function setAttack(address target_, bytes calldata data_) external {
		attackTarget = target_;
		attackData = data_;
		attempted = false;
	}

	function execute(address to, bytes calldata callData) external payable returns (bytes memory) {
		(bool success, bytes memory ret) = to.call{ value: msg.value }(callData);
		if (!success) {
			assembly {
				revert(add(ret, 32), mload(ret))
			}
		}
		return ret;
	}

	receive() external payable {
		if (attackTarget != address(0) && !attempted) {
			attempted = true;
			(lastSuccess, lastReturnData) = attackTarget.call(attackData);
		}
	}
}
