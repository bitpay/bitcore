pragma solidity ^0.4.23;
import "./IERC20.sol";

contract SendToMany {
  address owner;

  constructor() {
    owner = msg.sender;
  }

  modifier isOwner() {
    require(msg.sender == owner);
    _;
  }

  function sendMany(address[] addresses, uint[] amounts, address tokenContract) public payable isOwner {
    require(addresses.length == amounts.length);
    uint sum = 0;
    for(uint i = 0; i < amounts.length; i++) {
      sum += amounts[i];
    }
    if(tokenContract != 0x0) {
      IERC20 token = IERC20(tokenContract);
      require(token.allowance(msg.sender, address(this)) >= sum, "This contract is not allowed enough funds for this batch");
      for(i = 0; i < addresses.length; i++) {
        require(token.transferFrom(msg.sender, addresses[i], amounts[i]), "token transfer failed");
      }
    } else {
      require((address(this).balance + msg.value) >= sum, "ETH balance too low for this batch");
      for(i = 0; i < addresses.length; i++) {
        addresses[i].transfer(amounts[i]);
      }
    }
  }
}
