import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';


export default buildModule('ERC20', (m) => {
  const contract = m.contract('CryptoErc20');
  return { contract };
});
