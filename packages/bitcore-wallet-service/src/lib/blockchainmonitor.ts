import * as async from 'async';
import _ from 'lodash';
import 'source-map-support/register';

import { BlockChainExplorer } from './blockchainexplorer';
import { ChainService } from './chain/index';
import { Common } from './common';
import { Lock } from './lock';
import logger from './logger';
import { MessageBroker } from './messagebroker';
import { Notification, TxConfirmationSub } from './model';
import { WalletService } from './server';
import { Storage } from './storage';

const $ = require('preconditions').singleton();
const Constants = Common.Constants;

const throttle = (fn: (bcmContext: any, chain: string, network: string, hash: string) => void) => {
  let lastCalled = 0;
  return (...args) => {
    const bcmContext = args[0],
      chain = args[1],
      network = args[2],
      hash = args[3];
    let msDelay = bcmContext.getChainThrottleSetting(chain, network) * 1000;
    let now = new Date().getTime();
    if (now - lastCalled < msDelay) {
      return;
    }
    lastCalled = now;
    return fn(bcmContext, chain, network, hash);
  };
};

type throttledNewBlocksFnType = (bcmContext: any, chain: string, network: string, hash: string) => void;
const throttledNewBlocks = throttle((bcmContext, chain, network, hash) => {
  bcmContext._notifyNewBlock(chain, network, hash);
  bcmContext._handleTxConfirmations(chain, network, hash);
}) as throttledNewBlocksFnType;

export class BlockchainMonitor {
  explorers: any;
  storage: Storage;
  messageBroker: MessageBroker;
  lock: Lock;
  walletId: string;
  blockThrottleSettings: { [chain: string]: { [network: string]: number } } =
    Constants.CHAIN_NEW_BLOCK_THROTTLE_TIME_SECONDS;
  last: Array<string>;
  Ni: number;
  N: number;
  lastTx: Array<string>;
  Nix: number;

  start(opts, cb) {
    opts = opts || {};

    // prevent checking same address if repeading with in 100 events
    this.N = opts.N || 100;
    this.Ni = this.Nix = 0;
    this.last = this.lastTx = [];

    async.parallel(
      [
        done => {
          this.explorers = {
            btc: {},
            bch: {},
            eth: {},
            matic: {},
            xrp: {},
            doge: {},
            ltc: {}
          };

          const chainNetworkPairs = [];
          _.each(_.values(Constants.CHAINS), chain => {
            _.each(_.values(Constants.NETWORKS), network => {
              chainNetworkPairs.push({
                chain,
                network
              });
            });
          });
          _.each(chainNetworkPairs, pair => {
            let explorer;
            if (
              opts.blockchainExplorers &&
              opts.blockchainExplorers[pair.chain] &&
              opts.blockchainExplorers[pair.chain][pair.network]
            ) {
              explorer = opts.blockchainExplorers[pair.chain][pair.network];
            } else {
              let config: { url?: string; provider?: any, regtestEnabled?: boolean } = {};
              if (
                opts.blockchainExplorerOpts &&
                opts.blockchainExplorerOpts[pair.chain] &&
                opts.blockchainExplorerOpts[pair.chain][pair.network]
              ) {
                config = opts.blockchainExplorerOpts[pair.chain][pair.network];
              } else {
                return;
              }

              const bcNetwork = pair.network === 'testnet' && config.regtestEnabled ? 'regtest' : pair.network;
              explorer = BlockChainExplorer({
                provider: config.provider,
                chain: pair.chain,
                network: bcNetwork,
                url: config.url,
                userAgent: WalletService.getServiceVersion()
              });
            }
            $.checkState(explorer, 'Failed State: explorer undefined at <start()>');

            this._initExplorer(pair.chain, pair.network, explorer);
            this.explorers[pair.chain][pair.network] = explorer;
          });
          done();
        },
        done => {
          if (opts.storage) {
            this.storage = opts.storage;
            done();
          } else {
            this.storage = new Storage();
            this.storage.connect(
              {
                ...opts.storageOpts,
                secondaryPreferred: true
              },
              done
            );
          }
        },
        done => {
          this.messageBroker = opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
          done();
        },
        done => {
          this.lock = opts.lock || new Lock(this.storage);
          done();
        }
      ],
      err => {
        if (err) {
          logger.error('%o', err);
        }
        return cb(err);
      }
    );
  }

