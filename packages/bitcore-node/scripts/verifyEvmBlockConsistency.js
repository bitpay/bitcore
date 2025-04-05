#!/usr/bin/env node
'use scrict';

const { Storage } = require('../build/src/services/storage');
const { EVMBlockStorage } = require('../build/src/providers/chain-state/evm/models/block');

function usage(err) {
  if (err) {
    console.log(err);
    console.log('');
  }
  console.log('Usage: ./verifyEvmBlockConsistency.js [options]');
  console.log('');
  console.log('  --chain <value>          ETH, MATIC');
  console.log('  --network <value>        mainnet, testnet, or regtest');
  console.log('  --startHeight <value>    Block height to start at (inclusive)');
  console.log('  --endHeight <value>      Block height to end at (inclusive) (optional)');
  process.exit();
};

const chain = process.argv.find(a => a == '--chain') ? process.argv[process.argv.indexOf('--chain') + 1] : undefined;
const network = process.argv.find(a => a == '--network') ? process.argv[process.argv.indexOf('--network') + 1] : undefined;
const startBlockHeight = process.argv.find(a => a == '--startHeight') ? Number(process.argv[process.argv.indexOf('--startHeight') + 1]) : undefined;
const endBlockHeight = process.argv.find(a => a == '--endHeight') ? Number(process.argv[process.argv.indexOf('--endHeight') + 1]) : undefined;

if (process.argv.includes('--help') || process.argv.includes(['-h'])) {
  usage();
}

if (!chain) {
  usage('Invalid chain: ' + chain);
}

if (!network) {
  usage('Invalid network: ' + network);
}

if (startBlockHeight == null || isNaN(startBlockHeight) || startBlockHeight < 0) {
  usage('Invalid startBlockHeight: ' + startBlockHeight);
}

console.log('Connecting to database...');

Storage.start({ dbReadPreference: 'secondary' })
  .then(async () => {
    try {
      const gaps = await EVMBlockStorage.getBlockSyncGaps({
        chain,
        network,
        startHeight: startBlockHeight,
        endHeight: endBlockHeight
      });

      if (gaps.length > 0) {
        console.log(JSON.stringify(gaps));
      } else {
        console.log('No gaps found.');
      }
    } catch (err) {
      console.error(err);
    }
  })
  .catch(console.error)
  .finally(Storage.stop.bind(Storage));
