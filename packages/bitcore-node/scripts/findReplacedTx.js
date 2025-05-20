#!/usr/bin/env node

const { Storage } = require('../build/src/services/storage');
const { TransactionStorage } = require('../build/src/models/transaction');

function usage(errMsg) {
  console.log('USAGE: ./findReplacedTx.js <options>');
  console.log('OPTIONS:');
  console.log('  --chain <value>      REQUIRED - e.g. BTC, BCH, DOGE, LTC...');
  console.log('  --network <value>    REQUIRED - e.g. mainnet, testnet3, regtest...');
  console.log('  --txid <value>       REQUIRED Transaction Id that replaced');
  console.log('  --window [value]     Minutes to look back (default: 10)')
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
const txidIdx = args.indexOf('--txid');
const chain = args[chainIdx + 1]?.toUpperCase();
const network = args[networkIdx + 1]?.toLowerCase();
const txid = args[txidIdx + 1];

if (chainIdx === -1 || networkIdx === -1 || txidIdx === -1 || !chain || !network || !txid) {
  usage('Missing required options.');
}

const windowIdx = args.indexOf('--window');
const windowMins = (windowIdx > -1 && parseInt(args[windowIdx + 1])) || 10;

console.log('Connecting to database...');

Storage.start()
  .then(async () => {

    const confirmedTx = await TransactionStorage.collection.findOne({ chain, network, txid });
    if (!confirmedTx) {
      console.log('Tx not found in db:', txid);
      return;
    }
    const $lt = new Date(confirmedTx.blockTimeNormalized);
    const $gt = new Date($lt.getTime() - (1000 * 60 * windowMins));
    const related = TransactionStorage.collection.find({ chain, network, blockTimeNormalized: { $lt, $gt }, blockHeight: -3  });
    for await (const tx of related) {
      if (tx.replacedByTxid === txid) {
        console.log(tx);
        break;
      }
    }

  })
  .catch(console.error)
  .finally(() => {
    Storage.stop();
  });