import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

/**
 * Completes an admin handover started by MultiSendSetNewAdmin: calls `acceptAdmin()` on an
 * already-deployed MultiSend. Deploys nothing.
 *
 * The transaction must come from the pending admin. Ignition sends from the network's first account
 * by default; use `--default-sender <address>` to pick a different one. If the pending admin is a
 * smart-contract wallet (e.g. a Safe), Ignition can't send from it. Submit `acceptAdmin()` through the
 * wallet itself instead.
 *
 * Copy ignition/parameters/MultiSendAcceptAdmin.example.json, fill it in, then (path is relative to src/evm):
 *
 *   npm run multisend:accept-admin -- --network <network> --parameters ignition/parameters/<file>.json --default-sender <pendingAdmin>
 *
 * Ignition remembers completed calls per deployment, so for each later handover on the same chain
 * pass a new `--deployment-id` (e.g. `--deployment-id multisend-accept-admin-2`).
 */
export default buildModule('MultiSendAcceptAdminModule', (m) => {
  const multiSendAddress = m.getParameter<string>('multiSendAddress');

  const multiSend = m.contractAt('MultiSend', multiSendAddress);
  m.call(multiSend, 'acceptAdmin', []);

  return { multiSend };
});
