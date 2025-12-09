pragma solidity ^0.4.23;
import "./ERC20.sol";

contract CryptoErc20 is ERC20 {

  string public name = "CryptoErc20 ";
  string public symbol = "CE20";
  uint public decimals = 18;
  uint public INITIAL_SUPPLY = 1000 * 1000 * 1000 * 10 ** 18;

  constructor() public ERC20() {
    _totalSupply = INITIAL_SUPPLY;
    _balances[msg.sender] = INITIAL_SUPPLY;
  }
}