  _initExplorer(chain, network, explorer) {
    explorer.initSocket({
      onBlock: _.bind(this._handleNewBlock, this, chain, network),
      onIncomingPayments: _.bind(this._handleIncomingPayments, this, chain, network)
    });
  }

  _handleThirdPartyBroadcasts(chain, network, data, processIt) {
    if (!data || !data.txid) return;

    if (!processIt) {
      if (this.lastTx.indexOf(data.txid) >= 0) {
        return;
      }

      this.lastTx[this.Nix++] = data.txid;
      if (this.Nix >= this.N) this.Nix = 0;

      logger.debug(`\tChecking ${chain}/${network} txid: ${data.txid}`);
    }

    this.storage.fetchTxByHash(data.txid, (err, txp) => {
      if (err) {
        logger.error('Could not fetch tx from the db');
        return;
      }
      if (!txp || txp.status != 'accepted') return;

      const walletId = txp.walletId;

      if (!processIt) {
        logger.debug(
          'Detected broadcast ' +
            data.txid +
            ' of an accepted txp [' +
            txp.id +
            '] for wallet ' +
            walletId +
            ' [' +
            txp.amount +
            'sat ]'
        );
        return setTimeout(this._handleThirdPartyBroadcasts.bind(this, chain, network, data, true), 20 * 1000);
      }

      logger.debug('Processing accepted txp [' + txp.id + '] for wallet ' + walletId + ' [' + txp.amount + 'sat ]');

      txp.setBroadcasted();

      this.storage.storeTx(this.walletId, txp, err => {
        if (err) logger.error('Could not save TX for wallet %o, %o', this.walletId, err);

        const args = {
          txProposalId: txp.id,
          txid: data.txid,
          amount: txp.getTotalAmount()
        };

        const notification = Notification.create({
          type: 'NewOutgoingTxByThirdParty',
          data: args,
          walletId
        });
        this._storeAndBroadcastNotification(notification);
      });
    });
  }

  _handleIncomingPayments(chain, network, data) {
    if (!data) return;
    let out = data.out;
    if (!out || !out.address || out.address.length < 10) return;

    // For evm chains, amount = 0 is ok, repeating addr payments are ok (no change).
    if (!Constants.EVM_CHAINS[chain.toUpperCase()]) {
      if (!(out.amount > 0)) return;
      if (this.last.indexOf(out.address) >= 0) {
        logger.debug('The incoming tx"s out ' + out.address + ' was already processed');
        return;
      }
      this.last[this.Ni++] = out.address;
      if (this.Ni >= this.N) this.Ni = 0;
    } else {
      if (this.lastTx.indexOf(data.txid) >= 0) {
        logger.debug('The incoming tx ' + data.txid + ' was already processed');
        return;
      }

      this.lastTx[this.Nix++] = data.txid;
      if (this.Nix >= this.N) this.Nix = 0;
    }

    logger.debug(`Checking ${chain}:${network}:${out.address} ${out.amount}`);
    this.storage.fetchAddressByChain(chain, out.address, (err, address) => {
      if (err) {
        logger.error('Could not fetch addresses from the db %o', err);
        return;
      }
      if (!address || address.isChange) {
        // no incomming payment
        return this._handleThirdPartyBroadcasts(chain, network, data, null);
      }

      const walletId = address.walletId;
      const fromTs = Date.now() - 24 * 3600 * 1000;
      this.storage.fetchNotifications(walletId, null, fromTs, (err, notifications) => {
        if (err) return;
        const alreadyNotified = _.some(notifications, n => {
          return n.type == 'NewIncomingTx' && n.data && n.data.txid == data.txid;
        });
        if (alreadyNotified) {
          logger.debug('The incoming tx ' + data.txid + ' was already notified');
          return;
        }

        logger.debug('Incoming tx for wallet ' + walletId + ' [' + out.amount + 'amount -> ' + out.address + ']');
        const notification = Notification.create({
          type: 'NewIncomingTx',
          data: {
            txid: data.txid,
            address: out.address,
            amount: out.amount,
            tokenAddress: out.tokenAddress,
            multisigContractAddress: out.multisigContractAddress,
            network
          },
          walletId
        });
        if (network !== 'testnet') {
          this.storage.fetchWallet(walletId, (err, wallet) => {
            if (err) return;
            async.each(
              wallet.copayers,
              (c, next) => {
                const sub = TxConfirmationSub.create({
                  copayerId: c.id,
                  walletId,
                  txid: data.txid,
                  amount: out.amount,
                  isCreator: false
                });
                this.storage.storeTxConfirmationSub(sub, next);
              },
              err => {
                if (err) logger.error('%o', err);
              }
            );
          });
        }

        this._storeAndBroadcastNotification(notification, () => {
          return;
        });
      });
    });
  }

