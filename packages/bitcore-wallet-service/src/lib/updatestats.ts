import * as async from 'async';
import moment from 'moment';
import * as mongodb from 'mongodb';

const storage = require('./storage');
const INITIAL_DATE = '2015-01-01';

export class UpdateStats {
  from: moment.MomentFormatSpecification;
  to: moment.MomentFormatSpecification;
  db: mongodb.Db;

  constructor() {
    this.from = moment(INITIAL_DATE).format('YYYY-MM-DD');
    this.to = moment().format('YYYY-MM-DD');
  }

  run(config, cb) {
    let uri = config.storageOpts.mongoDb.uri;

    if (uri.indexOf('?') > 0) {
      uri = uri + '&';
    } else {
      uri = uri + '?';
    }
    uri = uri + 'readPreference=secondaryPreferred';
    mongodb.MongoClient.connect(uri, (err, db) => {
      if (err) {
        console.log('Unable to connect to the mongoDB', err);
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
    async.series(
      [
        next => {
          console.log("Updating new wallets stats...");
          this._updateNewWallets(next);
        },
        next => {
          console.log("Updating tx proposals stats...");
          this._updateTxProposals(next);
        },
        next => {
          console.log("Updating fiat rates stats...");
          this._updateFiatRates(next);
        }
      ],
      (err) => {
        this.db.close();
        if (err) return cb(err);
        return cb();
      }
    );
  }

  _updateNewWallets(cb) {
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
          console.log('Update wallet stats throws error:', err);
          return cb(err);
        }
        if (res.length !== 0) {
          try {
            console.log(`Checking if stats_wallets table exist.`);
            if (!this.db.collection('stats_wallets').find()) {
              console.log(`stats_wallets table does not exist.`);
              console.log(`Creating stats_wallets table.`);
              await this.db.createCollection('stats_wallets');
            }
            console.log(`Cleaning stats_wallets table.`);
            await this.db
              .collection('stats_wallets')
              .remove({})
              .then(async () => {
                console.log(`Trying to insert ${res.length} entries`);
                const opts: any = { ordered: false };
                await this.db.collection('stats_wallets').insert(res, opts);
                console.log(`${res.length} entries inserted in stats_wallets`);
              });
          } catch (err) {
            console.log('Cannot insert into stats_wallets:', err);
          }
        } else {
          console.log("No data to update in stats_wallets");
        }
        return cb();
      });
  }

  _updateFiatRates(cb) {
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
          console.log('Update fiat rates stats throws error:', err);
          return cb(err);
        }
        if (res.length !== 0) {
          try {
            console.log(`Checking if stats_fiat_rates table exist.`);
            if (!this.db.collection('stats_fiat_rates').find()) {
              console.log(`stats_fiat_rates table does not exist.`);
              console.log(`Creating stats_fiat_rates table.`);
              await this.db.createCollection('stats_fiat_rates');
            }
            console.log(`Cleaning stats_fiat_rates table.`);
            await this.db
              .collection('stats_fiat_rates')
              .remove({})
              .then(async () => {
                console.log(`Trying to insert ${res.length} entries`);
                const opts: any = { ordered: false };
                await this.db.collection('stats_fiat_rates').insert(res, opts);
                console.log(`${res.length} entries inserted in stats_fiat_rates`);
              });
          } catch (err) {
            console.log('Cannot insert into stats_fiat_rates:', err);
          }
        } else {
          console.log("No data to update in stats_fiat_rates");
        }
        return cb();
      });
  }

  _updateTxProposals(cb) {
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
          console.log('Update txps stats throws error:', err);
          return cb(err);
        }
        if (res.length !== 0) {
          try {
            console.log(`Checking if stats_txps table exist.`);
            if (!this.db.collection('stats_txps').find()) {
              console.log(`stats_txps table does not exist.`);
              console.log(`Creating stats_txps table.`);
              await this.db.createCollection('stats_txps');
            }
            console.log(`Cleaning stats_txps table.`);
            await this.db
              .collection('stats_txps')
              .remove({})
              .then(async () => {
                console.log(`Trying to insert ${res.length} entries`);
                const opts: any = { ordered: false };
                await this.db.collection('stats_txps').insert(res, opts);
                console.log(`${res.length} entries inserted in stats_txps`);
              });
          } catch (err) {
            console.log('Cannot insert into stats_txps:', err);
          }
        } else {
          console.log("No data to update in stats_txps");
        }
        return cb();
      });
  }
}