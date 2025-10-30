#!/usr/bin/env node

import * as readline from 'readline';
import { BitcoinBlockStorage as BlockStorage } from '../build/src/models/block';
import { CoinStorage } from '../build/src/models/coin';
import { TransactionStorage } from '../build/src/models/transaction';
import { Storage } from '../build/src/services/storage';
import { wait } from '../build/src/utils';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function usage(errMsg) {
  console.log('USAGE: ./purgeNetworkData.js [options');
  console.log('OPTIONS:');
  console.log('  --chain <value>      REQUIRED - e.g. BTC, BCH, DOGE, LTC...');
  console.log('  --network <value>    REQUIRED - e.g. mainnet, testnet3, regtest...');
  console.log('  --limit <value>      Number of documents to delete at a time. Default: 250');
  console.log('  --sleep <value>      Sleep time in milliseconds between deletions. Default: 50');
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
const limit = (limitIdx > -1 && parseInt(args[limitIdx + 1])) || 250;
const sleepIdx = args.indexOf('--sleep');
const sleepMs = (sleepIdx > -1 && parseInt(args[sleepIdx + 1])) || 50;
const everyIdx = args.indexOf('--every');
const nSleep = (everyIdx > -1 && parseInt(args[everyIdx + 1])) || 10;

let quit = false;
process.on('SIGINT', () => {
  if (quit) {
    process.exit(1);
  }
  console.log('Caught interrupt signal');
  quit = true;
});


console.log('Connecting to database...');

Storage.start()
  .then(async () => {
    console.log('Collecting stats. This could take a minute...');
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
      let blkIds = await BlockStorage.collection.find({ chain, network }).project({ _id: 1 }).limit(limit).toArray();
      while (blkIds.length && !quit) {
        process.stdout.write(`Blocks: ${(progressCnt / blkCount * 100).toFixed(2)}% (${progressCnt} / ${blkCount})\r`);
        await BlockStorage.collection.deleteMany({ _id: { $in: blkIds.map(a => a._id) } });
        progressCnt += blkIds.length;
        if (progressCnt % nSleep === 0) {
          await wait(sleepMs);
        }
        blkIds = await BlockStorage.collection.find({ chain, network }).project({ _id: 1 }).limit(limit).toArray();
      };
      if (!quit) console.log('\nBlocks purged.');
    }

    {
      progressCnt = 0;
      let txIds = await TransactionStorage.collection.find({ chain, network }).project({ _id: 1 }).limit(limit).toArray();
      while (txIds.length && !quit) {
        process.stdout.write(`Transactions: ${(progressCnt / txCount * 100).toFixed(2)}% (${progressCnt} / ${txCount})\r`);
        await TransactionStorage.collection.deleteMany({ _id: { $in: txIds.map(a => a._id) } });
        progressCnt += txIds.length;
        if (progressCnt % nSleep === 0) {
          await wait(sleepMs);
        }
        txIds = await TransactionStorage.collection.find({ chain, network }).project({ _id: 1 }).limit(limit).toArray();
      }
      if (!quit) console.log('\nTransactions purged.');
    }

    {
      progressCnt = 0;
      let coinIds = await CoinStorage.collection.find({ chain, network }).project({ _id: 1 }).limit(limit).toArray();
      while (coinIds.length && !quit) {
        process.stdout.write(`Coins: ${(progressCnt / coinCount * 100).toFixed(2)}% (${progressCnt} / ${coinCount})\r`);
        await CoinStorage.collection.deleteMany({ _id: { $in: coinIds.map(a => a._id) } });
        progressCnt += coinIds.length;
        if (progressCnt % nSleep === 0) {
          await wait(sleepMs);
        }
        coinIds = await CoinStorage.collection.find({ chain, network }).project({ _id: 1 }).limit(limit).toArray();
      }
      if (!quit) console.log('\nCoins purged.');
    }
    if (!quit) console.log('Data purged.');
  })
  .catch(console.error)
  .finally(() => {
    rl.close();
    Storage.stop();
  });