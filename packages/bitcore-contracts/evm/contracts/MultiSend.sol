// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./IERC20.sol";

/**
 * @title MultiSend
 * @notice Permissionless batch sender for native ETH and ERC20 tokens.
 *
 * !!! DONATION NOTICE !!!
 * ----------------------
 *  Any funds sent to this contract (ETH or ERC20 tokens) -- whether by mistake, by direct transfer,
 *  or by selfdestruct/coinbase -- will NOT be returned to the sender. They are treated as a voluntary
 *  donation to the contract's creator/admin, who may withdraw them at any time with withdrawEth /
 *  withdrawErc20. Do not send funds to this contract directly. Use sendEth / sendErc20 only.
 *
 * Entry points
 * ------------
 *  - send(Batch[])      combined: ETH and any number of tokens in one tx, grouped by token.
 *  - sendEth(...)       ETH only, two aligned arrays.
 *  - sendErc20(...)     one token, two aligned arrays.
 *  All three share the same guarantees below. send() is the general form of the other two.
 *
 * Design goals
 * ------------
 *  - Permissionless for users: anyone can call sendEth / sendErc20. The single admin has no power over
 *    user funds or allowances; its only privileges are to withdraw whatever has been donated/stranded
 *    in the contract and to hand the admin role to someone else. No upgrade path.
 *  - Pass-through only. The contract is never meant to hold funds:
 *      * There is no receive() or fallback(), so plain ETH transfers revert.
 *      * sendEth requires msg.value to equal the sum of amounts exactly, so nothing is left behind
 *        (and therefore there is no "refund" step that could be abused).
 *      * sendErc20 moves tokens straight from the caller to each recipient via transferFrom. The
 *        tokens never touch this contract's balance.
 *      * Recipients equal to this contract are rejected, so it can't be made the final destination.
 *  - Safe against hostile recipients / tokens:
 *      * Reentrancy guard on both entry points.
 *      * The contract keeps no per-user state and holds no funds, so there is nothing for a
 *        reentering recipient to steal even if the guard were bypassed.
 *      * The pulled-from address is always msg.sender (never a parameter), so nobody can use this
 *        contract to spend a third party's allowance.
 *      * Any failed leg reverts the whole batch (all-or-nothing). A malicious recipient can only
 *        grief the batch of the caller that chose to include it.
 *      * ETH is forwarded with a raw call that ignores returndata, so a recipient can't "return-bomb"
 *        the contract with huge return data to burn gas on memory expansion.
 *
 * Known limitations (inherent, cannot be prevented by contract code)
 * ------------------------------------------------------------------
 *  - ETH can still be force-sent via selfdestruct or as a block reward/coinbase. Likewise anyone can
 *    transfer tokens directly to this address. Such funds are donations (see notice above) and are
 *    claimable only by the admin. The contract never relies on address(this).balance for its logic.
 *  - Recipient code runs with all remaining gas during sendEth. This only affects the caller's own tx.
 *
 * Admin safety notes
 * ------------------
 *  - Withdrawals are nonReentrant. This matters: during sendEth the caller's msg.value is briefly held
 *    by this contract, and a recipient that is also the admin must not be able to reenter withdrawEth
 *    to grab it. The guard makes that impossible.
 *  - Admin handover is two-step (transferAdmin -> acceptAdmin) so a typo can't brick the role.
 */
