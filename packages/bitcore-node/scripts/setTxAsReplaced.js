#!/usr/bin/env node

const { Storage } = require('../build/src/services/storage');
const { TransactionStorage } = require('../build/src/models/transaction');
const { SpentHeightIndicators } = require('../build/src/types/Coin');

function usage(errMsg) {
  console.log('USAGE: ./setTxAsReplaced.js <txid> <replacementTxid> [options]');
  console.log('OPTIONS:');
  console.log('  --chain <value>      BTC, BCH, DOGE, or LTC');
  console.log('  --network <value>    mainnet, testnet, or regtest');
  console.log('  --real               Write the change to the db. If not given, will only do a dry run');
  console.log('  --force              Force the overwrite of an existing replacedByTxid field');
  if (errMsg) {
    console.log('\nERROR: ' + errMsg);
  }
  process.exit();
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  usage();
}

if (!args[0] || !/^[a-f0-9]{64}$/i.test(args[0])) {
  usage('Missing or invalid txid param.');
}

if (!args[1] || !/^[a-f0-9]{64}$/i.test(args[1])) {
  usage('Missing replacementTxid param.');
}

const [txid, replacementTxid] = args;
const chain = args[args.indexOf('--chain') + 1];
const network = args[args.indexOf('--network') + 1];

if (!['BTC', 'BCH', 'DOGE', 'LTC'].includes(chain) || !['mainnet', 'testnet', 'regtest'].includes(network)) {
  usage('Invalid chain and/or network param(s).');
}

const real = !!args.find(a => a === '--real');
const force = !!args.find(a => a === '--force');

Storage.start()
  .then(async () => {
    const tx = await TransactionStorage.collection.findOne({ chain, network, txid });
    if (!tx) {
      console.log('No tx found for txid.');
      return;
    }
    
    if (tx.replacedByTxid) {
      console.log('Tx already has replacement txid: ' + tx.replacedByTxid);
      if (!force) {
        return;
      }
    }

    const rTx = await TransactionStorage.collection.findOne({ chain, network, txid: replacementTxid });
    if (!rTx) {
      console.log('Replacement tx not found for replacementTxid');
      return;
    }
    
    if (real) {
      const res = await TransactionStorage.collection.updateOne(
        { chain, network, txid },
        { $set: { replacedByTxid: replacementTxid, blockHeight: -3 /* conflicting */ } }
      );
      console.log(JSON.stringify(res?.result || res));
    } else {
      console.log('Dry run complete.');
    }
  })
  .catch(console.error)
  .finally(Storage.stop.bind(Storage))