#!/usr/bin/env node

const { Storage } = require('../build/src/services/storage');
const { BitcoinBlockStorage: BlockStorage } = require('../build/src/models/block');
const { TransactionStorage } = require('../build/src/models/transaction');
const { CoinStorage } = require('../build/src/models/coin');
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
const { wait } = require('../build/src/utils');

function usage(errMsg) {
  console.log('USAGE: ./purgeNetworkData.js [options');
  console.log('OPTIONS:');
  console.log('  --chain <value>      REQUIRED - e.g. BTC, BCH, DOGE, LTC...');
  console.log('  --network <value>    REQUIRED - e.g. mainnet, testnet3, regtest...');
  console.log('  --limit <value>      Number of documents to delete at a time. Default: 1000');
  console.log('  --sleep <value>      Sleep time in milliseconds between deletions. Default: 200');
  console.log('  --every <value>      Sleep for --sleep milliseconds every --every loop iteration. Default: 10');
  if (errMsg) {
    console.log('\nERROR: ' + errMsg);
  }
  process.exit();
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  usage();
}


const chainIdx = args.indexOf('--chain');
const networkIdx = args.indexOf('--network');
const chain = args[chainIdx + 1]?.toUpperCase();
const network = args[networkIdx + 1]?.toLowerCase();

if (chainIdx === -1 || networkIdx === -1 || !chain || !network) {
  usage('Missing required options.');
}

const limitIdx = args.indexOf('--limit');
const limit = (limitIdx > -1 && parseInt(args[limitIdx + 1])) || 1000;
const sleepIdx = args.indexOf('--sleep');
const sleepMs = (sleepIdx > -1 && parseInt(args[sleepIdx + 1])) || 200;
const everyIdx = args.indexOf('--every');
const nSleep = (everyIdx > -1 && parseInt(args[everyIdx + 1])) || 10;

console.log('Connecting to database...');

Storage.start()
  .then(async () => {
    const blkCount = await BlockStorage.collection.countDocuments({ chain, network });
    const txCount = await TransactionStorage.collection.countDocuments({ chain, network });
    const coinCount = await CoinStorage.collection.countDocuments({ chain, network });
    let progressCnt = 0;

    console.log(`If you continue, the following ${chain}:${network} data will be purged:`);
    console.log('Blocks:', blkCount);
    console.log('Transactions:', txCount);
    console.log('Coins:', coinCount);
    console.log(`Data will be deleted in batches of ${limit} documents with a sleep time of ${sleepMs}ms every ${nSleep} iterations.`);

    const ans = await new Promise(r => rl.question('Do you want to continue? (y/N): ', r));
    if (ans?.toLowerCase() !== 'y') {
      console.log('Aborted.');
      return;
    }

    {
      progressCnt = 0;
      let blkIds = await BlockStorage.collection.find({ chain, network }).project({ _id: 1 }).sort({ _id: 1 }).limit(limit).toArray();
      while (blkIds.length) {
        process.stdout.write(`Blocks: ${(progressCnt / blkCount).toFixed(2)}% (${progressCnt} / ${blkCount})\r`);
        const res = await BlockStorage.collection.deleteMany({ _id: { $in: blkIds.map(a => a._id) } });
        progressCnt += blkIds.length;
        if (progressCnt % nSleep === 0) {
          await wait(sleepMs);
        }
        blkIds = await BlockStorage.collection.find({ chain, network }).project({ _id: 1 }).sort({ _id: 1 }).limit(limit).toArray();
      };
      console.log('\nBlocks purged.');
    }

    {
      progressCnt = 0;
      let txIds = await TransactionStorage.collection.find({ chain, network }).project({ _id: 1 }).sort({ _id: 1 }).limit(limit).toArray();
      while (txIds.length){
        process.stdout.write(`Transactions: ${(progressCnt / txCount).toFixed(2)}% (${progressCnt} / ${txCount})\r`);
        const res = await TransactionStorage.collection.deleteMany({ _id: { $in: txIds.map(a => a._id) } });
        progressCnt += txIds.length;
        if (progressCnt % nSleep === 0) {
          await wait(sleepMs);
        }
        txIds = await TransactionStorage.collection.find({ chain, network }).project({ _id: 1 }).sort({ _id: 1 }).limit(limit).toArray();
      }
      console.log('\nTransactions purged.');
    }

    {
      progressCnt = 0;
      let coinIds = await CoinStorage.collection.find({ chain, network }).project({ _id: 1 }).sort({ _id: 1 }).limit(limit).toArray();
      while (coinIds.length) {
        process.stdout.write(`Coins: ${(progressCnt / coinCount).toFixed(2)}% (${progressCnt} / ${coinCount})\r`);
        const res = await CoinStorage.collection.deleteMany({ _id: { $in: coinIds.map(a => a._id) } });
        progressCnt += coinIds.length;
        if (progressCnt % nSleep === 0) {
          await wait(sleepMs);
        }
        coinIds = await CoinStorage.collection.find({ chain, network }).project({ _id: 1 }).sort({ _id: 1 }).limit(limit).toArray();
      }
      console.log('\nCoins purged.');
    }
    console.log('Data purged.');
  })
  .catch(console.error)
  .finally(() => {
    rl.close();
    Storage.stop();
  });