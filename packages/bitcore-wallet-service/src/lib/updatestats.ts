import * as async from 'async';
import moment from 'moment';
import * as mongodb from 'mongodb';
const ObjectID = mongodb.ObjectID;

const storage = require('./storage');
const LAST_DAY = '2019-12-01';

var objectIdFromDate = function(date) {
  return Math.floor(date.getTime() / 1000).toString(16) + '0000000000000000';
};

export class UpdateStats {
  from: moment.MomentFormatSpecification;
  to: moment.MomentFormatSpecification;
  db: mongodb.Db;
  client: mongodb.MongoClient;

  constructor() {}

  run(config, cb) {
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
          console.log('## Updating new wallets stats...');
          this._updateNewWallets(next);
        },
        next => {
          console.log('## Updating tx proposals stats...');
          this._updateTxProposals(next);
        },
        next => {
          console.log('## Updating fiat rates stats...');
          this._updateFiatRates(next);
        }
      ],
      err => {
        return this.client.close(cb);
      }
    );
  }

  async _updateNewWallets(cb) {
    let lastDay = await this.lastRun('stats_wallets');
    let od = objectIdFromDate(new Date(lastDay));
    this.db
      .collection(storage.Storage.collections.WALLETS)
      .aggregate([
        {
          $match: {
            _id: { $gt: new ObjectID(od) }
          }
        },
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
            console.log('\tChecking if stats_wallets table exist.');
            if (!this.db.collection('stats_wallets').find()) {
              console.log('\tstats_wallets table does not exist.');
              console.log('\tCreating stats_wallets table.');
              await this.db.createCollection('stats_wallets');
            }

            console.log(`\tRemoving entries from/after ${lastDay}`);
            await this.db
              .collection('stats_wallets')
              .remove({ '_id.day': { $gte: lastDay } })
              .then(async err => {
                // rm day = null
                res = res.filter(x => x._id.day);
                console.log(`\tTrying to insert ${res.length} entries`);
                const opts: any = { ordered: false };
                await this.db.collection('stats_wallets').insert(res, opts);
                console.log(`${res.length} entries inserted in stats_wallets`);
              });
          } catch (err) {
            console.log('!! Cannot insert into stats_wallets:', err);
          }
        } else {
          console.log('\tNo data to update in stats_wallets');
        }
        return cb();
      });
  }

  async _updateFiatRates(cb) {
    let lastDay = await this.lastRun('stats_fiat_rates');
    let od = objectIdFromDate(new Date(lastDay));
    this.db
      .collection(storage.Storage.collections.FIAT_RATES2)
      .aggregate([
        {
          $match: {
            _id: { $gt: new ObjectID(od) }
          }
        },
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
          console.log('!! Update fiat rates stats throws error:', err);
          return cb(err);
        }
        if (res.length !== 0) {
          try {
            console.log('\tChecking if stats_fiat_rates table exist.');
            if (!this.db.collection('stats_fiat_rates').find()) {
              console.log('\tstats_fiat_rates table does not exist.');
              console.log('\tCreating stats_fiat_rates table.');
              await this.db.createCollection('stats_fiat_rates');
            }
            console.log(`\tRemoving entries from/after ${lastDay}`);
            await this.db
              .collection('stats_fiat_rates')
              .remove({ '_id.day': { $gte: lastDay } })
              .then(async err => {
                // rm day = null
                res = res.filter(x => x._id.day);

                console.log(`Trying to insert ${res.length} entries`);
                const opts: any = { ordered: false };
                await this.db.collection('stats_fiat_rates').insert(res, opts);
                console.log(`${res.length} entries inserted in stats_fiat_rates`);
              });
          } catch (err) {
            console.log('!! Cannot insert into stats_fiat_rates:', err);
          }
        } else {
          console.log('\tNo data to update in stats_fiat_rates');
        }
        return cb();
      });
  }

  async lastRun(coll) {
    // Grab last run
    let cursor = await this.db
      .collection(coll)
      .find({}) // , { _id: true }})  // not working on new mongo driver
      .sort({ _id: -1 })
      .limit(1);

    let last = await cursor.next();
    let lastDay = LAST_DAY;
    if (last && last._id) {
      lastDay = last._id.day;
      console.log(`\tLast run is ${lastDay}`);
    } else {
      console.log(`\t${coll} NEVER UPDATED. Set date to ${lastDay}`);
    }
    return lastDay;
  }

  async _updateTxProposals(cb) {
    let lastDay = await this.lastRun('stats_txps');
    let od = objectIdFromDate(new Date(lastDay));
    this.db
      .collection(storage.Storage.collections.TXS)
      .aggregate([
        {
          $match: {
            _id: { $gt: new ObjectID(od) }
          }
        },
        {
          $project: {
            date: { $add: [new Date(0), { $multiply: ['$createdOn', 1000] }] },
            network: '$network',
            coin: '$coin',
            amount: '$amount',
            id: '$_id'
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
          console.log('!! Update txps stats throws error:', err);
          return cb(err);
        }
        if (res.length !== 0) {
          try {
            console.log('\tChecking if stats_txps table exist.');
            if (!this.db.collection('stats_txps').find()) {
              console.log('\tstats_txps table does not exist.');
              console.log('\tCreating stats_txps table.');
              await this.db.createCollection('stats_txps');
            }

            console.log(`\tRemoving entries from/after ${lastDay}`);
            await this.db
              .collection('stats_txps')
              .remove({ '_id.day': { $gte: lastDay } })
              .then(async err => {
                // rm day = null
                res = res.filter(x => x._id.day);
                console.log(`\tTrying to insert ${res.length} entries`);
                const opts: any = { ordered: false };
                await this.db.collection('stats_txps').insert(res, opts);
                console.log(`\t${res.length} entries inserted in stats_txps`);
              });
          } catch (err) {
            console.log('!! Cannot insert into stats_txps:', err);
          }
        } else {
          console.log('\tNo data to update in stats_txps');
        }
        return cb();
      });
  }
}
