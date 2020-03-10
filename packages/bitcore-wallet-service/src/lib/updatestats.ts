

import * as async from 'async';
import * as _ from 'lodash';
import moment from 'moment';
import * as mongodb from 'mongodb';


import { Lock } from './lock';
import { Storage } from './storage';
const storage = require('./storage');


let log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

let lock;
let initialized = false;

const INITIAL_DATE = '2015-01-01';

export class UpdateStats {
  from: moment.MomentFormatSpecification;
  to: moment.MomentFormatSpecification;
  db: mongodb.Db;
  storage: Storage;
  lock: Lock;
  initialized: boolean;

  constructor() {
    this.storage = storage;
    this.lock = lock;
    this.initialized = initialized;

    this.from = moment(INITIAL_DATE).format('YYYY-MM-DD');
    this.to = moment().format('YYYY-MM-DD');
  }

  init(config, cb) {
    const initStorage = cb => {
      if (config.storage) {
        this.storage = config.storage;
        return cb();
      } else {
        const newStorage = new Storage();
        newStorage.connect(config.storageOpts, err => {
          if (err) {
            return cb(err);
          }
          this.storage = newStorage;
          return cb();
        });
      }
    };

    async.series(
      [
        next => {
          initStorage(next);
        }
      ],
      err => {
        this.lock = config.lock || new Lock(storage, config.lockOpts);

        if (err) {
          log.error('Could not initialize', err);
          throw err;
        }
        this.initialized = true;
        return cb();
      }
    );


    let uri = config.storageOpts.mongoDb.uri;

    if (uri.indexOf('?') > 0) {
      uri = uri + '&';
    } else {
      uri = uri + '?';
    }
    uri = uri + 'readPreference=secondaryPreferred';
    mongodb.MongoClient.connect(uri, (err, db) => {
      if (err) {
        log.error('Unable to connect to the mongoDB', err);
        return cb(err, null);
      }
      this.db = db;
      this.updateStats((err, stats) => {
        if (err) return cb(err);
        return cb(null, stats);
      });
    });
  }

  updateStats(cb) {
    let result = {};
    async.series(
      [
        next => {
          this._updateNewWallets(next);
        },
        next => {
          this._updateTxProposals(next);
        },
        next => {
          this._updateFiatRates(next);
        }
      ],
      (err, results) => {
        if (err) return cb(err);
        result = { newWallets: results[0], txProposals: results[1], fiatRates: results[2] };
        return cb(null, result);
      }
    );
  }

  _updateNewWallets(cb) {
    const updateStats = cb => {
      this.db
        .collection(storage.Storage.collections.WALLETS)
        .aggregate([
          {
            $project: {
              date: { $add: [new Date(0), { $multiply: ['$createdOn', 1000] }] },
              network: '$network',
              coin: '$coin'
            }
          },
          {
            $group: {
              _id: {
                day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                network: '$network',
                coin: '$coin'
              },
              count: { $sum: 1 }
            }
          }
        ])
        .toArray(async (err, res) => {
          if (err) {
            log.error('Update wallet stats throws error:', err);
            return cb(err);
          }
          if (res.length !== 0) {
            try {
              if (!this.db.collection('stats_wallets').find()) await this.db.createCollection('stats_wallets');
              await this.db
                .collection('stats_wallets')
                .remove({})
                .then(async () => {
                  const opts: any = { ordered: false };
                  await this.db.collection('stats_wallets').insert(res, opts);
                });
            } catch (err) {
              log.error('Cannot insert into stats_wallets:', err);
            }
          }
          return cb();
        });
    };

    return updateStats(cb);
  }

  _updateFiatRates(cb) {
    const updateStats = cb => {
      this.db
        .collection(storage.Storage.collections.FIAT_RATES2)
        .aggregate([
          {
            $match: {
              code: 'USD'
            }
          },
          {
            $project: {
              date: { $add: [new Date(0), '$ts'] },
              coin: '$coin',
              value: '$value'
            }
          },
          {
            $group: {
              _id: {
                day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                coin: '$coin'
              },
              value: { $first: '$value' }
            }
          }
        ])
        .toArray(async (err, res) => {
          if (err) {
            log.error('Update fiat rates stats throws error:', err);
            return cb(err);
          }
          if (res.length !== 0) {
            try {
              if (!this.db.collection('stats_fiat_rates').find()) await this.db.createCollection('stats_fiat_rates');
              await this.db
                .collection('stats_fiat_rates')
                .remove({})
                .then(async () => {
                  const opts: any = { ordered: false };
                  await this.db.collection('stats_fiat_rates').insert(res, opts);
                });
            } catch (err) {
              log.error('Cannot insert into stats_fiat_rates:', err);
            }
          }
          return cb();
        });
    };

    return updateStats(cb);
  }

  _updateTxProposals(cb) {
    const updateStats = cb => {
      this.db
        .collection(storage.Storage.collections.TXS)
        .aggregate([
          {
            $project: {
              date: { $add: [new Date(0), { $multiply: ['$createdOn', 1000] }] },
              network: '$network',
              coin: '$coin',
              amount: '$amount'
            }
          },
          {
            $group: {
              _id: {
                day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                network: '$network',
                coin: '$coin'
              },
              amount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ])
        .toArray(async (err, res) => {
          if (err) {
            log.error('Update txps stats throws error:', err);
            return cb(err);
          }
          if (res.length !== 0) {
            try {
              if (!this.db.collection('stats_txps').find()) await this.db.createCollection('stats_txps');
              await this.db
                .collection('stats_txps')
                .remove({})
                .then(async () => {
                  const opts: any = { ordered: false };
                  await this.db.collection('stats_txps').insert(res, opts);
                });
            } catch (err) {
              log.error('Cannot insert into stats_txps:', err);
            }
          }
          return cb();
        });
    };

    return updateStats(cb);
  }
}