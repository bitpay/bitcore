// eslint-disable-next-line
const SendToMany = artifacts.require('./SendToMany.sol');

export default function(deployer) {
  deployer.deploy(SendToMany);
};