contract MultiSend {
	address public admin;
	address public pendingAdmin;

	// Reentrancy guard. Uses 1/2 rather than bool so the slot is never zeroed (cheaper writes).
	uint256 private constant _NOT_ENTERED = 1;
	uint256 private constant _ENTERED = 2;
	uint256 private _status = _NOT_ENTERED;

	// Same signature as MultiSend.Transfer so existing indexers/listeners keep working.
	// tokenAddress == address(0) denotes native ETH.
	event Transfer(address indexed from, address indexed to, address indexed tokenAddress, uint256 tokens);

	/// @notice A single payment: `amount` to `to`.
	struct Item {
		address to;
		uint256 amount;
	}

	/// @notice All payments in one token. `token == address(0)` means native ETH.
	struct Batch {
		address token;
		Item[] items;
	}

	event AdminTransferStarted(address indexed currentAdmin, address indexed pendingAdmin);
	event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

	constructor() {
		admin = msg.sender;
		emit AdminTransferred(address(0), msg.sender);
	}

	modifier nonReentrant() {
		require(_status != _ENTERED, "Reentrancy Guard: Reentrant call detected!");
		_status = _ENTERED;
		_;
		_status = _NOT_ENTERED;
	}

	modifier onlyAdmin() {
		require(msg.sender == admin, "Must be the admin");
		_;
	}

	// ---------------------------------------------------------------------------------------------
	// Admin
	// ---------------------------------------------------------------------------------------------

	/// @notice Step 1 of handing over the admin role. The new admin must call acceptAdmin().
	function transferAdmin(address newAdmin) external onlyAdmin {
		require(newAdmin != address(0), "New admin cannot be the zero address");
		pendingAdmin = newAdmin;
		emit AdminTransferStarted(admin, newAdmin);
	}

	/// @notice Step 2 of handing over the admin role. Callable only by the pending admin.
	function acceptAdmin() external {
		require(msg.sender == pendingAdmin, "Must be the pending admin");
		emit AdminTransferred(admin, msg.sender);
		admin = msg.sender;
		pendingAdmin = address(0);
	}

	/**
	 * @notice Withdraw ETH held by the contract (donations / force-sent funds).
	 * @dev Funds sent to this contract are NOT returned to their senders; they belong to the admin.
	 */
	function withdrawEth(address to, uint256 amount) external onlyAdmin nonReentrant returns (bool) {
		_requireValidRecipient(to);
		require(amount <= address(this).balance, "Attempting to withdraw more ETH than available");

		_sendValue(to, amount);

		emit Transfer(address(this), to, address(0), amount);
		return true;
	}

	/**
	 * @notice Withdraw ERC20 tokens held by the contract (donations / direct transfers).
	 * @dev Funds sent to this contract are NOT returned to their senders; they belong to the admin.
	 */
	function withdrawErc20(address tokenAddress, address to, uint256 amount) external onlyAdmin nonReentrant returns (bool) {
		require(tokenAddress.code.length > 0, "Token is not a contract");
		_requireValidRecipient(to);

		_safeTokenCall(tokenAddress, abi.encodeWithSelector(IERC20.transfer.selector, to, amount));

		emit Transfer(address(this), to, tokenAddress, amount);
		return true;
	}

	// ---------------------------------------------------------------------------------------------
	// Public batch sends
	// ---------------------------------------------------------------------------------------------

	/**
	 * @notice Send ETH to many recipients in one transaction.
	 * @dev msg.value must equal the sum of `amounts` exactly. No ETH is retained or refunded.
	 */
	function sendEth(address[] calldata recipients, uint256[] calldata amounts) external payable nonReentrant returns (bool) {
		require(recipients.length == amounts.length, "Recipients array must have same length as amounts");

		uint256 total = 0;
		for (uint256 i = 0; i < amounts.length; i++) {
			total += amounts[i]; // checked arithmetic: reverts on overflow
		}
		require(total == msg.value, "'value' must equal the sum of amounts");

		for (uint256 i = 0; i < recipients.length; i++) {
			address to = recipients[i];
			_requireValidRecipient(to);

			_sendValue(to, amounts[i]);
			emit Transfer(msg.sender, to, address(0), amounts[i]);
		}
		return true;
	}

	/**
	 * @notice Send ERC20 tokens from the caller to many recipients in one transaction.
	 * @dev The caller must have approved this contract for at least the sum of `amounts`.
	 *      Tokens go directly from the caller to each recipient; this contract never holds them.
	 */
	function sendErc20(address tokenAddress, address[] calldata recipients, uint256[] calldata amounts) external nonReentrant returns (bool) {
		require(recipients.length == amounts.length, "Recipients array must have same length as amounts");
		// Calling an address with no code "succeeds" silently, which would let a bogus token address
		// emit Transfer events for transfers that never happened.
		require(tokenAddress.code.length > 0, "Token is not a contract");

		for (uint256 i = 0; i < recipients.length; i++) {
			address to = recipients[i];
			_requireValidRecipient(to);

			_safeTransferFrom(tokenAddress, msg.sender, to, amounts[i]);
			emit Transfer(msg.sender, to, tokenAddress, amounts[i]);
		}
		return true;
	}

	/**
	 * @notice Combined batch send: ETH and any number of ERC20 tokens in a single transaction.
	 * @dev Each Batch names one token and the payments to make in it. `token == address(0)` means native
	 *      ETH (matches the Transfer event convention). Payments are grouped by token so the token address
	 *      is passed once per group and validated once per group.
	 *
	 *      - ETH: msg.value must equal the sum of all `address(0)` groups' amounts exactly. If you send
	 *        only tokens, msg.value must be 0.
	 *      - ERC20: the caller must have approved this contract for each token's total. Tokens go straight
	 *        from the caller to each recipient.
	 *      - All-or-nothing: if any payment fails the entire call reverts.
	 *
	 *      CAUTION: a zero (default/uninitialised) token field is treated as ETH, not as an error. The
	 *      exact msg.value check means a mistake will normally revert rather than send, but integrators
	 *      should still make sure they populate `token` explicitly.
	 */
	function send(Batch[] calldata batches) external payable nonReentrant returns (bool) {
		// Pass 1: fail fast on the ETH accounting before making any external calls.
		uint256 ethTotal = 0;
		for (uint256 g = 0; g < batches.length; g++) {
			if (batches[g].token == address(0)) {
				Item[] calldata items = batches[g].items;
				for (uint256 i = 0; i < items.length; i++) {
					ethTotal += items[i].amount; // checked arithmetic: reverts on overflow
				}
			}
		}
		require(ethTotal == msg.value, "'value' must equal the sum of ETH amounts");

		// Pass 2: execute.
		for (uint256 g = 0; g < batches.length; g++) {
			address token = batches[g].token;
			Item[] calldata items = batches[g].items;

			if (token == address(0)) {
				for (uint256 i = 0; i < items.length; i++) {
					address to = items[i].to;
					_requireValidRecipient(to);
					_sendValue(to, items[i].amount);
					emit Transfer(msg.sender, to, address(0), items[i].amount);
				}
			} else {
				// One code check per group (see sendErc20 for why this is required).
				require(token.code.length > 0, "Token is not a contract");
				for (uint256 i = 0; i < items.length; i++) {
					address to = items[i].to;
					_requireValidRecipient(to);
					_safeTransferFrom(token, msg.sender, to, items[i].amount);
					emit Transfer(msg.sender, to, token, items[i].amount);
				}
			}
		}
		return true;
	}

	/// @dev Raw ETH send. No output buffer, so any returndata is ignored (return-bomb safe).
	function _sendValue(address to, uint256 amount) private {
		bool success;
		assembly {
			success := call(gas(), to, amount, 0, 0, 0, 0)
		}
		require(success, "Failed to send");
	}

	function _requireValidRecipient(address to) private view {
		require(to != address(0), "Recipient cannot be the zero address");
		// Prevent this contract from becoming a final destination for funds.
		require(to != address(this), "Recipient cannot be this contract");
	}

	/**
	 * @dev transferFrom that handles tokens returning nothing (USDT-style) as well as ones returning
	 *      bool, and reverts on a revert or a `false` return. Does not rely on balance deltas, so it
	 *      also works for self-transfers and fee-on-transfer tokens.
	 */
	function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
		_safeTokenCall(token, abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
	}

	/// @dev Low-level token call that reverts unless it succeeded and returned nothing or `true`.
	function _safeTokenCall(address token, bytes memory data) private {
		(bool success, bytes memory ret) = token.call(data);
		require(success, "Failed to transfer");
		if (ret.length > 0) {
			require(ret.length >= 32 && abi.decode(ret, (bool)), "Failed to transfer");
		}
	}
}