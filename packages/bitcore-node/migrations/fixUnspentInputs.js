#!/usr/bin/env node
/****************************************
 *** This migration script will fix historical instances
 *** of an issue where inputs that were used in an RBF tx
 *** are left in a pending state if they are not used by
 *** the new tx that is the replacement.
 ***
 *** This does a dry run by default. Use "--dryrun false" 
 *** to execute outside of dry run.
 ********************************************/

const { TransactionModel, TransactionStorage } = require('../build/src/models/transaction');
const { CoinModel, CoinStorage } = require('../build/src/models/coin');
const fs = require('fs');
const fsPromises = fs.promises;
const { Storage } = require('../build/src/services/storage');
const { wait } = require('../build/src/utils/wait');

const RBFEnabledUTXOChains = ['BTC', 'LTC', 'DOGE'];
const networks = ['regtest', 'testnet', 'livenet'];

class Migration {
  transactionModel = new TransactionModel();
  coinModel = new CoinModel();

  constructor({ transactionModel = TransactionStorage, coinModel = CoinStorage } = {}) {
    this.transactionModel = transactionModel;
    this.coinModel = coinModel;
  }
  async connect() {
    try {
      if (!Storage.connected) {
        await Storage.start();
        await wait(2000);
      }
    } catch (e) {
      console.log(e);
    }
  }

  processArgs(argv) {
    let defaults = {
      dryrun: true
    };
    let args = argv.slice(2);
    const dryRunIdx = args.findIndex(i => i == '--dryrun');
    if (dryRunIdx >= 0) {
      defaults.dryrun =
        args[dryRunIdx + 1] == undefined || args[dryRunIdx + 1] == 'true'
          ? true
          : args[dryRunIdx + 1] == 'false'
          ? false
          : true;
    }
    return defaults;
  }

  async runScript(args) {
    console.log('running script with these args: ', args);
    let output = {};
    for await (const chain of RBFEnabledUTXOChains) {
      for await (const network of networks) {
        // using Set so that we don't have duplicates
        console.log(`updating records for ${chain}:${network}`);
        // Get array of all invalid txs for chain and network
        const invalidTxs = await this.transactionModel.collection
          .find({ chain, network, blockHeight: -3 }) // -3 is conflicted status
          .toArray();
        // Create array of tx ids
        const spentTxids = invalidTxs.map(tx => tx.txid);
        const recordsToUpdate = await this.coinModel.collection
          .find(
            { chain, network, spentTxid: { $in: spentTxids }, spentHeight: -1 } // -1 is pending status
          )
          .toArray();
        // Set all coins that were pending to be spent by an invalid tx back to unspent
        if (!args.dryrun) {
          const task = await this.coinModel.collection.updateMany(
            { chain, network, spentTxid: { $in: spentTxids }, spentHeight: -1 }, // -1 is pending status
            { $set: { spentHeight: -2 } } // -2 is unspent status
          );
          console.log('modified count: ', task.modifiedCount);
        }
        output[`${chain}-${network}`] = recordsToUpdate;
      }
    }
    const date = new Date().getTime();
    const filename = `output-${date}.log`;
    console.log(`writing output to ${filename}`);
    try {
      await fsPromises.writeFile(filename, JSON.stringify(output));
    } catch (e) {
      // write to stdout
      console.log('failed to write output to file. Writing to stdout instead.');
      console.log(output);
    }
    if (args.dryrun) {
      console.log('run the script with "--dryrun false" to execute this operation on the returned results.');
    }
  }
}

const migration = new Migration({ transactionModel: TransactionStorage, coinModel: CoinStorage });

migration
  .connect()
  .then(() => {
    const args = migration.processArgs(process.argv);
    migration.runScript(args).then(() => {
      console.log('completed');
      process.exit();
    });
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
