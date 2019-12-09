import * as async from 'async';
import * as _ from 'lodash';
import moment from 'moment';
import * as mongodb from 'mongodb';

const config = require('../config');
const storage = require('./storage');
let log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

const INITIAL_DATE = '2015-01-01';

export interface IStats {
  network: string;
  coin: string;
  from: Date;
  to: Date;
  fromTs: number;
  toTs: number;
}
export class Stats {
  network: string;
  coin: string;
  from: moment.MomentFormatSpecification;
  to: moment.MomentFormatSpecification;
  db: mongodb.Db;
  update: boolean;

  constructor(opts) {
    opts = opts || {};

    this.network = opts.network || 'livenet';
    this.coin = opts.coin || 'btc';
    this.from = moment(opts.from || INITIAL_DATE).format('YYYY-MM-DD');
    this.to = moment(opts.to).format('YYYY-MM-DD');
    this.update = opts.update || false;
  }

  run(cb) {
    let uri = config.storageOpts.mongoDb.uri;

    if (uri.indexOf('?') > 0) {
      uri = uri + '&';
    } else {
      uri = uri + '?';
    }
    uri = uri + 'readPreference=secondaryPreferred';
    mongodb.MongoClient.connect(
      uri,
      (err, db) => {
        if (err) {
          log.error('Unable to connect to the mongoDB', err);
          return cb(err, null);
        }
        this.db = db;
        this._getStats((err, stats) => {
          if (err) return cb(err);
          return cb(null, stats);
        });
      }
    );
  }

  _getStats(cb) {
    let result = {};
    async.series(
      [
        (next) => {
          this._getNewWallets(next);
        },
        (next) => {
          this._getTxProposals(next);
        },
        (next) => {
          this._getFiatRates(next);
        }
      ],
      (err, results) => {
        if (err) return cb(err);
        result = { newWallets: results[0], txProposals: results[1], fiatRates: results[2] };
        return cb(null, result);
      }
    );
  }

  _getNewWallets(cb) {

    const updateStats = (cb) => {
      this.db
        .collection(storage.Storage.collections.WALLETS)
        .aggregate(
          [
            {
              $project: {
                date: { $add: [new Date(0), { $multiply: ['$createdOn', 1000] }] },
                network: '$network',
                coin: '$coin',
              }
            },
            {
              $group: {
                _id: {
                  day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                  network: '$network',
                  coin: '$coin'
                },
                count: { $sum: 1 },
              }
            }
          ]
        ).toArray(async (err, res) => {
          if (err) {
            log.error('Update wallet stats throws error:', err);
            return cb(err);
          }
          if (res.length !== 0) {
            try {
              if (!this.db.collection('stats_wallets').find()) await this.db.createCollection('stats_wallets');
              await this.db.collection('stats_wallets').remove({}).then(async () => {
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

    const queryStats = (cb) => {
      this.db
        .collection('stats_wallets')
        .find({
          '_id.network': this.network,
          '_id.coin': this.coin,
          '_id.day': {
            $gte: this.from,
            $lte: this.to
          }
        })
        .sort({
          '_id.day': 1
        })
        .toArray((err, results) => {
          if (err) return cb(err);
          const stats = {
            byDay: _.map(results, (record) => {
              const day = moment(record._id.day).format('YYYYMMDD');
              return {
                day,
                coin: record._id.coin,
                value: record._id.value,
                count: record.count ? record.count : record.value.count
              };
            })
          };
          return cb(null, stats);
        });
    };

    return this.update ? updateStats(cb) : queryStats(cb);
  }

  _getFiatRates(cb) {
    const updateStats = (cb) => {
      this.db
        .collection(storage.Storage.collections.FIAT_RATES2)
        .aggregate(
          [
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
          ]
        ).toArray(async (err, res) => {
          if (err) {
            log.error('Update fiat rates stats throws error:', err);
            return cb(err);
          }
          if (res.length !== 0) {
            try {
              if (!this.db.collection('stats_fiat_rates').find()) await this.db.createCollection('stats_fiat_rates');
              await this.db.collection('stats_fiat_rates').remove({}).then(async () => {
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

    const queryStats = (cb) => {
      this.db
        .collection('stats_fiat_rates')
        .find({
          '_id.coin': this.coin,
          '_id.day': {
            $gte: this.from,
            $lte: this.to
          }
        })
        .sort({
          '_id.day': 1
        })
        .toArray((err, results) => {
          if (err) return cb(err);
          const stats = {
            byDay: _.map(results, (record) => {
              const day = moment(record._id.day).format('YYYYMMDD');
              return {
                day,
                coin: record._id.coin,
                value: record.value,
              };
            })
          };
          return cb(null, stats);
        });
    };
    return this.update ? updateStats(cb) : queryStats(cb);
  }

  _getTxProposals(cb) {

    const updateStats = (cb) => {
      this.db
        .collection(storage.Storage.collections.TXS)
        .aggregate(
          [
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
                count: { $sum: 1 },
              }
            }
          ]
        ).toArray(async (err, res) => {
          if (err) {
            log.error('Update txps stats throws error:', err);
            return cb(err);
          }
          if (res.length !== 0) {
            try {
              if (!this.db.collection('stats_txps').find()) await this.db.createCollection('stats_txps');
              await this.db.collection('stats_txps').remove({}).then(async () => {
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

    const queryStats = (cb) => {
      this.db
        .collection('stats_txps')
        .find({
          '_id.network': this.network,
          '_id.coin': this.coin,
          '_id.day': {
            $gte: this.from,
            $lte: this.to
          }
        })
        .sort({
          '_id.day': 1
        })
        .toArray((err, results) => {
          if (err) return cb(err);
          const stats = {
            nbByDay: [],
            amountByDay: []
          };
          _.each(results, (record) => {
            const day = moment(record._id.day).format('YYYYMMDD');
            stats.nbByDay.push({
              day,
              coin: record._id.coin,
              count: record.count ? record.count : record.value.count
            });
            stats.amountByDay.push({
              day,
              amount: record.amount ? record.amount : record.value.amount
            });
          });
          return cb(null, stats);
        });
    };

    return this.update ? updateStats(cb) : queryStats(cb);
  }
}