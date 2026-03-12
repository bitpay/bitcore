#!/usr/bin/env node

import readline from 'readline';
import util from 'util';
import * as CWC from '@bitpay-labs/crypto-wallet-core';
import { TransactionStorage } from '../build/src/models/transaction.js';
import { Storage } from '../build/src/services/storage.js';


function usage(errMsg) {
  console.log('USAGE: ./fixEvmTxToFromAddressesCase.js <options>');
  console.log('OPTIONS:');
  console.log('  --chain <value>          REQUIRED - e.g. ETH, MATIC...');
  console.log('  --network <value>        REQUIRED - e.g. mainnet, sepolia, regtest...');
  console.log('  --startHeight <value>    REQUIRED Block height to start from');
  console.log('  --endHeight [value]      Block height to end at (default: current block height)');
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
const endHeight = endHeightIdx !== -1 ? parseInt(args[endHeightIdx + 1]) : undefined;

if (chainIdx === -1 || networkIdx === -1 || startHeightIdx === -1 || !chain || !network || !startHeight) {
  usage('Missing required options.');
}

if (endHeight && endHeight < startHeight) {
  usage('endHeight must be greater than or equal to startHeight.');
}


const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('Connecting to database...');

Storage.start()
  .then(async () => {
    const query = { $or: [
      { chain, network, blockHeight: { $gte: startHeight, ...(endHeight ? { $lte: endHeight } : {}) } },
      { chain, network, blockHeight: { $lt: 0 } }
    ] };
    const totalCount = await TransactionStorage.collection.countDocuments(query);
    console.log(`Found ${totalCount} transactions to update.`);

    const ans = await util.promisify(rl.question).call(rl, 'Would you like to continue? (Y/n) ');
    if (ans?.toLowerCase() === 'n') {
      return;
    }

    const txStream = TransactionStorage.collection.find(query);
    
    let countModified = 0;
    let countRunning = 0;
    for await (const tx of txStream) {
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
      countRunning++;
      if (countRunning % 100 === 0) {
        process.stdout.write(`Processed ${countRunning}/${totalCount} transactions (${countModified} updated)...         \r`);
      }
    }
    console.log(`\nUpdated ${countModified} transactions.`);
  })
  .catch(console.error)
  .finally(() => {
    rl.close();
    Storage.stop();
  });