import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

/**
 * Deploys MultiSend. The deploying account becomes the admin.
 *
 *   npm run deploy:multisend -- --network <network>
 */
export default buildModule('MultiSendModule', (m) => {
  const multiSend = m.contract('MultiSend');
  return { multiSend };
});
