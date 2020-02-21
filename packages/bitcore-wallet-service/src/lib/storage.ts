import * as async from 'async';
import _ from 'lodash';
import { Db } from 'mongodb';
import * as mongodb from 'mongodb';
import {
  Address,
  Email,
  Notification,
  Preferences,
  PushNotificationSub,
  Session,
  TxConfirmationSub,
  TxNote,
  TxProposal,
  Wallet
} from './model';

const BCHAddressTranslator = require('./bchaddresstranslator'); // only for migration
const $ = require('preconditions').singleton();
let log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

const collections = {
  // Duplciated in helpers.. TODO
  WALLETS: 'wallets',
  TXS: 'txs',
  ADDRESSES: 'addresses',
  NOTIFICATIONS: 'notifications',
  COPAYERS_LOOKUP: 'copayers_lookup',
  PREFERENCES: 'preferences',
  EMAIL_QUEUE: 'email_queue',
  CACHE: 'cache',
  FIAT_RATES2: 'fiat_rates2',
  TX_NOTES: 'tx_notes',
  SESSIONS: 'sessions',
  PUSH_NOTIFICATION_SUBS: 'push_notification_subs',
  TX_CONFIRMATION_SUBS: 'tx_confirmation_subs',
  LOCKS: 'locks'
};

export class Storage {
  static BCHEIGHT_KEY = 'bcheight';
  static collections = collections;
  db: Db;

  constructor(opts: { db?: Db } = {}) {
    opts = opts || {};
    this.db = opts.db;
  }

  static createIndexes(db) {
    log.info('Creating DB indexes');
    db.collection(collections.WALLETS).createIndex({
      id: 1
    });
    db.collection(collections.COPAYERS_LOOKUP).createIndex({
      copayerId: 1
    });
    db.collection(collections.COPAYERS_LOOKUP).createIndex({
      walletId: 1
    });
    db.collection(collections.TXS).createIndex({
      walletId: 1,
      id: 1
    });
    db.collection(collections.TXS).createIndex({
      walletId: 1,
      isPending: 1,
      txid: 1
    });
    db.collection(collections.TXS).createIndex({
      walletId: 1,
      createdOn: -1
    });
    db.collection(collections.TXS).createIndex({
      txid: 1
    });
    db.collection(collections.NOTIFICATIONS).createIndex({
      walletId: 1,
      id: 1
    });
    db.collection(collections.ADDRESSES).createIndex({
      walletId: 1,
      createdOn: 1
    });

    db.collection(collections.ADDRESSES).createIndex(
      {
        address: 1
      },
      { unique: true }
    );
    db.collection(collections.ADDRESSES).createIndex({
      address: 1,
      beRegistered: 1
    });
    db.collection(collections.ADDRESSES).createIndex({
      walletId: 1,
      address: 1
    });
    db.collection(collections.EMAIL_QUEUE).createIndex({
      id: 1
    });
    db.collection(collections.EMAIL_QUEUE).createIndex({
      notificationId: 1
    });
    db.collection(collections.CACHE).createIndex({
      walletId: 1,
      type: 1,
      key: 1
    });
    db.collection(collections.TX_NOTES).createIndex({
      walletId: 1,
      txid: 1
    });
    db.collection(collections.PREFERENCES).createIndex({
      walletId: 1
    });
    db.collection(collections.FIAT_RATES2).createIndex({
      coin: 1,
      code: 1,
      ts: 1
    });
    db.collection(collections.PUSH_NOTIFICATION_SUBS).createIndex({
      copayerId: 1
    });
    db.collection(collections.TX_CONFIRMATION_SUBS).createIndex({
      copayerId: 1,
      txid: 1
    });
    db.collection(collections.TX_CONFIRMATION_SUBS).createIndex({
      isActive: 1,
      copayerId: 1
    });
    db.collection(collections.SESSIONS).createIndex({
      copayerId: 1
    });
  }

