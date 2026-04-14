#!/usr/bin/env node

import readline from 'readline';
import util from 'util';
import * as CWC from '@bitpay-labs/crypto-wallet-core';
import { BitcoinBlockStorage } from '../build/src/models/block.js';
import { TransactionStorage } from '../build/src/models/transaction.js';
import { Storage } from '../build/src/services/storage.js';

let shutdown = false;
process.on('SIGINT', () => {
  if (shutdown) {
    console.log('Force exiting...');
    process.exit(1);
  }
  shutdown = true;
  console.log('Gracefully shutting down...');
});

function usage(errMsg) {
  console.log('USAGE: ./fixEvmTxToFromAddressesCase.js <options>');
  console.log('OPTIONS:');
  console.log('  --chain <value>          REQUIRED - e.g. ETH, MATIC...');
  console.log('  --network <value>        REQUIRED - e.g. mainnet, sepolia, regtest...');
  console.log('  --startHeight <value>    REQUIRED Block height to start from');
  console.log('  --endHeight <value>      REQUIRED Block height to stop at');
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
const startHeightIdx = args.indexOf('--startHeight');
const endHeightIdx = args.indexOf('--endHeight');
const chain = args[chainIdx + 1]?.toUpperCase();
const network = args[networkIdx + 1]?.toLowerCase();
const startHeight = parseInt(args[startHeightIdx + 1]);
const endHeight = parseInt(args[endHeightIdx + 1]);

if (chainIdx === -1 || networkIdx === -1 || startHeightIdx === -1 || endHeightIdx === -1) {
  usage('Missing required options.');
}

if (!chain || !network || isNaN(startHeight) || isNaN(endHeight)) {
  usage('Invalid option value(s).');
}

if (startHeight < 0) {
  usage('startHeight must be greater than or equal to 0.');
}

if (endHeight <= startHeight) {
  usage('endHeight must be greater than startHeight.');
}


const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('Connecting to database...');

Storage.start()
  .then(async () => {
    console.log('Finding local tip...');
    const lastBlockNum = Math.min(endHeight, (await BitcoinBlockStorage.getLocalTip({ chain, network }))?.height ?? Infinity);
    const totalBlockCount = lastBlockNum - startHeight + 1;
    console.log(`Updating ${totalBlockCount} block's worth of transactions.`);

    const ans = await util.promisify(rl.question).call(rl, 'Would you like to continue? (Y/n) ');
    if (ans?.toLowerCase() === 'n') {
      return;
    }

    let thisBlockNum = startHeight;
    let countModified = 0;
    let countRunning = 0;

    do {
      if (shutdown) {
        return;
      }        
      const txStream = TransactionStorage.collection.find({ chain, network, blockHeight: thisBlockNum }).addCursorFlag('noCursorTimeout', true);
      
      for await (const tx of txStream) {
        if (shutdown) {
          return;
        }
        const res = await TransactionStorage.collection.updateOne(
          { _id: tx._id },
          {
            $set: {
              to: tx.to ? CWC.Web3.utils.toChecksumAddress(tx.to) : '',
              from: tx.from ? CWC.Web3.utils.toChecksumAddress(tx.from) : ''
            }
          }
        );
        if (!res.result.ok) {
          console.error(`Failed to update tx ${tx.txid}:`, res);
        }
        countModified += res.modifiedCount;
        if (countRunning % 100 === 0) {
          const percent = ((thisBlockNum - startHeight) / totalBlockCount * 100).toFixed(4);
          process.stdout.write(`Processing block ${thisBlockNum} (${percent}%) -- (${countModified} txs updated)...         \r`);
          await new Promise(r => setTimeout(r, 20));
        }
        countRunning++;
      }
      thisBlockNum++;
    } while (thisBlockNum <= lastBlockNum);
    
    console.log(`\nUpdated ${countModified} transactions.`);
  })
  .catch(console.error)
  .finally(() => {
    rl.close();
    Storage.stop();
  });