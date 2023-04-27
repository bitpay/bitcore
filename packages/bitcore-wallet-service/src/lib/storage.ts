import * as async from 'async';
import { AnyRecordWithTtl } from 'dns';
import _, { countBy, isNull, isUndefined } from 'lodash';
import moment from 'moment';
import { Db } from 'mongodb';
import * as mongodb from 'mongodb';
import { TokenInfo } from './chain/xec';
import logger from './logger';
import {
  Address,
  Advertisement,
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
import { CoinConfig } from './model/config-swap';
import { ConversionOrder } from './model/conversionOrder';
import { DonationStorage } from './model/donation';
import { MerchantOrder } from './model/merchantorder';
import { Order } from './model/order';
import { OrderInfoNoti } from './model/OrderInfoNoti';
import { IUser } from './model/user';
import { ICoinConfigFilter } from './server';
// import { Order } from './model/order';
const mongoDbQueue = require('../../node_modules/mongodb-queue');

const BCHAddressTranslator = require('./bchaddresstranslator'); // only for migration
const $ = require('preconditions').singleton();

const collections = {
  // Duplciated in helpers.. TODO
  WALLETS: 'wallets',
  USER: 'user',
  USER_CONVERSION: 'user_conversion',
  COIN_CONFIG: 'coin_config',
  KEYS: 'keys',
  KEYS_CONVERSION: 'keys_conversion',
  TXS: 'txs',
  ADDRESSES: 'addresses',
  ADVERTISEMENTS: 'advertisements',
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
  LOCKS: 'locks',
  DONATION: 'donation',
  TOKEN_INFO: 'token_info',
  ORDER_INFO: 'order_info',
  CONVERSION_ORDER_INFO: 'conversion_order_info',
  MERCHANT_ORDER: 'merchant_order',
  USER_WATCH_ADDRESS: 'user_watch_address',
  ORDER_INFO_NOTI: 'order_info_noti',
  ORDER_QUEUE: 'order_queue'
};

const Common = require('./common');
const Constants = Common.Constants;
const Defaults = Common.Defaults;

const ObjectID = mongodb.ObjectID;

var objectIdDate = function(date) {
  return Math.floor(date / 1000).toString(16) + '0000000000000000';
};
export class Storage {
  static BCHEIGHT_KEY = 'bcheight';
  static collections = collections;
  db: Db;
  queue: any;
  orderQueue: any;
  conversionOrderQueue: any;
  merchantOrderQueue: any;
  client: any;

  constructor(opts: { db?: Db } = {}) {
    opts = opts || {};
    this.db = opts.db;
  }

  static createIndexes(db) {
    logger.info('Creating DB indexes');
    if (!db.collection) {
      console.log('[storage.ts.55] no db.collection'); // TODO
      logger.error('DB not ready');
      return;
    }
    db.collection(collections.USER).createIndex({
      id: 1
    });
    db.collection(collections.USER_CONVERSION).createIndex({
      id: 1
    });
    db.collection(collections.COIN_CONFIG).createIndex({
      id: 1
    });
    db.collection(collections.KEYS).createIndex({
      id: 1
    });
    db.collection(collections.KEYS_CONVERSION).createIndex({
      id: 1
    });
    db.collection(collections.WALLETS).createIndex({
      id: 1
    });
    db.collection(collections.DONATION).createIndex({
      txidDonation: 1
    });
    db.collection(collections.TOKEN_INFO).createIndex({
      id: 1
    });
    db.collection(collections.ORDER_INFO).createIndex({
      id: 1
    });
    db.collection(collections.CONVERSION_ORDER_INFO).createIndex({
      id: 1
    });
    db.collection(collections.MERCHANT_ORDER).createIndex({
      id: 1
    });
    db.collection(collections.USER_WATCH_ADDRESS).createIndex({
      id: 1
    });
    db.collection(collections.ORDER_INFO_NOTI).createIndex({
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
    db.collection(collections.ADVERTISEMENTS).createIndex(
      {
        advertisementId: 1,
        title: 1
      },
      { unique: true }
    );
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
      logger.info('Read operations set to secondaryPreferred');
    }

    if (!config.dbname) {
      logger.error('No dbname at config.');
      return cb(new Error('No dbname at config.'));
    }

    mongodb.MongoClient.connect(config.uri, { useUnifiedTopology: true }, (err, client) => {
      if (err) {
        logger.error('Unable to connect to the mongoDB. Check the credentials.');
        return cb(err);
      }
      this.db = client.db(config.dbname);
      this.client = client;
      this.queue = mongoDbQueue(this.db, 'donation_queue');
      this.orderQueue = mongoDbQueue(this.db, 'order_queue');
      this.conversionOrderQueue = mongoDbQueue(this.db, 'conversion_order_queue');
      this.merchantOrderQueue = mongoDbQueue(this.db, 'merchant_order_queue');
      logger.info(`Connection established to db: ${config.uri}`);

      Storage.createIndexes(this.db);
      return cb();
    });
  }

  disconnect(cb) {
    if (this.client) {
      this.client.close(err => {
        if (err) return cb(err);
        this.db = null;
        this.client = null;
        return cb();
      });
    } else {
      return cb();
    }
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
    this.db.collection(collections.WALLETS).replaceOne(
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

  storeDonation(donationStorage, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      logger.warn('Trying to store a notification with close DB', donationStorage);
      return;
    }

    this.db.collection(collections.DONATION).insertOne(
      donationStorage,
      {
        w: 1
      },
      cb
    );
  }

  storeTokenInfo(tokenInfo, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      logger.warn('Trying to store a notification with close DB', tokenInfo);
      return;
    }

    this.db.collection(collections.TOKEN_INFO).insertOne(
      tokenInfo,
      {
        w: 1
      },
      cb
    );
  }

  fetchTokenInfoById(tokenId, cb) {
    if (!this.db) return cb();

    this.db.collection(collections.TOKEN_INFO).findOne(
      {
        id: tokenId
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, result);
      }
    );
  }

  fetchTokenInfo(cb) {
    if (!this.db) return cb();

    this.db
      .collection(collections.TOKEN_INFO)
      .find({})
      .toArray((err, result: TokenInfo[]) => {
        if (err) return cb(err);
        return cb(null, result);
      });
  }

  fetchDonationByTxid(txidDonation, cb) {
    if (!this.db) return cb();

    this.db.collection(collections.DONATION).findOne(
      {
        txidDonation
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, result);
      }
    );
  }

  fetchDonationInToday(cb) {
    const start = moment()
      .utc()
      .startOf('day')
      .valueOf();
    const end = moment()
      .utc()
      .endOf('day')
      .valueOf();
    this.db
      .collection(collections.DONATION)
      .find({ createdOn: { $gte: start, $lt: end } })
      .toArray((err, result: DonationStorage[]) => {
        const donationInToday = _.filter(result, item => item.txidDonation);
        return cb(null, donationInToday);
      });
  }

  updateDonation(donationInfo, cb) {
    this.db.collection(collections.DONATION).updateOne(
      {
        txidDonation: donationInfo.txidDonation
      },
      {
        $set: {
          txidGiveLotus: donationInfo.txidGiveLotus,
          isGiven: donationInfo.isGiven,
          error: donationInfo.error
        }
      },
      {
        upsert: false
      },
      cb
    );
  }

  storeUser(user, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      logger.warn('Trying to store a notification with close DB', user);
      return;
    }

    this.db.collection(collections.USER).update(
      {
        email: user.email
      },
      {
        $setOnInsert: user
      },
      { upsert: true },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return cb(null, result);
      }
    );
  }
  storeUserConversion(user, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      logger.warn('Trying to store a notification with close DB', user);
      return;
    }

    this.db.collection(collections.USER_CONVERSION).update(
      {
        email: user.email
      },
      {
        $setOnInsert: user
      },
      { upsert: true },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return cb(null, result);
      }
    );
  }

  fetchUserByEmail(email, cb) {
    if (!this.db) return cb();

    this.db.collection(collections.USER).findOne(
      {
        email
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb('Can not find user in db');

        return cb(null, result);
      }
    );
  }

  fetchUserConversionByEmail(email, cb) {
    if (!this.db) return cb();

    this.db.collection(collections.USER_CONVERSION).findOne(
      {
        email
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb('Can not find user conversion in db');

        return cb(null, result);
      }
    );
  }

  storeKeys(keys, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      logger.warn('Trying to store a notification with close DB', keys);
      return;
    }

    this.db.collection(collections.KEYS).insertOne(
      keys,
      {
        w: 1
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, result);
      }
    );
  }

  storeKeysConversion(keys, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      logger.warn('Trying to store a notification with close DB', keys);
      return;
    }

    this.db.collection(collections.KEYS_CONVERSION).insertOne(
      keys,
      {
        w: 1
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, result);
      }
    );
  }

  fetchKeys(cb) {
    if (!this.db) return cb();

    this.db.collection(collections.KEYS).findOne({}, (err, result) => {
      if (err) return cb(err);
      if (!result) return cb(null, null);

      return cb(null, result);
    });
  }

  fetchKeysConversion(cb) {
    if (!this.db) return cb();

    this.db.collection(collections.KEYS_CONVERSION).findOne({}, (err, result) => {
      if (err) return cb(err);
      if (!result) return cb(null, null);

      return cb(null, result);
    });
  }

  updateKeys(keys, cb) {
    this.db.collection(collections.KEYS).findOneAndUpdate(
      {},
      {
        $set: {
          keyFund: keys.keyFund,
          keyReceive: keys.keyReceive,
          hashPassword: keys.hashPassword,
          hashRecoveryKey: keys.hashRecoveryKey
        }
      },
      {
        upsert: false
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not update keys'));
        return cb(null, result);
      }
    );
  }

  updateKeysConversion(keys, cb) {
    this.db.collection(collections.KEYS_CONVERSION).findOneAndUpdate(
      {},
      {
        $set: {
          keyFund: keys.keyFund,
          hashPassword: keys.hashPassword,
          hashRecoveryKey: keys.hashRecoveryKey,
          lastModified: new Date()
        }
      },
      {
        upsert: false
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not update key conversion'));
        return cb(null, result);
      }
    );
  }

  updateOrder(orderInfo: Order, cb) {
    this.db.collection(collections.ORDER_INFO).updateOne(
      {
        id: orderInfo.id
      },
      {
        $set: {
          adddressUserDeposit: orderInfo.adddressUserDeposit,
          updatedRate: orderInfo.updatedRate,
          status: orderInfo.status,
          isSentToFund: orderInfo.isSentToFund,
          isSentToUser: orderInfo.isSentToUser,
          listTxIdUserDeposit: orderInfo.listTxIdUserDeposit,
          listTxIdUserReceive: orderInfo.listTxIdUserReceive,
          error: orderInfo.error,
          pendingReason: orderInfo.pendingReason,
          lastModified: new Date(),
          isResolve: orderInfo.isResolve,
          note: orderInfo.note,
          isInQueue: orderInfo.isInQueue,
          actualSent: orderInfo.actualSent,
          actualReceived: orderInfo.actualReceived
        }
      },
      {
        upsert: false
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not update order'));

        return cb(null, result);
      }
    );
  }

  updateOrderById(orderId: string, orderInfo: Order, cb) {
    this.db.collection(collections.ORDER_INFO).updateOne(
      {
        id: orderId
      },
      {
        $set: {
          adddressUserDeposit: orderInfo.adddressUserDeposit,
          updatedRate: orderInfo.updatedRate,
          status: orderInfo.status,
          isSentToFund: orderInfo.isSentToFund,
          isSentToUser: orderInfo.isSentToUser,
          listTxIdUserDeposit: orderInfo.listTxIdUserDeposit,
          listTxIdUserReceive: orderInfo.listTxIdUserReceive,
          error: orderInfo.error,
          pendingReason: orderInfo.pendingReason,
          lastModified: new Date(),
          isResolve: orderInfo.isResolve,
          note: orderInfo.note,
          actualSent: orderInfo.actualSent,
          actualReceived: orderInfo.actualReceived
        }
      },
      {
        upsert: false
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not update order'));

        return cb(null, result);
      }
    );
  }

  updateOrderStatus(id: string, status: string, cb) {
    this.db.collection(collections.ORDER_INFO).updateOne(
      {
        id
      },
      {
        $set: {
          status
        }
      },
      {
        upsert: false
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not update order'));

        return cb(null, result);
      }
    );
  }

  updateConversionOrder(orderInfo: ConversionOrder, cb) {
    this.db.collection(collections.CONVERSION_ORDER_INFO).updateOne(
      {
        txIdFromUser: orderInfo.txIdFromUser
      },
      {
        $set: {
          txIdSentToUser: orderInfo.txIdSentToUser,
          lastModified: new Date(),
          error: orderInfo.error,
          pendingReason: orderInfo.pendingReason,
          status: orderInfo.status
        }
      },
      {
        upsert: false
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not update order'));

        return cb(null, result);
      }
    );
  }

  updateMerchantOrder(merchantOrder: MerchantOrder, cb) {
    this.db.collection(collections.MERCHANT_ORDER).updateOne(
      {
        txIdFromUser: merchantOrder.txIdFromUser
      },
      {
        $set: {
          status: merchantOrder.status,
          txIdMerchantPayment: merchantOrder.txIdMerchantPayment,
          lastModified: new Date(),
          error: merchantOrder.error
        }
      },
      {
        upsert: false
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not update merchant order'));
        return cb(null, result);
      }
    );
  }

  updateListCoinConfig(listCoinConfig: CoinConfig[], cb) {
    if (!this.db) {
      logger.warn('Trying to update list coin config with close DB', listCoinConfig);
      return;
    }
    var bulk = this.db.collection(collections.COIN_CONFIG).initializeUnorderedBulkOp();
    for (var i = 0; i < listCoinConfig.length; i++) {
      const coinConfig = listCoinConfig[i];
      var ObjectId = require('mongodb').ObjectId;
      bulk.find({ _id: ObjectId(coinConfig._id) }).update({
        $set: {
          isEnableSwap: coinConfig.isEnableSwap,
          isEnableReceive: coinConfig.isEnableReceive,
          min: coinConfig.min,
          max: coinConfig.max,
          serviceFee: coinConfig.serviceFee,
          settleFee: coinConfig.settleFee,
          networkFee: coinConfig.networkFee,
          isSwap: coinConfig.isSwap,
          isReceive: coinConfig.isReceive,
          dailyLimit: coinConfig.dailyLimit || 0
        }
      });
    }
    bulk
      .execute()
      .then(result => {
        return cb(null, result);
      })
      .catch(e => {
        return cb(e);
      });
  }

  storeOrderInfo(orderInfo, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      logger.warn('Trying to store a notification with close DB', orderInfo);
      return;
    }

    this.db.collection(collections.ORDER_INFO).insertOne(
      orderInfo,
      {
        w: 1
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, result);
      }
    );
  }

  fetchOrderinfoById(orderId: string, cb) {
    this.db.collection(collections.ORDER_INFO).findOne(
      {
        id: orderId
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Your order could not be found, please re-enter!'));

        return cb(null, result);
      }
    );
  }

  fetchConversionOrderInfoByTxIdFromUser(txIdFromUser: string, cb) {
    this.db.collection(collections.CONVERSION_ORDER_INFO).findOne(
      {
        txIdFromUser
      },
      (err, result) => {
        if (err) return cb(err);
        return cb(null, result);
      }
    );
  }

  fetchMerchantOrderByTxIdFromUser(txIdFromUser: string, cb) {
    this.db.collection(collections.MERCHANT_ORDER).findOne(
      {
        txIdFromUser
      },
      (err, result) => {
        if (err) return cb(err);
        return cb(null, result);
      }
    );
  }

  storeConversionOrderInfo(conversionOrderInfo, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      logger.warn('Trying to store a notification with close DB', conversionOrderInfo);
      return;
    }

    this.db.collection(collections.CONVERSION_ORDER_INFO).insertOne(
      conversionOrderInfo,
      {
        w: 1
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, result);
      }
    );
  }

  storeMerchantOrder(merchantOrder, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      logger.warn('Trying to store merchant order with close DB', merchantOrder);
      return;
    }

    this.db.collection(collections.MERCHANT_ORDER).insertOne(
      merchantOrder,
      {
        w: 1
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, result);
      }
    );
  }

  storeUserWatchAddress(user, cb) {
    // This should only happens in certain tests.
    if (!this.db) {
      logger.warn('Trying to store a notification with close DB', user);
      return;
    }

    this.db.collection(collections.USER_WATCH_ADDRESS).insertOne(
      user,
      {
        w: 1
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, result);
      }
    );
  }

  updateUserWatchAddress(user, cb) {
    this.db.collection(collections.USER_WATCH_ADDRESS).updateOne(
      {
        msgId: user.msgId
      },
      {
        $set: {
          address: user.address
        }
      },
      {
        upsert: false
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not update order'));
        return cb(null, result);
      }
    );
  }

  removeUserWatchAddress(userInfo, cb) {
    if (!this.db) {
      logger.warn('Trying to store a notification with close DB', userInfo);
      return;
    }

    this.db.collection(collections.USER_WATCH_ADDRESS).deleteOne(
      userInfo,
      {
        w: 1
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return cb(null, result);
      }
    );
  }

  fetchAllAddressByMsgId(msgId: string, cb) {
    this.db
      .collection(collections.USER_WATCH_ADDRESS)
      .find({
        msgId
      })
      .toArray((err, listUserInfo) => {
        if (err) return cb(err);
        if (!listUserInfo || listUserInfo.length === 0) return cb(null, null);
        const listAddress = _.map(listUserInfo, user => user.address);
        return cb(null, listAddress);
      });
  }

  fetchAllMsgIdByAddress(address: string, cb) {
    this.db
      .collection(collections.USER_WATCH_ADDRESS)
      .find({
        address
      })
      .toArray((err, listUserInfo) => {
        if (err) return cb(err);
        if (!listUserInfo || listUserInfo.length === 0) return cb(null, null);
        const listMsgId = _.map(listUserInfo, user => user.msgId);
        return cb(null, listMsgId);
      });
  }

  storeOrderInfoNoti(orderInfoNoti: OrderInfoNoti, cb) {
    if (!this.db) {
      logger.warn('Trying to store a orderInfoNoti with close DB', orderInfoNoti);
      return;
    }

    this.db.collection(collections.ORDER_INFO_NOTI).insertOne(
      orderInfoNoti,
      {
        w: 1
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, result);
      }
    );
  }

  fetchOrderInfoNoti(opts, cb) {
    if (!this.db) {
      logger.warn('Trying to store a orderInfoNoti with close DB');
      return;
    }
    let queryObject = {};
    let queryReceivedTxId = null;
    let queryPendingReason = null;
    let queryError = null;
    if (opts) {
      if (opts.receivedTxId) {
        queryReceivedTxId = {
          receivedTxId: opts.receivedTxId
        };
      } else if (opts.pendingReason) {
        queryPendingReason = {
          pendingReason: opts.pendingReason
        };
      } else if (opts.error) {
        queryError = {
          error: opts.error
        };
      }
    }
    queryObject = Object.assign(
      {},
      { orderId: opts.orderId },
      queryReceivedTxId && { ...queryReceivedTxId },
      queryPendingReason && { ...queryPendingReason },
      queryError && { ...queryError }
    );
    this.db.collection(collections.ORDER_INFO_NOTI).findOne(queryObject, (err, result) => {
      if (err) return cb(err);
      if (!result) return cb(null);
      return cb(null, result);
    });
  }

  fetchAllOrderInfo(opts, cb) {
    const coinConfigFilter: ICoinConfigFilter = opts.coinConfigFilter || null;
    let queryObject = {};
    let queryDate = null;
    let queryFromCoin = null;
    let queryFromNetwork = null;
    let queryToNetwork = null;
    let queryToCoin = null;
    let queryStatus = null;
    let queryIsInQueue = null;
    let queryOrderId = null;

    if (coinConfigFilter) {
      if (coinConfigFilter.fromDate && coinConfigFilter.toDate) {
        queryDate = {
          lastModified: { $gte: new Date(coinConfigFilter.fromDate), $lte: new Date(coinConfigFilter.toDate) }
        };
      }
      if (coinConfigFilter.fromCoinCode) {
        queryFromCoin = { fromCoinCode: coinConfigFilter.fromCoinCode };
      }
      if (coinConfigFilter.fromNetwork) {
        queryFromNetwork = { fromNetwork: coinConfigFilter.fromNetwork };
      }
      if (coinConfigFilter.toCoinCode) {
        queryToCoin = { toCoinCode: coinConfigFilter.toCoinCode };
      }
      if (coinConfigFilter.toNetwork) {
        queryToNetwork = { toNetwork: coinConfigFilter.toNetwork };
      }
      if (coinConfigFilter.status) {
        queryStatus = { status: coinConfigFilter.status };
      }
      if (!isUndefined(coinConfigFilter.isInQueue) && !isNull(coinConfigFilter.isInQueue)) {
        queryIsInQueue = { status: coinConfigFilter.status };
      }
      if (coinConfigFilter.orderId && coinConfigFilter.orderId.length > 0) {
        queryOrderId = { id: coinConfigFilter.orderId };
      }
      queryObject = Object.assign(
        {},
        queryDate && { ...queryDate },
        queryFromCoin && { ...queryFromCoin },
        queryToCoin && { ...queryToCoin },
        queryStatus && { ...queryStatus },
        queryFromNetwork && { ...queryFromNetwork },
        queryToNetwork && { ...queryToNetwork },
        queryIsInQueue && { ...queryIsInQueue },
        queryOrderId && { ...queryOrderId }
      );
    }

    this.db
      .collection(collections.ORDER_INFO)
      .find(queryObject)
      .sort(opts.query)
      .limit(opts.limit)
      .skip(opts.skip)
      .toArray((err, listOrderInfo) => {
        if (err) return cb(err);
        if (listOrderInfo.length === 0) return cb(new Error('Not found any order'));
        else return cb(null, listOrderInfo);
      });
  }

  fetchAllOrderInfoNotInQueue(cb) {
    this.db
      .collection(collections.ORDER_INFO)
      .find({
        $or: [{ status: 'waiting' }, { status: 'processing' }]
      })
      .sort({ lastModified: 1 })
      .toArray((err, listOrderInfo) => {
        if (err) return cb(err);
        else return cb(null, listOrderInfo);
      });
  }

  fetchAllOrderInfoInQueue(cb) {
    this.db
      .collection(collections.ORDER_QUEUE)
      .find()
      .toArray((err, listOrderInfo) => {
        if (err) return cb(err);
        else return cb(null, listOrderInfo);
      });
  }

  countAllOrderInfo(opts) {
    const coinConfigFilter: ICoinConfigFilter = opts.coinConfigFilter || null;
    let queryObject = {};
    let queryDate = null;
    let queryFromCoin = null;
    let queryFromNetwork = null;
    let queryToNetwork = null;
    let queryToCoin = null;
    let queryStatus = null;
    let queryIsInQueue = null;
    let queryOrderId = null;

    if (coinConfigFilter) {
      if (coinConfigFilter.fromDate && coinConfigFilter.toDate) {
        queryDate = {
          lastModified: { $gte: new Date(coinConfigFilter.fromDate), $lte: new Date(coinConfigFilter.toDate) }
        };
      }
      if (coinConfigFilter.fromCoinCode) {
        queryFromCoin = { fromCoinCode: coinConfigFilter.fromCoinCode };
      }
      if (coinConfigFilter.fromNetwork) {
        queryFromNetwork = { fromNetwork: coinConfigFilter.fromNetwork };
      }
      if (coinConfigFilter.toCoinCode) {
        queryToCoin = { toCoinCode: coinConfigFilter.toCoinCode };
      }
      if (coinConfigFilter.toNetwork) {
        queryToNetwork = { toNetwork: coinConfigFilter.toNetwork };
      }
      if (coinConfigFilter.status) {
        queryStatus = { status: coinConfigFilter.status };
      }
      if (!isUndefined(coinConfigFilter.isInQueue) && !isNull(coinConfigFilter.isInQueue)) {
        queryIsInQueue = { status: coinConfigFilter.status };
      }
      if (coinConfigFilter.orderId && coinConfigFilter.orderId.length > 0) {
        queryOrderId = { id: coinConfigFilter.orderId };
      }
      queryObject = Object.assign(
        {},
        queryDate && { ...queryDate },
        queryFromCoin && { ...queryFromCoin },
        queryToCoin && { ...queryToCoin },
        queryStatus && { ...queryStatus },
        queryFromNetwork && { ...queryFromNetwork },
        queryToNetwork && { ...queryToNetwork },
        queryIsInQueue && { ...queryIsInQueue },
        queryOrderId && { ...queryOrderId }
      );
    }

    return this.db
      .collection(collections.ORDER_INFO)
      .find(queryObject)
      .sort(opts.query)
      .count();
  }

  fetchAllConversionOrderInfo(opts, cb) {
    this.db
      .collection(collections.CONVERSION_ORDER_INFO)
      .find({})
      .sort({ _id: -1 })
      .toArray((err, listConversionOrderInfo) => {
        if (err) return cb(err);
        if (listConversionOrderInfo.length === 0) return cb(new Error('Not found any conversion order'));
        else return cb(null, listConversionOrderInfo);
      });
  }

  countAllConversionOrderInfo(opts) {
    return this.db
      .collection(collections.CONVERSION_ORDER_INFO)
      .find({})
      .sort({ _id: -1 })
      .count();
  }

  fetchAllCoinConfig(cb) {
    this.db
      .collection(collections.COIN_CONFIG)
      .find()
      .toArray((err, listCoinConfig) => {
        if (err) return cb(err);
        else return cb(null, listCoinConfig);
      });
  }

  storeListCoinConfig(listCoinConfig, cb) {
    if (!this.db) {
      logger.warn('Trying to store a notification with close DB', listCoinConfig);
      return;
    }

    this.db.collection(collections.COIN_CONFIG).insertMany(
      listCoinConfig,
      {
        w: 1
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, result);
      }
    );
  }

  updateCoinConfig(coinConfig, cb) {
    this.db.collection(collections.COIN_CONFIG).updateOne(
      {
        code: coinConfig.code,
        network: coinConfig.network
      },
      {
        $set: {
          isSupport: coinConfig.isSupport
        }
      },
      {
        upsert: false
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not update coin config'));

        return cb(null, result);
      }
    );
  }

  updateDailyLimitCoinConfig(coinConfig, cb) {
    this.db.collection(collections.COIN_CONFIG).updateOne(
      {
        code: coinConfig.code,
        network: coinConfig.network
      },
      {
        $set: {
          dailyLimit: coinConfig.dailyLimit,
          dailyLimitUsage: coinConfig.dailyLimitUsage
        }
      },
      {
        upsert: false
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not update daily limit for coin config'));

        return cb(null, result);
      }
    );
  }

  resetAllDailyLimitUsageInCoinConfig(cb) {
    this.db.collection(collections.COIN_CONFIG).updateMany(
      {},
      {
        $set: {
          dailyLimitUsage: 0
        }
      },
      {
        upsert: false
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb(new Error('Can not update daily limit for coin config'));

        return cb(null, result);
      }
    );
  }

  storeWalletAndUpdateCopayersLookup(wallet, cb) {
    const copayerLookups = _.map(wallet.copayers, copayer => {
      try {
        $.checkState(
          copayer.requestPubKeys,
          'Failed state: copayer.requestPubkeys undefined at <storeWalletAndUpdateCopayersLookup()>'
        );
      } catch (e) {
        return cb(e);
      }

      return {
        copayerId: copayer.id,
        walletId: wallet.id,
        requestPubKeys: copayer.requestPubKeys
      };
    });

    this.db.collection(collections.COPAYERS_LOOKUP).deleteMany(
      {
        walletId: wallet.id
      },
      {
        w: 1
      },
      err => {
        if (err) return cb(err);
        this.db.collection(collections.COPAYERS_LOOKUP).insertMany(
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

  fetchAllAddressInUserWatchAddress(cb) {
    this.db
      .collection(collections.USER_WATCH_ADDRESS)
      .distinct('address')
      .then(listAddress => {
        return cb(null, listAddress);
      })
      .catch(e => {
        return cb(e);
      });
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

  fetchEthPendingTxs(multisigTxpsInfo) {
    return new Promise((resolve, reject) => {
      this.db
        .collection(collections.TXS)
        .find({
          txid: { $in: multisigTxpsInfo.map(txpInfo => txpInfo.transactionHash) }
        })
        .sort({
          createdOn: -1
        })
        .toArray(async (err, result) => {
          if (err) return reject(err);
          if (!result) return reject();
          const multisigTxpsInfoByTransactionHash: any = _.groupBy(multisigTxpsInfo, 'transactionHash');
          const actionsById = {};
          const txs = _.compact(
            _.map(result, tx => {
              if (!tx.multisigContractAddress) {
                return undefined;
              }
              tx.status = 'pending';
              tx.multisigTxId = multisigTxpsInfoByTransactionHash[tx.txid][0].transactionId;
              tx.actions.forEach(action => {
                if (_.some(multisigTxpsInfoByTransactionHash[tx.txid], { event: 'ExecutionFailure' })) {
                  action.type = 'failed';
                }
              });
              if (tx.amount === 0) {
                actionsById[tx.multisigTxId] = [...tx.actions, ...(actionsById[tx.multisigTxId] || [])];
                return undefined;
              }
              return TxProposal.fromObj(tx);
            })
          );

          txs.forEach((tx: TxProposal) => {
            if (actionsById[tx.multisigTxId]) {
              tx.actions = [...tx.actions, ...(actionsById[tx.multisigTxId] || [])];
            }
          });

          return resolve(txs);
        });
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
      logger.warn('Trying to store a notification with close DB', notification);
      return;
    }

    this.db.collection(collections.NOTIFICATIONS).insertOne(
      notification,
      {
        w: 1
      },
      cb
    );
  }

  // TODO: remove walletId from signature
  storeTx(walletId, txp, cb) {
    this.db.collection(collections.TXS).replaceOne(
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
    this.db.collection(collections.TXS).deleteOne(
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
          this.db.collection(collections.WALLETS).deleteOne(
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
              this.db.collection(col).deleteMany(
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

      this.db.collection(collections.ADDRESSES).updateMany({ _id: doc._id }, { $set: { address: x } });
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
    this.db.collection(collections.ADDRESSES).replaceOne(
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
    this.db.collection(collections.WALLETS).updateOne(
      {
        id: walletId
      },
      { $set: { beRegistered: null } },
      {
        w: 1,
        upsert: false
      },
      () => {
        this.db.collection(collections.ADDRESSES).updateMany(
          {
            walletId
          },
          { $set: { beRegistered: null } },
          {
            w: 1,
            upsert: false
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

    this.db.collection(collections.ADDRESSES).insertMany(
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
            logger.warn('Found duplicate address: ' + _.join(_.map(clonedAddresses, 'address'), ','));
          }
        }
        this.storeWallet(wallet, err => {
          return cb(err, duplicate);
        });
      }
    );
  }

  fetchAddressWithWalletId(walletId, cb) {
    this.db.collection(collections.ADDRESSES).findOne(
      {
        walletId
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return cb(null, Address.fromObj(result));
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
    this.db.collection(collections.PREFERENCES).replaceOne(
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
    this.db.collection(collections.EMAIL_QUEUE).replaceOne(
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
    this.db.collection(collections.CACHE).replaceOne(
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
    this.db.collection(collections.CACHE).replaceOne(
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

  updateCacheTxHistoryByTxId(walletId, txId, inputAddresses, cb) {
    const now = Date.now();
    this.db.collection(collections.CACHE).findOneAndUpdate(
      {
        walletId,
        type: 'historyCacheV8',
        'tx.txid': txId
      },
      {
        $set: {
          'tx.inputAddresses': inputAddresses
        }
      },
      {
        w: 1,
        upsert: true
      },
      cb
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
        this.db.collection(collections.CACHE).insertOne(
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
          $.checkState(last.txid, 'Failed state: missing txid in tx to be cached at <storeHistoryCacheV8()>');
          $.checkState(
            last.blockheight,
            'Failed state: missing blockheight in tx to be cached at <storeHistoryCacheV8()>'
          );
          $.checkState(
            first.blockheight,
            'Failed state: missing blockheight in tx to be cached at <storeHistoryCacheV8()>'
          );
          $.checkState(
            last.blockheight >= 0,
            'Failed state: blockheight <=0 om tx to be cached at <storeHistoryCacheV8()>'
          );

          // note there is a .reverse before.
          $.checkState(
            first.blockheight <= last.blockheight,
            'Failed state: tx to be cached are in wrong order (lastest should be first)'
          );
        } catch (e) {
          return cb(e);
        }

        logger.debug(`Cache Last Item: ${last.txid} blockh: ${last.blockheight} updatedh: ${updateHeight}`);
        this.db.collection(collections.CACHE).replaceOne(
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
        this.db.collection(collections.FIAT_RATES2).insertOne(
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

  storeCurrencyRate(rates, cb) {
    const now = Date.now();
    async.each(
      rates,
      (rate: { code: string; value: string }, next) => {
        let i = {
          ts: now,
          code: rate.code,
          value: rate.value
        };
        this.db.collection(collections.FIAT_RATES2).insertOne(
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

  fetchCurrencyRates(code, ts, cb) {
    this.db
      .collection(collections.FIAT_RATES2)
      .find({
        coin: null,
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

  fetchFiatRate(coin, code, ts, cb) {
    this.db
      .collection(collections.FIAT_RATES2)
      .find({
        coin,
        code,
        ts: {
          $lte: ts
        },
        value: {
          $gt: 0
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

  fetchHistoricalRates(coin, code, ts, cb) {
    this.db
      .collection(collections.FIAT_RATES2)
      .find({
        coin,
        code,
        ts: {
          $gte: ts
        }
      })
      .sort({
        ts: -1
      })
      .toArray((err, result) => {
        if (err || _.isEmpty(result)) return cb(err);
        return cb(null, result);
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
    this.db.collection(collections.TX_NOTES).replaceOne(
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
    this.db.collection(collections.SESSIONS).replaceOne(
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

  fetchLatestPushNotificationSubs(cb) {
    const fromDate = new Date().getTime() - Defaults.PUSH_NOTIFICATION_SUBS_TIME;
    this.db
      .collection(collections.PUSH_NOTIFICATION_SUBS)
      .find({
        _id: {
          $gte: new ObjectID(objectIdDate(fromDate))
        }
      })
      .sort({ _id: -1 })
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
    this.db.collection(collections.PUSH_NOTIFICATION_SUBS).replaceOne(
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
    this.db.collection(collections.PUSH_NOTIFICATION_SUBS).deleteMany(
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
      logger.warn('Trying to fetch notifications with closed DB');
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
    this.db.collection(collections.TX_CONFIRMATION_SUBS).replaceOne(
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
    this.db.collection(collections.TX_CONFIRMATION_SUBS).deleteMany(
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
    this.db.collection(collections.CACHE).findOneAndUpdate(
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
    this.db.collection(collections.CACHE).deleteMany(
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
    this.db.collection(collections.LOCKS).insertOne(
      {
        _id: key,
        expireOn: expireTs
      },
      {},
      cb
    );
  }

  releaseLock(key, cb) {
    this.db.collection(collections.LOCKS).deleteMany(
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
          logger.info('Releasing expired lock : ' + key);
          return this.releaseLock(key, cb);
        }
        return cb();
      }
    );
  }

  fetchTestingAdverts(cb) {
    this.db
      .collection(collections.ADVERTISEMENTS)
      .find({
        isTesting: true
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return cb(null, result.map(Advertisement.fromObj));
      });
  }

  fetchActiveAdverts(cb) {
    this.db
      .collection(collections.ADVERTISEMENTS)
      .find({
        isAdActive: true
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return cb(null, result.map(Advertisement.fromObj));
      });
  }

  fetchAdvertsByCountry(country, cb) {
    this.db
      .collection(collections.ADVERTISEMENTS)
      .find({
        country
      })
      .toArray((err, result) => {
        if (err) return cb(err);
        if (!result) return cb();
        return cb(null, result.map(Advertisement.fromObj));
      });
  }

  fetchAllAdverts(cb) {
    this.db.collection(collections.ADVERTISEMENTS).find({});
  }

  removeAdvert(adId, cb) {
    this.db.collection(collections.ADVERTISEMENTS).deleteOne(
      {
        advertisementId: adId
      },
      {
        w: 1
      },
      cb
    );
  }

  storeAdvert(advert, cb) {
    this.db.collection(collections.ADVERTISEMENTS).updateOne(
      {
        advertisementId: advert.advertisementId
      },
      { $set: advert },
      {
        upsert: true
      },
      cb
    );
  }

  fetchAdvert(adId, cb) {
    this.db.collection(collections.ADVERTISEMENTS).findOne(
      {
        advertisementId: adId
      },
      (err, result) => {
        if (err) return cb(err);
        if (!result) return cb();

        return cb(null, Advertisement.fromObj(result));
      }
    );
  }

  activateAdvert(adId, cb) {
    this.db.collection(collections.ADVERTISEMENTS).updateOne(
      {
        advertisementId: adId
      },
      { $set: { isAdActive: true, isTesting: false } },
      {
        upsert: true
      },
      cb
    );
  }

  deactivateAdvert(adId, cb) {
    this.db.collection(collections.ADVERTISEMENTS).updateOne(
      {
        advertisementId: adId
      },
      {
        $set: { isAdActive: false, isTesting: true }
      },
      {
        upsert: true
      },
      cb
    );
  }
}
