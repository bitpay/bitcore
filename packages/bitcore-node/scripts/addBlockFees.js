#!/usr/bin/env node

const { Storage } = require('../build/src/services/storage');
const { BitcoinBlockStorage } = require('../build/src/models/block')

function usage(errMsg) {
  console.log('USAGE: ./addBlockFees [options]');
  console.log('[OPTIONS]:');
  console.log('  --chain <value>      BTC, BCH, DOGE, or LTC');
  console.log('  --network <value>    mainnet, testnet, or regtest');
  console.log('  --remove             remove all fee data from chain on network')
  console.log('  --verbose            enable verbose logging')
  console.log('  --print-number       number of times to print fee data insertions (default 20)')
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
const printNumber = args[args.indexOf('--print-number') + 1] || 20;

if (!['BTC', 'BCH', 'DOGE', 'LTC'].includes(chain) || !['mainnet', 'testnet', 'regtest'].includes(network)) {
  usage('Invalid chain and/or network param(s).');
}

const remove = args.includes('--remove');
const verbose = args.includes('--verbose');

console.log('Connecting to storage...');
Storage.start()
  .then(async () => {
    const startTime = Date.now();
    const prevBlocksWithFeesCount = await BitcoinBlockStorage.collection.countDocuments({ chain, network, feeData: { $exists: true } });
    const totalBlocks = await BitcoinBlockStorage.collection.countDocuments({ chain, network });
    
    if (remove) {
      if (prevBlocksWithFeesCount === 0) {
        console.log(`No fee data on ${chain} ${network} to remove (${totalBlocks} of ${totalBlocks})`);
        return;
      }
      console.log(`Removing fee data from ${prevBlocksWithFeesCount} of ${totalBlocks} blocks on ${chain} ${network}`);
      await BitcoinBlockStorage.collection.updateMany({ chain, network }, { $unset: { feeData: {} } });
      console.log(`Finished in ${(Date.now() - startTime) / 1000} seconds`)

      const blocksWithFeesCount = await BitcoinBlockStorage.collection.countDocuments({ chain, network, feeData: { $exists: true } });
      if (blocksWithFeesCount == 0) {
        console.log('Successfully removed fee data from blocks')
      } else {
        console.log(`${blocksWithFeesCount} blocks still have fee data`)
        if (verbose) {
          const blocksWithFees = await BitcoinBlockStorage.collection.find({ chain, network, feeData: { $exists: true } }).toArray();
          process.stdout.write('Blocks with fees:');
          for (const block of blocksWithFees) {
            process.stdout.write(` ${block.height}`);
          }
          console.log('');
        }
      }
      return;
    }
    
    const prevBlocksWithoutFeesCount = totalBlocks - prevBlocksWithFeesCount;
    if (prevBlocksWithoutFeesCount === 0) {
      console.log(`${chain} ${network} already has fee data`);
      return;
    }
    
    const blockHeightsWithoutFees = (await BitcoinBlockStorage.collection
      .find({ chain, network, feeData: { $exists: false } }, { projection: { height: 1, _id: 0 }})
      .toArray())
      .map(obj => obj.height);
    console.log(`Adding fee data to ${prevBlocksWithoutFeesCount} blocks on ${chain} ${network}`);
    if (verbose) {
      for (const height of blockHeightsWithoutFees) 
        process.stdout.write(`${height} `)
      console.log('');
    }

    const printEvery = Math.floor(prevBlocksWithoutFeesCount / printNumber);
    for (let i = 0; i < prevBlocksWithoutFeesCount; i++) {
      const height = blockHeightsWithoutFees[i];
      const feeData = await BitcoinBlockStorage.getBlockFee({ chain, network, blockId: height });
      BitcoinBlockStorage.collection.updateOne({ chain, network, height }, { $set: { feeData } });
      if (i % printEvery === 0)
        process.stdout.write(`${(i / prevBlocksWithoutFeesCount * 100).toFixed(2)}%...`)
    }
    console.log('100%');
    console.log(`Finished in ${(Date.now() - startTime) / 1000} seconds`)

    const blocksWithoutFeesCount = await BitcoinBlockStorage.collection.countDocuments({ chain, network, feeData: { $exists: false }});
    if (blocksWithoutFeesCount == 0) {
      console.log(`Successfully added fee data to blocks on ${chain} ${network}`);
    } else {
      console.log(`${blocksWithoutFeesCount} blocks still do not have fee data`);
      if (verbose) {
        process.stdout.write('Blocks without fees:');
        const blocksWithoutFees = await BitcoinBlockStorage.collection.find({ chain, network, feeData: { $exists: false } }).toArray();
        for (const block of blocksWithoutFees)
          process.stdout.write(` ${block.height}`);
        console.log('');
      }
    }
  })
  .catch(console.error)
  .finally(() => {
    Storage.stop();
  });