import * as async from 'async';
import * as _ from 'lodash';
import moment from 'moment';
import * as mongodb from 'mongodb';

const config = require('../config');
let log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

const INITIAL_DATE = '2015-01-01';

export class Stats {
  network: string;
  coin: string;
  from: moment.MomentFormatSpecification;
  to: moment.MomentFormatSpecification;
  db: mongodb.Db;

  constructor(opts) {
    opts = opts || {};

    this.network = opts.network || 'livenet';
    this.coin = opts.coin || 'btc';
    this.from = moment(opts.from || INITIAL_DATE).format('YYYY-MM-DD');
    this.to = moment(opts.to).format('YYYY-MM-DD');
  }

  run(cb) {
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
      this._getStats((err, stats) => {
        if (err) return cb(err);
        return cb(null, stats);
      });
    });
  }

  _getStats(cb) {
    let result = {};
    async.series(
      [
        next => {
          this._getNewWallets(next);
        },
        next => {
          this._getTxProposals(next);
        },
        next => {
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
          byDay: _.map(results, record => {
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
  }

  _getFiatRates(cb) {
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
          byDay: _.map(results, record => {
            const day = moment(record._id.day).format('YYYYMMDD');
            return {
              day,
              coin: record._id.coin,
              value: record.value
            };
          })
        };
        return cb(null, stats);
      });
  }

  _getTxProposals(cb) {
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
        _.each(results, record => {
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
  }
}