  connect(opts, cb) {
    opts = opts || {};
    if (this.db) return cb();
    const config = opts.mongoDb || {};

    if (opts.secondaryPreferred) {
      if (config.uri.indexOf('?') > 0) {
        config.uri = config.uri + '&';
      } else {
        config.uri = config.uri + '?';
      }
      config.uri = config.uri + 'readPreference=secondaryPreferred';
      log.info('Read operations set to secondaryPreferred');
    }

    mongodb.MongoClient.connect(config.uri, (err, db) => {
      if (err) {
        log.error('Unable to connect to the mongoDB. Check the credentials.');
        return cb(err);
      }
      this.db = db;

      log.info('Connection established to mongoDB:' + config.uri);
      Storage.createIndexes(db);
      return cb();
    });
  }

  disconnect(cb) {
    this.db.close(true, err => {
      if (err) return cb(err);
      this.db = null;
      return cb();
    });
  }

  fetchWallet(id, cb: (err?: any, wallet?: Wallet) => void) {
    if (!this.db) return cb('not ready');

    this.db.collection(collections.WALLETS).findOne(
      {
        id
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return cb(null, Wallet.fromObj(result));
      }
    );
  }

  storeWallet(wallet, cb) {
    this.db.collection(collections.WALLETS).update(
      {
        id: wallet.id
      },
      wallet.toObject(),
      {
        w: 1,
        upsert: true
      },
      cb
    );
  }

  storeWalletAndUpdateCopayersLookup(wallet, cb) {
    const copayerLookups = _.map(wallet.copayers, copayer => {
      try {
        $.checkState(copayer.requestPubKeys);
      } catch (e) {
        return cb(e);
      }

      return {
        copayerId: copayer.id,
        walletId: wallet.id,
        requestPubKeys: copayer.requestPubKeys
      };
    });

    this.db.collection(collections.COPAYERS_LOOKUP).remove(
      {
        walletId: wallet.id
      },
      {
        w: 1
      },
      err => {
        if (err) return cb(err);
        this.db.collection(collections.COPAYERS_LOOKUP).insert(
          copayerLookups,
          {
            w: 1
          },
          err => {
            if (err) return cb(err);
            return this.storeWallet(wallet, cb);
          }
        );
      }
    );
  }

  fetchCopayerLookup(copayerId, cb) {
    this.db.collection(collections.COPAYERS_LOOKUP).findOne(
      {
        copayerId
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        if (!result.requestPubKeys) {
          result.requestPubKeys = [
            {
              key: result.requestPubKey,
              signature: result.signature
            }
          ];
        }

        return cb(null, result);
      }
    );
  }

  // TODO: should be done client-side
  _completeTxData(walletId, txs, cb) {
    this.fetchWallet(walletId, (err, wallet) => {
      if (err) return cb(err);
      _.each([].concat(txs), tx => {
        tx.derivationStrategy = wallet.derivationStrategy || 'BIP45';
        tx.creatorName = wallet.getCopayer(tx.creatorId).name;
        _.each(tx.actions, action => {
          action.copayerName = wallet.getCopayer(action.copayerId).name;
        });

        if (tx.status == 'accepted') tx.raw = tx.getRawTx();
      });
      return cb(null, txs);
    });
  }

  // TODO: remove walletId from signature
  fetchTx(walletId, txProposalId, cb) {
    if (!this.db) return cb();

    this.db.collection(collections.TXS).findOne(
      {
        id: txProposalId,
        walletId
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return this._completeTxData(walletId, TxProposal.fromObj(result), cb);
      }
    );
  }

  fetchTxByHash(hash, cb) {
    if (!this.db) return cb();

    this.db.collection(collections.TXS).findOne(
      {
        txid: hash
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return this._completeTxData(result.walletId, TxProposal.fromObj(result), cb);
      }
    );
  }

  fetchLastTxs(walletId, creatorId, limit, cb) {
    this.db
      .collection(collections.TXS)
      .find(
        {
          walletId,
          creatorId
        },
        {
          limit: limit || 5
        }
      )
      .sort({
        createdOn: -1
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        const txs = _.map(result, tx => {
          return TxProposal.fromObj(tx);
        });
        return cb(null, txs);
      });
  }

