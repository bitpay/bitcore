import * as async from 'async';
import * as _ from 'lodash';
import moment from 'moment';
import * as mongodb from 'mongodb';
import logger from './logger';

const config = require('../config');

const INITIAL_DATE = '2015-01-01';

export class Stats {
  network: string;
  coin: string;
  from: moment.MomentFormatSpecification;
  to: moment.MomentFormatSpecification;
  db: mongodb.Db;
  client: mongodb.MongoClient;

  constructor(opts) {
    opts = opts || {};

    this.network = opts.network || 'livenet';
    this.coin = opts.coin || 'btc';
    this.from = moment(opts.from || INITIAL_DATE).format('YYYY-MM-DD');
    this.to = moment(opts.to).format('YYYY-MM-DD');
  }

  run(cb) {
    let dbConfig = config.storageOpts.mongoDb;
    let uri = dbConfig.uri;

    // Always for stats!
    uri = uri + 'readPreference=secondaryPreferred';
    console.log('Connected to ', uri);

    if (!dbConfig.dbname) {
      return cb(new Error('No dbname at config.'));
    }

    mongodb.MongoClient.connect(dbConfig.uri, { useUnifiedTopology: true }, (err, client) => {
      if (err) {
        return cb(err);
      }
      this.db = client.db(dbConfig.dbname);
      this.client = client;

      this._getStats((err, stats) => {
        if (err) return cb(err);

        this.client.close(err => {
          if (err) logger.error(err);
          return cb(null, stats);
        });
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
