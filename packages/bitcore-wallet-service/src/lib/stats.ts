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
  from: moment.Moment;
  to: moment.Moment;
  fromTs: number;
  toTs: number;
  db: mongodb.Db;

  constructor(opts) {
    opts = opts || {};

    this.network = opts.network || 'livenet';
    this.coin = opts.coin || 'btc';
    this.from = moment(opts.from || INITIAL_DATE);
    this.to = moment(opts.to);
    this.fromTs = this.from.startOf('day').valueOf();
    this.toTs = this.to.endOf('day').valueOf();
  }

  run(cb) {
    const uri = config.storageOpts.mongoDb.uri;
    mongodb.MongoClient.connect(
      uri,
      (err, db) => {
        if (err) {
          log.error('Unable to connect to the mongoDB', err);
          return cb(err, null);
        }
        log.info('Connection established to ' + uri);
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
    async.parallel(
      [
        (next) => {
          this._getNewWallets(next);
        },
        (next) => {
          this._getTxProposals(next);
        }
      ],
      (err, results) => {
        if (err) return cb(err);

        result = { newWallets: results[0], txProposals: results[1] };
        return cb(null, result);
      }
    );
  }

  _getNewWallets(cb) {
    const getLastDate = cb => {
      this.db
        .collection('stats_wallets')
        .find({ '_id.coin': this.coin })
        .sort({
          '_id.day': -1
        })
        .limit(1)
        .toArray((err, lastRecord) => {
          if (_.isEmpty(lastRecord)) return cb(null, moment(INITIAL_DATE));
          return cb(null, moment(lastRecord[0]._id.day));
        });
    };

    const updateStats = (from, cb) => {
      const to = moment()
        .subtract(1, 'day')
        .endOf('day');
      const map = function() {
        const day = new Date(this.createdOn * 1000);
        day.setHours(0);
        day.setMinutes(0);
        day.setSeconds(0);
        const key = {
          day: +day,
          network: this.network,
          coin: this.coin
        };
        const value = {
          count: 1
        };
        // emit(key, value);
      };
      const reduce = (k, v: any[]) => {
        let count = 0;
        for (let i = 0; i < v.length; i++) {
          count += v[i].count;
        }
        return {
          count
        };
      };
      const opts = {
        query: {
          createdOn: {
            $gt: from.unix(),
            $lte: to.unix()
          }
        },
        out: {
          merge: 'stats_wallets'
        }
      };
      this.db
        .collection(storage.collections.WALLETS)
        .mapReduce(map, reduce, opts, (err) => {
          return cb(err);
        });
    };

    const queryStats = (cb) => {
      this.db
        .collection('stats_wallets')
        .find({
          '_id.network': this.network,
          '_id.coin': this.coin,
          '_id.day': {
            $gte: this.fromTs,
            $lte: this.toTs
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
                count: record.value.count
              };
            })
          };
          return cb(null, stats);
        });
    };

    async.series(
      [
        (next) => {
          getLastDate((err, lastDate) => {
            if (err) return next(err);

            lastDate = lastDate.startOf('day');
            const yesterday = moment()
              .subtract(1, 'day')
              .startOf('day');
            if (lastDate.isBefore(yesterday)) {
              // Needs update
              return updateStats(lastDate, next);
            }
            next();
          });
        },
        (next) => {
          queryStats(next);
        }
      ],
      (err, res) => {
        if (err) {
          log.error(err);
        }
        return cb(err, res[1]);
      }
    );
  }

  _getTxProposals(cb) {
    const getLastDate = (cb) => {
      this.db
        .collection('stats_txps')
        .find({ '_id.coin': this.coin })
        .sort({
          '_id.day': -1
        })
        .limit(1)
        .toArray((err, lastRecord) => {
          if (_.isEmpty(lastRecord)) return cb(null, moment(INITIAL_DATE));
          return cb(null, moment(lastRecord[0]._id.day));
        });
    };

    const updateStats = (from, cb) => {
      const to = moment()
        .subtract(1, 'day')
        .endOf('day');
      const map = function() {
        const day = new Date(this.broadcastedOn * 1000);
        day.setHours(0);
        day.setMinutes(0);
        day.setSeconds(0);
        const key = {
          day: +day,
          network: this.network,
          coin: this.coin
        };
        const value = {
          count: 1,
          amount: this.amount
        };
        // emit(key, value);
      };
      const reduce = (k, v) => {
        let count = 0,
          amount = 0;
        for (let i = 0; i < v.length; i++) {
          count += v[i].count;
          amount += v[i].amount;
        }
        return {
          count,
          amount
        };
      };
      const opts = {
        query: {
          status: 'broadcasted',
          broadcastedOn: {
            $gt: from.unix(),
            $lte: to.unix()
          }
        },
        out: {
          merge: 'stats_txps'
        }
      };
      this.db
        .collection(storage.collections.TXS)
        .mapReduce(map, reduce, opts, (err) => {
          return cb(err);
        });
    };

    const queryStats = (cb) => {
      this.db
        .collection('stats_txps')
        .find({
          '_id.network': this.network,
          '_id.coin': this.coin,
          '_id.day': {
            $gte: this.fromTs,
            $lte: this.toTs
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
              count: record.value.count
            });
            stats.amountByDay.push({
              day,
              amount: record.value.amount
            });
          });
          return cb(null, stats);
        });
    };

    async.series(
      [
        (next) => {
          getLastDate((err, lastDate) => {
            if (err) return next(err);

            lastDate = lastDate.startOf('day');
            const yesterday = moment()
              .subtract(1, 'day')
              .startOf('day');
            if (lastDate.isBefore(yesterday)) {
              // Needs update
              return updateStats(lastDate, next);
            }
            next();
          });
        },
        (next) => {
          queryStats(next);
        }
      ],
      (err, res) => {
        if (err) {
          log.error(err);
        }
        return cb(err, res[1]);
      }
    );
  }
}