  fetchPendingTxs(walletId, cb) {
    this.db
      .collection(collections.TXS)
      .find({
        walletId,
        isPending: true
      })
      .sort({
        createdOn: -1
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        const txs = _.map(result, tx => {
          return TxProposal.fromObj(tx);
        });
        return this._completeTxData(walletId, txs, cb);
      });
  }

  /**
   * fetchTxs. Times are in UNIX EPOCH (seconds)
   *
   * @param walletId
   * @param opts.minTs
   * @param opts.maxTs
   * @param opts.limit
   */
  fetchTxs(walletId, opts, cb) {
    opts = opts || {};

    const tsFilter: { $gte?: number; $lte?: number } = {};
    if (_.isNumber(opts.minTs)) tsFilter.$gte = opts.minTs;
    if (_.isNumber(opts.maxTs)) tsFilter.$lte = opts.maxTs;

    const filter: { walletId: string; createdOn?: typeof tsFilter } = {
      walletId
    };
    if (!_.isEmpty(tsFilter)) filter.createdOn = tsFilter;

    const mods: { limit?: number } = {};
    if (_.isNumber(opts.limit)) mods.limit = opts.limit;

    this.db
      .collection(collections.TXS)
      .find(filter, mods)
      .sort({
        createdOn: -1
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        const txs = _.map(result, tx => {
          return TxProposal.fromObj(tx);
        });
        return this._completeTxData(walletId, txs, cb);
      });
  }

  /**
   * fetchBroadcastedTxs. Times are in UNIX EPOCH (seconds)
   *
   * @param walletId
   * @param opts.minTs
   * @param opts.maxTs
   * @param opts.limit
   */
  fetchBroadcastedTxs(walletId, opts, cb) {
    opts = opts || {};

    const tsFilter: { $gte?: number; $lte?: number } = {};
    if (_.isNumber(opts.minTs)) tsFilter.$gte = opts.minTs;
    if (_.isNumber(opts.maxTs)) tsFilter.$lte = opts.maxTs;

    const filter: {
      walletId: string;
      status: string;
      broadcastedOn?: typeof tsFilter;
    } = {
      walletId,
      status: 'broadcasted'
    };
    if (!_.isEmpty(tsFilter)) filter.broadcastedOn = tsFilter;

    const mods: { limit?: number } = {};
    if (_.isNumber(opts.limit)) mods.limit = opts.limit;

    this.db
      .collection(collections.TXS)
      .find(filter, mods)
      .sort({
        createdOn: -1
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        const txs = _.map(result, tx => {
          return TxProposal.fromObj(tx);
        });
        return this._completeTxData(walletId, txs, cb);
      });
  }

  /**
   * Retrieves notifications after a specific id or from a given ts (whichever is more recent).
   *
   * @param {String} notificationId
   * @param {Number} minTs
   * @returns {Notification[]} Notifications
   */
  fetchNotifications(walletId, notificationId, minTs, cb) {
    function makeId(timestamp) {
      return _.padStart(timestamp, 14, '0') + _.repeat('0', 4);
    }
    let minId = makeId(minTs);
    if (notificationId) {
      minId = notificationId > minId ? notificationId : minId;
    }

    this.db
      .collection(collections.NOTIFICATIONS)
      .find({
        walletId,
        id: {
          $gt: minId
        }
      })
      .sort({
        id: 1
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        const notifications = _.map(result, notification => {
          return Notification.fromObj(notification);
        });
        return cb(null, notifications);
      });
  }

  // TODO: remove walletId from signature
  storeNotification(walletId, notification, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      log.warn('Trying to store a notification with close DB', notification);
      return;
    }

