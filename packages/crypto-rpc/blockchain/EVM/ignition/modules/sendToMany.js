import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';


export default buildModule('SendToMany', (m) => {
  const contract = m.contract('SendToMany');
  return { contract };
});
