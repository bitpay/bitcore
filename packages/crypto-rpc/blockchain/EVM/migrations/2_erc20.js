// eslint-disable-next-line
const ERC20 = artifacts.require('./CryptoErc20.sol');

export default function(deployer) {
  deployer.deploy(ERC20 );
};
