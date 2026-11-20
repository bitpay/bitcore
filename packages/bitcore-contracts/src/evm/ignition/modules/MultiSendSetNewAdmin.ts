import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

/**
 * Starts handing the admin role of an already-deployed MultiSend to `newAdmin` (e.g. a multisig).
 * Deploys nothing.
 *
 * Handover is two-step: this calls `transferAdmin(newAdmin)`, and `newAdmin` must then call
 * `acceptAdmin()` itself (see MultiSendAcceptAdmin.ts). Until then the current admin keeps the role.
 *
 * The transaction must come from the current admin. Ignition sends from the network's first account
 * by default; use `--default-sender <address>` to pick a different one.
 *
 * Copy ignition/parameters/MultiSendSetNewAdmin.example.json, fill it in, then (path is relative to src/evm):
 *
 *   npm run multisend:set-admin -- --network <network> --parameters ignition/parameters/<file>.json
 *
 * Ignition remembers completed calls per deployment, so for each later handover on the same chain
 * pass a new `--deployment-id` (e.g. `--deployment-id multisend-admin-2`).
 */
export default buildModule('MultiSendSetNewAdminModule', (m) => {
  const multiSendAddress = m.getParameter<string>('multiSendAddress');
  const newAdmin = m.getParameter<string>('newAdmin');

  const multiSend = m.contractAt('MultiSend', multiSendAddress);
  m.call(multiSend, 'transferAdmin', [newAdmin]);

  return { multiSend };
});
