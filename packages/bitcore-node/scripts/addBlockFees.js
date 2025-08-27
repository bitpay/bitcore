#!/usr/bin/env node

const { Storage } = require('../build/src/services/storage');
const { BitcoinBlockStorage } = require('../build/src/models/block')

function usage(errMsg) {
  console.log('USAGE: ./addBlockFees [options]');
  console.log('[OPTIONS]:');
  console.log('  --chain <value>      BTC, BCH, DOGE, or LTC');
  console.log('  --network <value>    mainnet, testnet, or regtest');
  console.log('  --remove             remove all fee data from chain on network')
  if (errMsg) {
    console.error(errMsg);
  }
  process.exit();
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  usage();
}

const chain = args[args.indexOf('--chain') + 1];
const network = args[args.indexOf('--network') + 1];

if (!['BTC', 'BCH', 'DOGE', 'LTC'].includes(chain) || !['mainnet', 'testnet', 'regtest'].includes(network)) {
  usage('Invalid chain and/or network param(s).');
}

const remove = args.includes('--remove');
const verbose = args.includes('--verbose');

console.log('Connecting to storage...');
Storage.start()
  .then(async () => {
    if (remove) {
      console.log(`Removing fee data from all blocks on ${chain} ${network}`);
      await BitcoinBlockStorage.collection.updateMany({ chain, network }, { $unset: { feeData: {} } })
      return;
    }
    console.log(`Adding fee data to all blocks on ${chain} ${network}`);
    let block = await BitcoinBlockStorage.collection.findOne({ chain: chain, network: network, height: 0 });

    while (true) {
      if (block.feeData?.feeTotal === undefined) {
        if (verbose)
          console.log(`Adding fee data to block ${block.height}`);
        const feeData = await BitcoinBlockStorage.getBlockFee({ chain, network, blockId: block.hash });
        await BitcoinBlockStorage.collection.updateOne({ chain, network, hash: block.hash }, { $set: { feeData } });
      } else if (verbose) {
        console.log(`Block ${block.height} fee data already added`);
      }
      if (!block.nextBlockHash)
        break;
      block = await BitcoinBlockStorage.collection.findOne({ chain, network, hash: block.nextBlockHash });
    }
    console.log(`Added fee data on ${chain} ${network}`);
  })
  .catch(console.error)
  .finally(() => {
    Storage.stop();
  });