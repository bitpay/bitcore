import _ from 'lodash';
import logger from '../../logger';
import { NonceManager } from '../../model/noncemanager';
import { TxProposal } from '../../model/txproposal';
import { IWallet } from '../../model/wallet';
import { WalletService } from '../../server';
import { Storage } from '../../storage';

const $ = require('preconditions').singleton();
const Errors = require('../../errors/errordefinitions');

export class NonceService {
  create() {
    return this;
  }

  getNonceManager(opts: { walletId: string; chain: string; address: string; storage: Storage }): Promise<NonceManager> {
    return new Promise(async function handleUpdateNonceManager(resolve, reject) {
      try {
        let nonceManager = await opts.storage.fetchNonceManager(opts.walletId, opts.chain, opts.address);
        resolve(nonceManager);
      } catch (err) {
        reject(err);
      }
    });
  }

  updateNonceManager(opts) {
    $.checkState(opts.action, 'Cannot update NonceManager without an action');
    const txp = opts.txp || {};
    opts = opts || {};
    opts.server = opts.server || {};
    opts.wallet = opts.wallet || {};
    opts.address = opts.address || txp.from;
    opts.walletId = opts.wallet.id || txp.walletId;
    opts.proposalId = opts.proposalId || txp.id;
    opts.chain = opts.chain || opts.wallet.chain || txp.chain;

    return new Promise(async function handleUpdateNonceManager(resolve, reject) {
      try {
        let server = opts.server;
        let nonceManager: NonceManager;

        nonceManager = await server.storage.fetchNonceManager(opts.walletId, opts.chain, opts.address);

        if (!nonceManager && opts.action == 'create') {
          const createOpts = { walletId: opts.walletId, address: opts.address, chain: opts.chain };
          nonceManager = NonceManager.create(createOpts);
        }

        if (nonceManager) {
          switch (opts.action) {
            case 'error':
            case 'reject':
            case 'broadcast':
              try {
                await nonceManager.onTxProposalAction(txp, txp.status, function handleNMTxpAction(error) {});
              } catch (error) {
                if (error.msg == Errors.NONCE_MISMATCH) await nonceManager.save(server.storage);
                throw error;
              }
              break;
            case 'sign':
              if (nonceManager.getFirstNonce() < txp.nonce) return reject(Errors.NONCE_TOO_HIGH);
              if (nonceManager.getFirstNonce() > txp.nonce)
                return reject(
                  Errors.NONCE_TOO_LOW + '. We recommend deleting this proposal and recreating it with a new nonce'
                );
              break;
            case 'remove':
              await nonceManager.removeTxNonce(server.storage, txp);
              await nonceManager.save(server.storage);
            case 'create':
              $.checkState(opts.proposalId, 'Cannot assign a Nonce Slot without a proposalId');
              const slot = nonceManager.findSlot({ proposalId: opts.proposalId });

              if (slot) return resolve(slot.nonce);

              const nonce = await nonceManager.assign(server, opts.wallet, opts.proposalId);
              await nonceManager.save(server.storage);

              return resolve(nonce);
            default:
              return resolve(false);
          }
        }
        resolve(true);
      } catch (err) {
        return reject(err);
      }
    });
  }
  /* 
  // TODO break into smaller functions
  getNonce(opts) {}

  signable(opts) {}

  createNonceManager(opts) {}

  removeFromNonceManager(opts) {}

  saveNonceManager(opts) {}
//*/
}

export let EthNonceService = new NonceService();
