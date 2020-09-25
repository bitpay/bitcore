import * as async from 'async';
import * as _ from 'lodash';
import moment from 'moment';
import * as mongodb from 'mongodb';
import logger from './logger';

const config = require('../config');
const ObjectID = mongodb.ObjectID;
const storage = require('./storage');

var objectIdDate = function(date) {
  return Math.floor(date.getTime() / 1000).toString(16) + '0000000000000000';
};

export class CleanFiatRates {
  db: mongodb.Db;
  client: mongodb.MongoClient;
  from: Date;
  to: Date;

  constructor() {}

  run(cb) {
    let dbConfig = config.storageOpts.mongoDb;

    let uri = dbConfig.uri;

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

      this.cleanFiatRates((err, rates) => {
        if (err) return cb(err);

        this.client.close(err => {
          if (err) logger.error(err);
          return cb(null, rates);
        });
      });
    });
  }

  cleanFiatRates(cb) {
    let dates;
    async.series(
      [
        next => {
          console.log('## Getting dates to keep...');
          this._getDatesToKeep((err, res) => {
            if (err) {
              return next(err);
            }
            dates = res;
            next();
          });
        },
        next => {
          console.log('## Cleaning fiat rates...');
          this._cleanFiatRates(dates, next);
        }
      ],
      (err, results) => {
        if (err) return cb(err);
        return cb(null, results[1]);
      }
    );
  }

  async _getDatesToKeep(cb) {
    this.from = new Date();
    this.from.setMonth(this.from.getMonth() - 2); // from 2 month ago
    console.log(`\tFrom: ${moment(this.from).toDate()}`);

    this.to = new Date();
    this.to.setMonth(this.to.getMonth() - 1); // to 1 month ago
    console.log(`\tTo: ${moment(this.to).toDate()}`);

    const objectIdFromDate = objectIdDate(this.from);
    const objectIdToDate = objectIdDate(this.to);

    this.db
      .collection(storage.Storage.collections.FIAT_RATES2)
      .find({
        _id: {
          $gte: new ObjectID(objectIdFromDate),
          $lte: new ObjectID(objectIdToDate)
        }
      })
      .sort({ _id: 1 })
      .toArray((err, results) => {
        if (err) return cb(err);

        const datesToKeep = [];

        // Timestamps grouped by coin avoiding duplicates.
        let tsGruopedByCoin = _.reduce(
          results,
          (r, a) => {
            r[a.coin] = _.uniq([...(r[a.coin] || []), a.ts]);
            return r;
          },
          {}
        );

        // keep one date every hour for each coin
        _.forEach(tsGruopedByCoin, (tsGroup, key) => {
          console.log(`\tFiltering times for ${key.toUpperCase()}`);
          let prevTime = null;
          let isSameHour;

          _.forEach(tsGroup, (ts: number) => {
            if (prevTime > ts + 60 * 10000) return cb(new Error('Results not in order'));

            if (prevTime) {
              isSameHour = moment(prevTime).isSame(moment(ts), 'hour');
              if (!isSameHour) {
                datesToKeep.push(ts);
              }
            } else {
              // keep first date in case prevTime doesn't exist.
              datesToKeep.push(ts);
            }
            prevTime = ts;
          });
        });
        return cb(null, datesToKeep);
      });
  }

  async _cleanFiatRates(datesToKeep, cb) {
    try {
      this.db
        .collection(storage.Storage.collections.FIAT_RATES2)
        .remove({
          ts: {
            $nin: datesToKeep,
            $gte: moment(this.from).valueOf(),
            $lte: moment(this.to).valueOf()
          }
        })
        .then(data => {
          console.log(`\t${data.result.n} entries were removed from fiat_rates2`);
          return cb(null, data.result);
        });
    } catch (err) {
      console.log('\t!! Cannot remove data from fiat_rates2:', err);
      return cb(err);
    }
  }
}
