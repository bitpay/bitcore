import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import MultiSendModule from './MultiSend.ts';

/**
 * Deploys MultiSend (via MultiSendModule) and starts handing the admin role to `newAdmin`
 * (e.g. a multisig). Handover is two-step: `newAdmin` must still call `acceptAdmin()` itself.
 * Until then the deployer remains admin.
 *
 * Copy ignition/parameters/MultiSendWithAdmin.example.json, set `newAdmin`, then (path is relative to src/evm):
 *
 *   npm run deploy:multisend-with-admin -- --network <network> --parameters ignition/parameters/<file>.json
 */
export default buildModule('MultiSendWithAdminModule', (m) => {
  const { multiSend } = m.useModule(MultiSendModule);
  const newAdmin = m.getParameter<string>('newAdmin');

  m.call(multiSend, 'transferAdmin', [newAdmin]);

  return { multiSend };
});