    this.db.collection(collections.NOTIFICATIONS).insert(
      notification,
      {
        w: 1
      },
      cb
    );
  }

  // TODO: remove walletId from signature
  storeTx(walletId, txp, cb) {
    this.db.collection(collections.TXS).update(
      {
        id: txp.id,
        walletId
      },
      txp.toObject(),
      {
        w: 1,
        upsert: true
      },
      cb
    );
  }

  removeTx(walletId, txProposalId, cb) {
    this.db.collection(collections.TXS).remove(
      {
        id: txProposalId,
        walletId
      },
      {
        w: 1
      },
      cb
    );
  }

  removeWallet(walletId, cb) {
    async.parallel(
      [
        next => {
          this.db.collection(collections.WALLETS).remove(
            {
              id: walletId
            },
            next
          );
        },
        next => {
          const otherCollections: string[] = _.without(_.values(collections), collections.WALLETS);
          async.each(
            otherCollections,
            (col, next) => {
              this.db.collection(col).remove(
                {
                  walletId
                },
                next
              );
            },
            next
          );
        }
      ],
      cb
    );
  }

  fetchAddresses(walletId, cb) {
    this.db
      .collection(collections.ADDRESSES)
      .find({
        walletId
      })
      .sort({
        createdOn: 1
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, result.map(Address.fromObj));
      });
  }

  migrateToCashAddr(walletId, cb) {
    const cursor = this.db.collection(collections.ADDRESSES).find({
      walletId
    });

    cursor.on('end', () => {
      console.log(`Migration to cash address of ${walletId} Finished`);
      return this.clearWalletCache(walletId, cb);
    });

    cursor.on('err', err => {
      return cb(err);
    });

    cursor.on('data', doc => {
      cursor.pause();
      let x;
      try {
        x = BCHAddressTranslator.translate(doc.address, 'cashaddr');
      } catch (e) {
        return cb(e);
      }

      this.db.collection(collections.ADDRESSES).update({ _id: doc._id }, { $set: { address: x } }, { multi: true });
      cursor.resume();
    });
  }

  fetchUnsyncAddresses(walletId, cb) {
    this.db
      .collection(collections.ADDRESSES)
      .find({
        walletId,
        beRegistered: null
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return cb(null, result);
      });
  }

  fetchNewAddresses(walletId, fromTs, cb) {
    this.db
      .collection(collections.ADDRESSES)
      .find({
        walletId,
        createdOn: {
          $gte: fromTs
        }
      })
      .sort({
        createdOn: 1
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return cb(null, result.map(Address.fromObj));
      });
  }

  storeAddress(address, cb) {
    this.db.collection(collections.ADDRESSES).update(
      {
        walletId: address.walletId,
        address: address.address
      },
      address,
      {
        w: 1,
        upsert: false
      },
      cb
    );
  }

  markSyncedAddresses(addresses, cb) {
    this.db.collection(collections.ADDRESSES).updateMany(
      {
        address: { $in: addresses }
      },
      { $set: { beRegistered: true } },
      {
        w: 1,
        upsert: false
      },
      cb
    );
  }

  deregisterWallet(walletId, cb) {
    this.db.collection(collections.WALLETS).update(
      {
        id: walletId
      },
      { $set: { beRegistered: null } },
      {
        w: 1,
        upsert: false
      },
      () => {
        this.db.collection(collections.ADDRESSES).update(
          {
            walletId
          },
          { $set: { beRegistered: null } },
          {
            w: 1,
            upsert: false,
            multi: true
          },
          () => {
            this.clearWalletCache(walletId, cb);
          }
        );
      }
    );
  }

  storeAddressAndWallet(wallet, addresses, cb) {
    const clonedAddresses = [].concat(addresses);
    if (_.isEmpty(addresses)) return cb();
    let duplicate;

    this.db.collection(collections.ADDRESSES).insert(
      clonedAddresses,
      {
        w: 1
      },
      err => {
        // duplicate address?
        if (err) {
          if (!err.toString().match(/E11000/)) {
            return cb(err);
          } else {
            // just return it
            duplicate = true;
            log.warn('Found duplicate address: ' + _.join(_.map(clonedAddresses, 'address'), ','));
          }
        }
        this.storeWallet(wallet, err => {
          return cb(err, duplicate);
        });
      }
    );
  }

  fetchAddressByWalletId(walletId, address, cb) {
    this.db.collection(collections.ADDRESSES).findOne(
      {
        walletId,
        address
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, Address.fromObj(result));
      }
    );
  }

  fetchAddressesByWalletId(walletId, addresses, cb) {
    this.db
      .collection(collections.ADDRESSES)
      .find(
        {
          walletId,
          address: { $in: addresses }
        },
        {}
      )
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return cb(null, result);
      });
  }

  fetchAddressByCoin(coin, address, cb) {
    if (!this.db) return cb();

    this.db
      .collection(collections.ADDRESSES)
      .find({
        address
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result || _.isEmpty(result)) return cb();
        if (result.length > 1) {
          result = _.find(result, address => {
            return coin == (address.coin || 'btc');
          });
        } else {
          result = _.head(result);
        }
        if (!result) return cb();

        return cb(null, Address.fromObj(result));
      });
  }

  fetchPreferences(walletId, copayerId, cb) {
    this.db
      .collection(collections.PREFERENCES)
      .find({
        walletId
      })
      .toArray((err, result) => {
        if (err) return cb(err);

        if (copayerId) {
          result = _.find(result, {
            copayerId
          });
        }
        if (!result) return cb();

        const preferences = _.map([].concat(result), r => {
          return Preferences.fromObj(r);
        });
        if (copayerId) {
          // TODO: review if returs are correct
          return cb(null, preferences[0]);
        } else {
          return cb(null, preferences);
        }
      });
  }

  storePreferences(preferences, cb) {
    this.db.collection(collections.PREFERENCES).update(
      {
        walletId: preferences.walletId,
        copayerId: preferences.copayerId
      },
      preferences,
      {
        w: 1,
        upsert: true
      },
      cb
    );
  }

  storeEmail(email, cb) {
    this.db.collection(collections.EMAIL_QUEUE).update(
      {
        id: email.id
      },
      email,
      {
        w: 1,
        upsert: true
      },
      cb
    );
  }

  fetchUnsentEmails(cb) {
    this.db
      .collection(collections.EMAIL_QUEUE)
      .find({
        status: 'fail'
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result || _.isEmpty(result)) return cb(null, []);

        const emails = _.map(result, x => {
          return Email.fromObj(x);
        });

        return cb(null, emails);
      });
  }

  fetchEmailByNotification(notificationId, cb) {
    this.db.collection(collections.EMAIL_QUEUE).findOne(
      {
        notificationId
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, Email.fromObj(result));
      }
    );
  }

  getTxHistoryCacheStatusV8(walletId, cb) {
    this.db.collection(collections.CACHE).findOne(
      {
        walletId,
        type: 'historyCacheStatusV8',
        key: null
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result)
          return cb(null, {
            tipId: null,
            tipIndex: null
          });

        return cb(null, {
          updatedOn: result.updatedOn,
          updatedHeight: result.updatedHeight,
          tipIndex: result.tipIndex,
          tipTxId: result.tipTxId,
          tipHeight: result.tipHeight
        });
      }
    );
  }

  getWalletAddressChecked(walletId, cb) {
    this.db.collection(collections.CACHE).findOne(
      {
        walletId,
        type: 'addressChecked',
        key: null
      },
      (err, result) => {
        if (err || !result) return cb(err);
        return cb(null, result.totalAddresses);
      }
    );
  }

  setWalletAddressChecked(walletId, totalAddresses, cb) {
    this.db.collection(collections.CACHE).update(
      {
        walletId,
        type: 'addressChecked',
        key: null
      },
      {
        walletId,
        type: 'addressChecked',
        key: null,
        totalAddresses
      },
      {
        w: 1,
        upsert: true
      },
      cb
    );
  }

  // Since cache TX are "hard confirmed" skip, and limit
  // should be reliable to query the database.
  //
  //
  // skip=0 -> Latest TX of the wallet. (heights heigth, -1 doest not count because this
  // are confirmed TXs).
  //
  // In a query, tipIndex - skip - limit would be the oldest tx to be queried.

  getTxHistoryCacheV8(walletId, skip, limit, cb) {
    $.checkArgument(skip >= 0);
    $.checkArgument(limit >= 0);

    this.getTxHistoryCacheStatusV8(walletId, (err, cacheStatus) => {
      if (err) return cb(err);

      if (_.isNull(cacheStatus.tipId)) return cb(null, []);
      // console.log('Cache status in GET:', cacheStatus); //TODO

      let firstPosition = cacheStatus.tipIndex - skip - limit + 1;
      const lastPosition = cacheStatus.tipIndex - skip + 1;

      if (firstPosition < 0) firstPosition = 0;
      if (lastPosition <= 0) return cb(null, []);

      // console.log('[storage.js.750:first/lastPosition:]',firstPosition + '/'+lastPosition); //TODO

      this.db
        .collection(collections.CACHE)
        .find({
          walletId,
          type: 'historyCacheV8',
          key: {
            $gte: firstPosition,
            $lt: lastPosition
          }
        })
        .sort({
          key: -1
        })
        .toArray((err, result) => {
          if (err) return cb(err);
          if (!result) return cb();
          const txs = _.map(result, 'tx');
          return cb(null, txs);
        });
    });
  }

  clearWalletCache(walletId, cb) {
    this.db.collection(collections.CACHE).deleteMany(
      {
        walletId
      },
      {},
      cb
    );
  }

  /*
   * This represent a ongoing query stream from a Wallet client
   */
  storeTxHistoryStreamV8(walletId, streamKey, items, cb) {
    // only 1 per wallet is allowed
    this.db.collection(collections.CACHE).update(
      {
        walletId,
        type: 'historyStream',
        key: null
      },
      {
        walletId,
        type: 'historyStream',
        key: null,
        streamKey,
        items
      },
      {
        w: 1,
        upsert: true
      },
      cb
    );
  }

  clearTxHistoryStreamV8(walletId, cb) {
    this.db.collection(collections.CACHE).deleteMany(
      {
        walletId,
        type: 'historyStream',
        key: null
      },
      {},
      cb
    );
  }

  getTxHistoryStreamV8(walletId, cb) {
    this.db.collection(collections.CACHE).findOne(
      {
        walletId,
        type: 'historyStream',
        key: null
      },
      (err, result) => {
        if (err || !result) return cb(err);
        return cb(null, result);
      }
    );
  }

  /*
   * @param {string} [opts.walletId] - The wallet id to use as current wallet
   * @param {tipIndex} [integer] - Last tx index of the current cache
   * @param {array} [items] - The items (transactions) to store
   * @param {updateHeight} [integer] - The blockchain height up to which the transactions where queried, with CONFIRMATIONS_TO_START_CACHING subtracted.
   *
   *
   */
  storeTxHistoryCacheV8(walletId, tipIndex, items, updateHeight, cb) {
    let index = _.isNull(tipIndex) ? 0 : tipIndex + 1;
    let pos;

    // `items` must be ordeder: first item [0]: most recent.
    //
    // In cache:
    // pos = 0; oldest one.
    // pos = tipIndex (item[0] => most recent).

    _.each(items.reverse(), item => {
      item.position = index++;
    });
    async.each(
      items,
      (item: { position: number; code: string; value: string }, next) => {
        pos = item.position;
        delete item.position;
        // console.log('STORING [storage.js.804:at:]',pos, item.blockheight);
        this.db.collection(collections.CACHE).insert(
          {
            walletId,
            type: 'historyCacheV8',
            key: pos,
            tx: item
          },
          next
        );
      },
      err => {
        if (err) return cb(err);

        interface CacheItem {
          txid?: string;
          blockheight?: number;
        }
        const first: CacheItem = _.first(items);
        const last: CacheItem = _.last(items);

        try {
          $.checkState(last.txid, 'missing txid in tx to be cached');
          $.checkState(last.blockheight, 'missing blockheight in tx to be cached');
          $.checkState(first.blockheight, 'missing blockheight in tx to be cached');
          $.checkState(last.blockheight >= 0, 'blockheight <=0 om tx to be cached');

          // note there is a .reverse before.
          $.checkState(
            first.blockheight <= last.blockheight,
            'tx to be cached are in wrong order (lastest should be first)'
          );
        } catch (e) {
          return cb(e);
        }

        log.debug(`Cache Last Item: ${last.txid} blockh: ${last.blockheight} updatedh: ${updateHeight}`);
        this.db.collection(collections.CACHE).update(
          {
            walletId,
            type: 'historyCacheStatusV8',
            key: null
          },
          {
            walletId,
            type: 'historyCacheStatusV8',
            key: null,
            updatedOn: Date.now(),
            updatedHeight: updateHeight,
            tipIndex: pos,
            tipTxId: last.txid,
            tipHeight: last.blockheight
          },
          {
            w: 1,
            upsert: true
          },
          cb
        );
      }
    );
  }

  storeFiatRate(coin, rates, cb) {
    const now = Date.now();
    async.each(
      rates,
      (rate: { code: string; value: string }, next) => {
        let i = {
          ts: now,
          coin,
          code: rate.code,
          value: rate.value
        };
        this.db.collection(collections.FIAT_RATES2).insert(
          i,
          {
            w: 1
          },
          next
        );
      },
      cb
    );
  }

  fetchFiatRate(coin, code, ts, cb) {
    this.db
      .collection(collections.FIAT_RATES2)
      .find({
        coin,
        code,
        ts: {
          $lte: ts
        }
      })
      .sort({
        ts: -1
      })
      .limit(1)
      .toArray((err, result) => {
        if (err || _.isEmpty(result)) return cb(err);
        return cb(null, result[0]);
      });
  }

  fetchTxNote(walletId, txid, cb) {
    this.db.collection(collections.TX_NOTES).findOne(
      {
        walletId,
        txid
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return this._completeTxNotesData(walletId, TxNote.fromObj(result), cb);
      }
    );
  }

  // TODO: should be done client-side
  _completeTxNotesData(walletId, notes, cb) {
    this.fetchWallet(walletId, (err, wallet) => {
      if (err) return cb(err);
      _.each([].concat(notes), note => {
        note.editedByName = wallet.getCopayer(note.editedBy).name;
      });
      return cb(null, notes);
    });
  }

  /**
   * fetchTxNotes. Times are in UNIX EPOCH (seconds)
   *
   * @param walletId
   * @param opts.minTs
   */
  fetchTxNotes(walletId, opts, cb) {
    const filter: { walletId: string; editedOn?: { $gte: number } } = {
      walletId
    };
    if (_.isNumber(opts.minTs))
      filter.editedOn = {
        $gte: opts.minTs
      };
    this.db
      .collection(collections.TX_NOTES)
      .find(filter)
      .toArray((err, result) => {
        if (err) return cb(err);
        const notes = _.compact(
          _.map(result, note => {
            return TxNote.fromObj(note);
          })
        );
        return this._completeTxNotesData(walletId, notes, cb);
      });
  }

  storeTxNote(txNote, cb) {
    this.db.collection(collections.TX_NOTES).update(
      {
        txid: txNote.txid,
        walletId: txNote.walletId
      },
      txNote.toObject(),
      {
        w: 1,
        upsert: true
      },
      cb
    );
  }

  getSession(copayerId, cb) {
    this.db.collection(collections.SESSIONS).findOne(
      {
        copayerId
      },
      (err, result) => {
        if (err || !result) return cb(err);
        return cb(null, Session.fromObj(result));
      }
    );
  }

  storeSession(session, cb) {
    this.db.collection(collections.SESSIONS).update(
      {
        copayerId: session.copayerId
      },
      session.toObject(),
      {
        w: 1,
        upsert: true
      },
      cb
    );
  }

  fetchPushNotificationSubs(copayerId, cb) {
    this.db
      .collection(collections.PUSH_NOTIFICATION_SUBS)
      .find({
        copayerId
      })
      .toArray((err, result) => {
        if (err) return cb(err);

        if (!result) return cb();

        const tokens = _.map([].concat(result), r => {
          return PushNotificationSub.fromObj(r);
        });
        return cb(null, tokens);
      });
  }

  storePushNotificationSub(pushNotificationSub, cb) {
    this.db.collection(collections.PUSH_NOTIFICATION_SUBS).update(
      {
        copayerId: pushNotificationSub.copayerId,
        token: pushNotificationSub.token
      },
      pushNotificationSub,
      {
        w: 1,
        upsert: true
      },
      cb
    );
  }

  removePushNotificationSub(copayerId, token, cb) {
    this.db.collection(collections.PUSH_NOTIFICATION_SUBS).remove(
      {
        copayerId,
        token
      },
      {
        w: 1
      },
      cb
    );
  }

  fetchActiveTxConfirmationSubs(copayerId, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      log.warn('Trying to fetch notifications with closed DB');
      return;
    }

    const filter: { isActive: boolean; copayerId?: string } = {
      isActive: true
    };

    if (copayerId) filter.copayerId = copayerId;

    this.db
      .collection(collections.TX_CONFIRMATION_SUBS)
      .find(filter)
      .toArray((err, result) => {
        if (err) return cb(err);

        if (!result) return cb();

        const subs = _.map([].concat(result), r => {
          return TxConfirmationSub.fromObj(r);
        });
        return cb(null, subs);
      });
  }

  storeTxConfirmationSub(txConfirmationSub, cb) {
    this.db.collection(collections.TX_CONFIRMATION_SUBS).update(
      {
        copayerId: txConfirmationSub.copayerId,
        txid: txConfirmationSub.txid
      },
      txConfirmationSub,
      {
        w: 1,
        upsert: true
      },
      cb
    );
  }

  removeTxConfirmationSub(copayerId, txid, cb) {
    this.db.collection(collections.TX_CONFIRMATION_SUBS).remove(
      {
        copayerId,
        txid
      },
      {
        w: 1
      },
      cb
    );
  }

  _dump(cb, fn) {
    fn = fn || console.log;
    cb = cb || function() {};

    this.db.collections((err, collections) => {
      if (err) return cb(err);
      async.eachSeries(
        collections,
        (col: any, next) => {
          col.find().toArray((err, items) => {
            fn('--------', col.s.name);
            fn(items);
            fn('------------------------------------------------------------------\n\n');
            next(err);
          });
        },
        cb
      );
    });
  }

  // key: 'feeLevel' + JSON.stringify(opts);
  // duration: FEE_LEVEL_DURATION
  //

  checkAndUseGlobalCache(key, duration, cb) {
    const now = Date.now();
    this.db.collection(collections.CACHE).findOne(
      {
        key,
        walletId: null,
        type: null
      },
      (err, ret) => {
        if (err) return cb(err);
        if (!ret) return cb();
        const validFor = ret.ts + duration - now;

        // always return the value as a 3 param anyways.
        return cb(null, validFor > 0 ? ret.result : null, ret.result);
      }
    );
  }

  storeGlobalCache(key, values, cb) {
    const now = Date.now();
    this.db.collection(collections.CACHE).update(
      {
        key,
        walletId: null,
        type: null
      },
      {
        $set: {
          ts: now,
          result: values
        }
      },
      {
        w: 1,
        upsert: true
      },
      cb
    );
  }

  clearGlobalCache(key, cb) {
    this.db.collection(collections.CACHE).remove(
      {
        key,
        walletId: null,
        type: null
      },
      {
        w: 1
      },
      cb
    );
  }

  walletCheck = async params => {
    const { walletId } = params;

    return new Promise(resolve => {
      const addressStream = this.db.collection(collections.ADDRESSES).find({ walletId });
      let sum = 0;
      let lastAddress;
      addressStream.on('data', walletAddress => {
        if (walletAddress.address) {
          lastAddress = walletAddress.address.replace(/:.*$/, '');
          const addressSum = Buffer.from(lastAddress).reduce((tot, cur) => (tot + cur) % Number.MAX_SAFE_INTEGER);
          sum = (sum + addressSum) % Number.MAX_SAFE_INTEGER;
        }
      });
      addressStream.on('end', () => {
        resolve({ lastAddress, sum });
      });
    });
  };

  acquireLock(key, expireTs, cb) {
    this.db.collection(collections.LOCKS).insert(
      {
        _id: key,
        expireOn: expireTs
      },
      {},
      cb
    );
  }

  releaseLock(key, cb) {
    this.db.collection(collections.LOCKS).remove(
      {
        _id: key
      },
      {},
      cb
    );
  }

  clearExpiredLock(key, cb) {
    this.db.collection(collections.LOCKS).findOne(
      {
        _id: key
      },
      (err, ret) => {
        if (err || !ret) return;

        if (ret.expireOn < Date.now()) {
          log.info('Releasing expired lock : ' + key);
          return this.releaseLock(key, cb);
        }
        return cb();
      }
    );
  }
}
