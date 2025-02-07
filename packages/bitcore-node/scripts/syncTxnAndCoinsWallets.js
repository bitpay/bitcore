#!/usr/bin/env node
'use scrict';

/**
 * This script fixes an issue where the wallets are in Coin.wallets but not Transaction.wallets in the db
 */

const fs = require('fs');
const { Storage } = require('../build/src/services/storage');
const { TransactionStorage } = require('../build/src/models/transaction');
const { CoinStorage } = require('../build/src/models/coin');

function usage(err) {
  if (err) {
    console.log(err);
    console.log('');
  }
  console.log('Usage: ./syncTxnAndCoinsWallets.js [options]');
  console.log('');
  console.log('  --chain <value>          BTC, BCH, ETH, etc.');
  console.log('  --network <value>        mainnet, testnet, or regtest');
  console.log('  --startHeight <value>    Block height to start at (inclusive)');
  console.log('  --endHeight <value>      Block height to end at (inclusive)');
  console.log('  --no-dry                 Run it for real');
  console.log('  --no-log-file            Output to console instead of writing to a log file');
  process.exit();
};

const chain = process.argv.find(a => a == '--chain') ? process.argv[process.argv.indexOf('--chain') + 1] : undefined;
const network = process.argv.find(a => a == '--network') ? process.argv[process.argv.indexOf('--network') + 1] : undefined;
const startBlockHeight = process.argv.find(a => a == '--startHeight') ? Number(process.argv[process.argv.indexOf('--startHeight') + 1]) : undefined;
const endBlockHeight = process.argv.find(a => a == '--endHeight') ? Number(process.argv[process.argv.indexOf('--endHeight') + 1]) : undefined;
const dryRun = process.argv.find(a => a == '--no-dry') ? false : true;
const noLogFile = process.argv.find(a => a == '--no-log-file') ? true : false;

if (process.argv.includes('--help') || process.argv.includes(['-h'])) {
  usage();
}

if (!chain) {
  usage('Invalid chain: ' + chain);
}

if (!network) {
  usage('Invalid network: ' + network);
}

if (!startBlockHeight || isNaN(startBlockHeight)) {
  usage('Invalid startBlockHeight: ' + startBlockHeight);
}

if (!endBlockHeight || isNaN(endBlockHeight)) {
  usage('Invalid endBlockHeight: ' + endBlockHeight);
}

if (!dryRun) {
  console.log('RUNNING FOR REAL. DATA WILL BE MODIFIED IN THE DATABASE');
}

console.log('Connecting to database...');

Storage.start()
  .catch(console.error)
  .then(async () => {
    try {
      const logFileName = `syncTxnAndCoinsWalletsOutput-${chain}-${network}-${new Date().toISOString()}.log`;

      const coinCursor = await CoinStorage.collection.find({
        chain,
        network,
        $or: [
          { mintHeight: { $gte: startBlockHeight, $lte: endBlockHeight } },
          { spentHeight: { $gte: startBlockHeight, $lte: endBlockHeight } }
        ],
        'wallets.0': { $exists: true }
      });

      let coin;
      while (coin = (await coinCursor.next())) {
        const txids = [coin.mintTxid];
        if (coin.spentTxid) {
          txids.push(coin.spentTxid);
        }
        const txs = await TransactionStorage.collection.find({ txid: { $in: txids } }).toArray();
        if (!txs.length) {
          console.log('Missing tx ' + coin.mintTxid + ' for coin ' + coin._id);
          continue;
        }
        for (const tx of txs) {
          for (const walletId of coin.wallets) {
            if (!tx.wallets.map(w => w.toString()).includes(walletId.toString())) {
              if (noLogFile) {
                console.log(`Adding wallet ${walletId} to tx ${tx.txid}`);
              } else {
                fs.appendFileSync(__dirname + '/' + logFileName, `Adding wallet ${walletId} to tx ${tx.txid}\n`);
              }

              if (!dryRun) {
                await TransactionStorage.collection.updateOne({
                  txid: tx.txid
                }, {
                  $addToSet: {
                    wallets: walletId
                  }
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  })
  .finally(() => {
    if (Storage.connected) {
      Storage.stop();
    }
  });