  _notifyNewBlock(chain, network, hash) {
    logger.debug(` ** NOTIFY New ${chain}/${network} block ${hash}`);
    const notification = Notification.create({
      type: 'NewBlock',
      walletId: `${chain}:${network}`, // use chain:network name as wallet id for global notifications
      data: {
        hash,
        chain,
        network
      }
    });

    this._storeAndBroadcastNotification(notification, () => {});
  }

  _handleTxConfirmations(chain, network, hash) {
    if (!ChainService.notifyConfirmations(chain, network)) return;

    const processTriggeredSub = (sub, cb) => {
      logger.debug('New tx confirmation ' + sub.txid);
      sub.isActive = false;
      async.waterfall(
        [
          next => {
            this.storage.storeTxConfirmationSub(sub, err => {
              if (err) return cb(err);
              const notification = Notification.create({
                type: 'TxConfirmation',
                walletId: sub.walletId,
                creatorId: sub.copayerId,
                isCreator: sub.isCreator,
                data: {
                  txid: sub.txid,
                  chain,
                  network,
                  amount: sub.amount
                }
              });
              next(null, notification);
            });
          },
          (notification, next) => {
            this._storeAndBroadcastNotification(notification, next);
          }
        ],
        cb
      );
    };
    const explorer = this.explorers[chain][network];
    if (!explorer) return;

    explorer.getTxidsInBlock(hash, async (err, txids) => {
      if (err) {
        logger.error('Could not fetch txids from block %o %o', hash, err);
        return;
      }

      const stream = this.storage.streamActiveTxConfirmationSubs(null, txids);
      let txSub = await stream.next();
      while (txSub != null) {
        processTriggeredSub(txSub, err => {
          if (err) {
            logger.error('Could not process tx confirmation %o', err);
          }
          return;
        });
        txSub = await stream.next();
      }
    });
  }

  _handleNewBlock(chain, network, hash) {
    // clear height cache.
    const cacheKey = Storage.BCHEIGHT_KEY + ':' + chain + ':' + network;
    this.storage.clearGlobalCache(cacheKey, () => {});

    if (chain == 'xrp') {
      return;
    }

    if (this.getChainThrottleSetting(chain, network) > 0) {
      throttledNewBlocks(this, chain, network, hash);
    } else {
      this._notifyNewBlock(chain, network, hash);
      this._handleTxConfirmations(chain, network, hash);
    }
  }

  _storeAndBroadcastNotification(notification, cb?: () => void) {
    this.storage.storeNotification(notification.walletId, notification, () => {
      this.messageBroker.send(notification);
      if (cb) return cb();
    });
  }

  getChainThrottleSetting(chain, network) {
    const config = this.blockThrottleSettings;
    if (typeof config[chain] === 'object') {
      if (typeof config[chain][network] === 'number') {
        return config[chain][network];
      }
    }
    // Defaults to no throttling
    return 0;
  }
}
