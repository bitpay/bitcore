// eslint-disable-next-line
const Migrations = artifacts.require('./Migrations.sol');

export default function(deployer) {
  deployer.deploy(Migrations);
};
