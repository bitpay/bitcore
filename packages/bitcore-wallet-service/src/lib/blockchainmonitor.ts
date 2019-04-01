'use strict';
import { BlockChainExplorer } from './blockchainexplorer';
import { Lock } from './lock';
import { MessageBroker } from './messagebroker';
import { Notification } from './model/notification';
import { WalletService } from './server';
import { Storage } from './storage';

var $ = require('preconditions').singleton();
var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;

var Common = require('./common');
var Constants = Common.Constants;
var Utils = Common.Utils;

export class BlockchainMonitor {
  explorers: any;
  storage: Storage;
  messageBroker: MessageBroker;
  lock: Lock;
  walletId: string;

  start(opts, cb) {
    opts = opts || {};

    var self = this;

    async.parallel(
      [
        function(done) {
          self.explorers = {
            btc: {},
            bch: {}
          };

          var coinNetworkPairs = [];
          _.each(_.values(Constants.COINS), function(coin) {
            _.each(_.values(Constants.NETWORKS), function(network) {
              coinNetworkPairs.push({
                coin,
                network
              });
            });
          });
          _.each(coinNetworkPairs, function(pair) {
            var explorer;
            if (
              opts.blockchainExplorers &&
              opts.blockchainExplorers[pair.coin] &&
              opts.blockchainExplorers[pair.coin][pair.network]
            ) {
              explorer = opts.blockchainExplorers[pair.coin][pair.network];
            } else {
              var config: { url?: string; provider?: any } = {};
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
            self._initExplorer(pair.coin, pair.network, explorer);
            self.explorers[pair.coin][pair.network] = explorer;
          });
          done();
        },
        function(done) {
          if (opts.storage) {
            self.storage = opts.storage;
            done();
          } else {
            self.storage = new Storage();
            self.storage.connect(
              opts.storageOpts,
              done
            );
          }
        },
        function(done) {
          self.messageBroker =
            opts.messageBroker || new MessageBroker(opts.messageBrokerOpts);
          done();
        },
        function(done) {
          self.lock = opts.lock || new Lock(opts.lockOpts);
          done();
        }
      ],
      function(err) {
        if (err) {
          log.error(err);
        }
        return cb(err);
      }
    );
  }

  _initExplorer(coin, network, explorer) {
    var self = this;

    explorer.initSocket({
      onTx: _.bind(self._handleThirdPartyBroadcasts, self, coin, network),
      onBlock: _.bind(self._handleNewBlock, self, coin, network),
      onIncomingPayments: _.bind(
        self._handleIncomingPayments,
        self,
        coin,
        network
      )
    });
  }

  _handleThirdPartyBroadcasts(coin, network, data, processIt) {
    var self = this;
    if (!data || !data.txid) return;
    // log.info(`New ${coin}/${network} tx: ${data.txid}`);

    self.storage.fetchTxByHash(data.txid, function(err, txp) {
      if (err) {
        log.error('Could not fetch tx from the db');
        return;
      }
      if (!txp || txp.status != 'accepted') return;

      var walletId = txp.walletId;

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
          self._handleThirdPartyBroadcasts.bind(
            self,
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

      self.storage.storeTx(self.walletId, txp, function(err) {
        if (err) log.error('Could not save TX');

        var args = {
          txProposalId: txp.id,
          txid: data.txid,
          amount: txp.getTotalAmount()
        };

        var notification = Notification.create({
          type: 'NewOutgoingTxByThirdParty',
          data: args,
          walletId
        });
        self._storeAndBroadcastNotification(notification);
      });
    });
  }

  _handleIncomingPayments(coin, network, data) {
    var self = this;
    if (!data) return;
    // console.log('[blockchainmonitor.js.158:data:]',data); //TODO

    var outs;
    // ! v8?
    if (!data.outs) {
      if (!data.vout) return;
      outs = _.compact(
        _.map(data.vout, function(v) {
          var addr = _.keys(v)[0];
          var amount = +v[addr];

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
      function(out, next) {
        if (!out.address) return next();

        // toDo, remove coin  here: no more same address for diff coins
        self.storage.fetchAddressByCoin(coin, out.address, function(
          err,
          address
        ) {
          if (err) {
            log.error('Could not fetch addresses from the db');
            return next(err);
          }
          if (!address || address.isChange) return next();

          var walletId = address.walletId;
          log.info(
            'Incoming tx for wallet ' +
              walletId +
              ' [' +
              out.amount +
              'sat -> ' +
              out.address +
              ']'
          );

          var fromTs = Date.now() - 24 * 3600 * 1000;
          self.storage.fetchNotifications(walletId, null, fromTs, function(
            err,
            notifications
          ) {
            if (err) return next(err);
            var alreadyNotified = _.some(notifications, function(n) {
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

            var notification = Notification.create({
              type: 'NewIncomingTx',
              data: {
                txid: data.txid,
                address: out.address,
                amount: out.amount
              },
              walletId
            });

            self._storeAndBroadcastNotification(notification, next);
          });
        });
      },
      function(err) {
        return;
      }
    );
  }

  _notifyNewBlock(coin, network, hash) {
    var self = this;

    log.info(`New ${coin}/${network} block ${hash}`);
    var notification = Notification.create({
      type: 'NewBlock',
      walletId: network, // use network name as wallet id for global notifications
      data: {
        hash,
        coin,
        network
      }
    });

    self._storeAndBroadcastNotification(notification, () => {});
  }

  _handleTxConfirmations(coin, network, hash) {
    var self = this;

    function processTriggeredSubs(subs, cb) {
      async.each(subs, function(sub) {
        log.info('New tx confirmation ' + sub.txid);
        sub.isActive = false;
        self.storage.storeTxConfirmationSub(sub, function(err) {
          if (err) return cb(err);

          var notification = Notification.create({
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
          self._storeAndBroadcastNotification(notification, cb);
        });
      });
    }

    var explorer = self.explorers[coin][network];
    if (!explorer) return;

    explorer.getTxidsInBlock(hash, function(err, txids) {
      if (err) {
        log.error('Could not fetch txids from block ' + hash, err);
        return;
      }

      self.storage.fetchActiveTxConfirmationSubs(null, function(err, subs) {
        if (err) return;
        if (_.isEmpty(subs)) return;
        var indexedSubs = _.keyBy(subs, 'txid');
        var triggered = [];
        _.each(txids, function(txid) {
          if (indexedSubs[txid]) triggered.push(indexedSubs[txid]);
        });
        processTriggeredSubs(triggered, function(err) {
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
    let cacheKey = Storage.BCHEIGHT_KEY + ':' + coin + ':' + network;

    this.storage.clearGlobalCache(cacheKey, () => {});

    this._notifyNewBlock(coin, network, hash);
    this._handleTxConfirmations(coin, network, hash);
  }

  _storeAndBroadcastNotification(notification, cb?: () => void) {
    var self = this;

    self.storage.storeNotification(
      notification.walletId,
      notification,
      function() {
        self.messageBroker.send(notification);
        if (cb) return cb();
      }
    );
  }
}
