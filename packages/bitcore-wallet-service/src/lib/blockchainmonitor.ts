import * as async from 'async';
import _ from 'lodash';
import 'source-map-support/register';

import { BlockChainExplorer } from './blockchainexplorer';
import { ChainService } from './chain/index';
import { Lock } from './lock';
import logger from './logger';
import { MessageBroker } from './messagebroker';
import { Notification } from './model';
import { WalletService } from './server';
import { Storage } from './storage';

const $ = require('preconditions').singleton();
const Common = require('./common');
const Constants = Common.Constants;
const Utils = Common.Utils;
const Defaults = Common.Defaults;

type throttledNewBlocksFnType = (that: any, coin: any, network: any, hash: any) => void;

var throttledNewBlocks = _.throttle((that, coin, network, hash) => {
  that._notifyNewBlock(coin, network, hash);
  that._handleTxConfirmations(coin, network, hash);
}, Defaults.NEW_BLOCK_THROTTLE_TIME_MIN * 60 * 1000) as throttledNewBlocksFnType;

export class BlockchainMonitor {
  explorers: any;
  storage: Storage;
  messageBroker: MessageBroker;
  lock: Lock;
  walletId: string;
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
            xrp: {}
          };

          const coinNetworkPairs = [];
          _.each(_.values(Constants.COINS), coin => {
            _.each(_.values(Constants.NETWORKS), network => {
              coinNetworkPairs.push({
                coin,
                network
              });
            });
          });
          _.each(coinNetworkPairs, pair => {
            let explorer;
            if (
              opts.blockchainExplorers &&
              opts.blockchainExplorers[pair.coin] &&
              opts.blockchainExplorers[pair.coin][pair.network]
            ) {
              explorer = opts.blockchainExplorers[pair.coin][pair.network];
            } else {
              let config: { url?: string; provider?: any } = {};
              if (
                opts.blockchainExplorerOpts &&
                opts.blockchainExplorerOpts[pair.coin] &&
                opts.blockchainExplorerOpts[pair.coin][pair.network]
              ) {
                config = opts.blockchainExplorerOpts[pair.coin][pair.network];
              } else {
                return;
              }

              explorer = BlockChainExplorer({
                provider: config.provider,
                coin: pair.coin,
                network: pair.network,
                url: config.url,
                userAgent: WalletService.getServiceVersion()
              });
            }
            $.checkState(explorer);

            this._initExplorer(pair.coin, pair.network, explorer);
            this.explorers[pair.coin][pair.network] = explorer;
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
          this.lock = opts.lock || new Lock(opts.lockOpts);
          done();
        }
      ],
      err => {
        if (err) {
          logger.error(err);
        }
        return cb(err);
      }
    );
  }

  _initExplorer(coin, network, explorer) {
    explorer.initSocket({
      onBlock: _.bind(this._handleNewBlock, this, coin, network),
      onIncomingPayments: _.bind(this._handleIncomingPayments, this, coin, network)
    });
  }

  _handleThirdPartyBroadcasts(coin, network, data, processIt) {
    if (!data || !data.txid) return;

    if (!processIt) {
      if (this.lastTx.indexOf(data.txid) >= 0) {
        return;
      }

      this.lastTx[this.Nix++] = data.txid;
      if (this.Nix >= this.N) this.Nix = 0;

      logger.debug(`\tChecking ${coin}/${network} txid: ${data.txid}`);
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
        return setTimeout(this._handleThirdPartyBroadcasts.bind(this, coin, network, data, true), 20 * 1000);
      }

      logger.debug('Processing accepted txp [' + txp.id + '] for wallet ' + walletId + ' [' + txp.amount + 'sat ]');

      txp.setBroadcasted();

      this.storage.storeTx(this.walletId, txp, err => {
        if (err) logger.error('Could not save TX');

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

  _handleIncomingPayments(coin, network, data) {
    if (!data) return;
    let out = data.out;
    if (!out || !out.address || out.address.length < 10) return;

    // For eth, amount = 0 is ok, repeating addr payments are ok (no change).
    if (coin != 'eth') {
      if (!(out.amount > 0)) return;
      if (this.last.indexOf(out.address) >= 0) {
        logger.debug('The incoming tx"s out ' + out.address + ' was already processed');
        return;
      }
      this.last[this.Ni++] = out.address;
      if (this.Ni >= this.N) this.Ni = 0;
    } else if (coin == 'eth') {
      if (this.lastTx.indexOf(data.txid) >= 0) {
        logger.debug('The incoming tx ' + data.txid + ' was already processed');
        return;
      }

      this.lastTx[this.Nix++] = data.txid;
      if (this.Nix >= this.N) this.Nix = 0;
    }

    logger.debug(`Checking ${coin}:${network}:${out.address} ${out.amount}`);
    this.storage.fetchAddressByCoin(coin, out.address, (err, address) => {
      if (err) {
        logger.error('Could not fetch addresses from the db');
        return;
      }
      if (!address || address.isChange) {
        // no incomming payment
        return this._handleThirdPartyBroadcasts(coin, network, data, null);
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
            multisigContractAddress: out.multisigContractAddress
          },
          walletId
        });

        this._storeAndBroadcastNotification(notification, () => {
          return;
        });
      });
    });
  }

  _notifyNewBlock(coin, network, hash) {
    logger.debug(` ** NOTIFY New ${coin}/${network} block ${hash}`);
    const notification = Notification.create({
      type: 'NewBlock',
      walletId: `${coin}:${network}`, // use coin:network name as wallet id for global notifications
      data: {
        hash,
        coin,
        network
      }
    });

    this._storeAndBroadcastNotification(notification, () => {});
  }

  _handleTxConfirmations(coin, network, hash) {
    if (!ChainService.notifyConfirmations(coin, network)) return;

    const processTriggeredSubs = (subs, cb) => {
      async.each(subs, (sub: any) => {
        logger.debug('New tx confirmation ' + sub.txid);
        sub.isActive = false;
        this.storage.storeTxConfirmationSub(sub, err => {
          if (err) return cb(err);

          const notification = Notification.create({
            type: 'TxConfirmation',
            walletId: sub.walletId,
            creatorId: sub.copayerId,
            data: {
              txid: sub.txid,
              coin,
              network
              // TODO: amount
            }
          });
          this._storeAndBroadcastNotification(notification, cb);
        });
      });
    };

    const explorer = this.explorers[coin][network];
    if (!explorer) return;

    explorer.getTxidsInBlock(hash, (err, txids) => {
      if (err) {
        logger.error('Could not fetch txids from block ' + hash, err);
        return;
      }

      this.storage.fetchActiveTxConfirmationSubs(null, (err, subs) => {
        if (err) return;
        if (_.isEmpty(subs)) return;
        const indexedSubs = _.keyBy(subs, 'txid');
        const triggered = [];
        _.each(txids, txid => {
          if (indexedSubs[txid]) triggered.push(indexedSubs[txid]);
        });
        processTriggeredSubs(triggered, err => {
          if (err) {
            logger.error('Could not process tx confirmations', err);
          }
          return;
        });
      });
    });
  }

  _handleNewBlock(coin, network, hash) {
    logger.debug(`New ${coin}/${network} block ${hash}`);

    // clear height cache.
    const cacheKey = Storage.BCHEIGHT_KEY + ':' + coin + ':' + network;
    this.storage.clearGlobalCache(cacheKey, () => {});

    throttledNewBlocks(this, coin, network, hash);
  }

  _storeAndBroadcastNotification(notification, cb?: () => void) {
    this.storage.storeNotification(notification.walletId, notification, () => {
      this.messageBroker.send(notification);
      if (cb) return cb();
    });
  }
}
