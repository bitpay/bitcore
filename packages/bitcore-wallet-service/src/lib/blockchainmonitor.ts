import * as async from 'async';
import _ from 'lodash';
import { BlockChainExplorer } from './blockchainexplorer';
import { Lock } from './lock';
import { MessageBroker } from './messagebroker';
import { Notification } from './model/notification';
import { WalletService } from './server';
import { Storage } from './storage';

const $ = require('preconditions').singleton();
const Common = require('./common');
const Constants = Common.Constants;
const Utils = Common.Utils;
let log = require('npmlog');
log.debug = log.verbose;

export class BlockchainMonitor {
  explorers: any;
  storage: Storage;
  messageBroker: MessageBroker;
  lock: Lock;
  walletId: string;

  start(opts, cb) {
    opts = opts || {};

    async.parallel(
      [
        (done) => {
          this.explorers = {
            btc: {},
            bch: {}
          };

          const coinNetworkPairs = [];
          _.each(_.values(Constants.COINS), (coin) => {
            _.each(_.values(Constants.NETWORKS), (network) => {
              coinNetworkPairs.push({
                coin,
                network
              });
            });
          });
          _.each(coinNetworkPairs, (pair) => {
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
        (done) => {
          if (opts.storage) {
            this.storage = opts.storage;
            done();
          } else {
            this.storage = new Storage();
            this.storage.connect(
              opts.storageOpts,
              done
            );
          }
        },
        (done) => {
          this.messageBroker =
            opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
          done();
        },
        (done) => {
          this.lock = opts.lock || new Lock(opts.lockOpts);
          done();
        }
      ],
      (err) => {
        if (err) {
          log.error(err);
        }
        return cb(err);
      }
    );
  }

  _initExplorer(coin, network, explorer) {
    explorer.initSocket({
      onTx: _.bind(this._handleThirdPartyBroadcasts, this, coin, network),
      onBlock: _.bind(this._handleNewBlock, this, coin, network),
      onIncomingPayments: _.bind(
        this._handleIncomingPayments,
        this,
        coin,
        network
      )
    });
  }

  _handleThirdPartyBroadcasts(coin, network, data, processIt) {
    if (!data || !data.txid) return;
    // log.info(`New ${coin}/${network} tx: ${data.txid}`);

    this.storage.fetchTxByHash(data.txid, (err, txp) => {
      if (err) {
        log.error('Could not fetch tx from the db');
        return;
      }
      if (!txp || txp.status != 'accepted') return;

      const walletId = txp.walletId;

      if (!processIt) {
        log.info(
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
        return setTimeout(
          this._handleThirdPartyBroadcasts.bind(
            this,
            coin,
            network,
            data,
            true
          ),
          20 * 1000
        );
      }

      log.info(
        'Processing accepted txp [' +
        txp.id +
        '] for wallet ' +
        walletId +
        ' [' +
        txp.amount +
        'sat ]'
      );

      txp.setBroadcasted();

      this.storage.storeTx(this.walletId, txp, (err) => {
        if (err) log.error('Could not save TX');

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
    // console.log('[blockchainmonitor.js.158:data:]',data); //TODO

    let outs: any[];
    // ! v8?
    if (!data.outs) {
      if (!data.vout) return;
      outs = _.compact(
        _.map(data.vout, (v) => {
          let addr = _.keys(v)[0];
          const amount = +v[addr];

          // This is because a bug on insight, that always return no copay addr
          if (coin == 'bch' && Utils.getAddressCoin(addr) != 'bch') {
            addr = Utils.translateAddress(addr, coin);
          }

          return {
            address: addr,
            amount
          };
        })
      );
      if (_.isEmpty(outs)) return;
    } else {
      outs = data.outs;
      _.each(outs, x => {
        if (x.amount) {
          // to satoshis
          x.amount = +(x.amount * 1e8).toFixed(0);
        }
      });
    }
    async.each(
      outs,
      (out, next) => {
        if (!out.address) return next();

        // toDo, remove coin  here: no more same address for diff coins
        this.storage.fetchAddressByCoin(coin, out.address, (
          err,
          address
        ) => {
          if (err) {
            log.error('Could not fetch addresses from the db');
            return next(err);
          }
          if (!address || address.isChange) return next();

          const walletId = address.walletId;
          log.info(
            'Incoming tx for wallet ' +
            walletId +
            ' [' +
            out.amount +
            'sat -> ' +
            out.address +
            ']'
          );

          const fromTs = Date.now() - 24 * 3600 * 1000;
          this.storage.fetchNotifications(walletId, null, fromTs, (
            err,
            notifications
          ) => {
            if (err) return next(err);
            const alreadyNotified = _.some(notifications, (n) => {
              return (
                n.type == 'NewIncomingTx' && n.data && n.data.txid == data.txid
              );
            });
            if (alreadyNotified) {
              log.info(
                'The incoming tx ' + data.txid + ' was already notified'
              );
              return next();
            }

            const notification = Notification.create({
              type: 'NewIncomingTx',
              data: {
                txid: data.txid,
                address: out.address,
                amount: out.amount
              },
              walletId
            });

            this._storeAndBroadcastNotification(notification, next);
          });
        });
      },
      (err) => {
        return;
      }
    );
  }

  _notifyNewBlock(coin, network, hash) {
    log.info(`New ${coin}/${network} block ${hash}`);
    const notification = Notification.create({
      type: 'NewBlock',
      walletId: network, // use network name as wallet id for global notifications
      data: {
        hash,
        coin,
        network
      }
    });

    this._storeAndBroadcastNotification(notification, () => { });
  }

  _handleTxConfirmations(coin, network, hash) {
    const processTriggeredSubs = (subs, cb) => {
      async.each(subs, (sub: any) => {
        log.info('New tx confirmation ' + sub.txid);
        sub.isActive = false;
        this.storage.storeTxConfirmationSub(sub, (err) => {
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
        log.error('Could not fetch txids from block ' + hash, err);
        return;
      }

      this.storage.fetchActiveTxConfirmationSubs(null, (err, subs) => {
        if (err) return;
        if (_.isEmpty(subs)) return;
        const indexedSubs = _.keyBy(subs, 'txid');
        const triggered = [];
        _.each(txids, (txid) => {
          if (indexedSubs[txid]) triggered.push(indexedSubs[txid]);
        });
        processTriggeredSubs(triggered, (err) => {
          if (err) {
            log.error('Could not process tx confirmations', err);
          }
          return;
        });
      });
    });
  }

  _handleNewBlock(coin, network, hash) {
    // clear height cache.
    const cacheKey = Storage.BCHEIGHT_KEY + ':' + coin + ':' + network;

    this.storage.clearGlobalCache(cacheKey, () => { });

    this._notifyNewBlock(coin, network, hash);
    this._handleTxConfirmations(coin, network, hash);
  }

  _storeAndBroadcastNotification(notification, cb?: () => void) {
    this.storage.storeNotification(
      notification.walletId,
      notification,
      () => {
        this.messageBroker.send(notification);
        if (cb) return cb();
      }
    );
  }
}
