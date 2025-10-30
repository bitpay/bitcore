#!/usr/bin/env node

import { BitcoinBlockStorage } from '../build/src/models/block';
import { Storage } from '../build/src/services/storage';

function usage(errMsg) {
  console.log('USAGE: ./addBlockFees [options]');
  console.log('[OPTIONS]:');
  console.log('  --chain <value>      BTC, BCH, DOGE, or LTC');
  console.log('  --network <value>    mainnet, testnet, or regtest');
  console.log('  --remove             remove all fee data from chain on network');
  console.log('  --reset              remove and re add all fee data');
  console.log('  --verbose            enable verbose logging');
  console.log('  --print-number       number of times to print fee data insertions (default 20)');
  console.log('  --pause-every        number of blocks sync before pausing 50ms (default 10)');
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
const printNumber = args.includes('--print-number') ? args[args.indexOf('--print-number') + 1] : 20;
const pauseEvery = args.includes('--pause-every') ? args[args.indexOf('--pause-every') + 1] : 10;

if (!['BTC', 'BCH', 'DOGE', 'LTC'].includes(chain) || !['mainnet', 'testnet', 'regtest'].includes(network)) {
  usage('Invalid chain and/or network param(s).');
}

const remove = args.includes('--remove');
const reset = args.includes('--reset');
const verbose = args.includes('--verbose');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.log('Connecting to storage...');
Storage.start()
  .then(async () => {
    const startTime = Date.now();
    const totalBlocks = await BitcoinBlockStorage.collection.countDocuments({ chain, network });
    
    if (remove || reset) {
      const prevBlocksWithFeesCount = await BitcoinBlockStorage.collection.countDocuments({ chain, network, feeData: { $exists: true } });
      if (prevBlocksWithFeesCount === 0) {
        console.log(`No fee data on ${chain} ${network} to remove (${totalBlocks} of ${totalBlocks})`);
        if (remove)
          return;
      }
      console.log(`Removing fee data from ${prevBlocksWithFeesCount} of ${totalBlocks} blocks on ${chain} ${network}`);
      await BitcoinBlockStorage.collection.updateMany({ chain, network }, { $unset: { feeData: {} } });
      const seconds = (Date.now() - startTime) / 1000;
      console.log(`Finished in ${seconds} seconds | ${(prevBlocksWithFeesCount / seconds).toFixed(2)} blocks/sec`);

      const blocksWithFeesCount = await BitcoinBlockStorage.collection.countDocuments({ chain, network, feeData: { $exists: true } });
      if (blocksWithFeesCount == 0) {
        console.log('Successfully removed fee data from blocks');
      } else {
        console.log(`${blocksWithFeesCount} blocks still have fee data`);
        if (verbose) {
          const blocksWithFees = await BitcoinBlockStorage.collection.find({ chain, network, feeData: { $exists: true } }).toArray();
          process.stdout.write('Blocks with fees:');
          for (const block of blocksWithFees) {
            process.stdout.write(` ${block.height}`);
          }
          console.log('');
        }
      }
      if (remove)
        return;
    }
    
    const prevBlocksWithoutFeesCount = await BitcoinBlockStorage.collection.countDocuments({ chain, network, feeData: { $exists: false } });
    if (prevBlocksWithoutFeesCount === 0) {
      console.log(`${chain} ${network} already has fee data`);
      return;
    }
    
    console.log(`Adding fee data to ${prevBlocksWithoutFeesCount} of ${totalBlocks} blocks on ${chain} ${network}`);
    
    const printEvery = Math.floor(prevBlocksWithoutFeesCount / printNumber);
    let feeDataAddedCount = 0;
  
    const stream = BitcoinBlockStorage.collection
      .find({ chain, network, feeData: { $exists: false } }, { projection: { height: 1, _id: 0 } })
      .addCursorFlag('noCursorTimeout', true)
      .stream();

    for await (const doc of stream) {
      const height = doc.height;
      const fee = await BitcoinBlockStorage.getBlockFee({ chain, network, blockId: height });
      feeDataAddedCount++;
      if (feeDataAddedCount < prevBlocksWithoutFeesCount) {
        BitcoinBlockStorage.collection.updateOne({ chain, network, height }, { $set: { feeData: fee } });
      // Resolve promise on last block
      } else {
        await BitcoinBlockStorage.collection.updateOne({ chain, network, height }, { $set: { feeData: fee } });
      }
      if (feeDataAddedCount % printEvery === 1)
        process.stdout.write(`${((feeDataAddedCount / prevBlocksWithoutFeesCount) * 100).toFixed(2)}%...`);
      if (feeDataAddedCount % pauseEvery === 0)
        await sleep(50);
    }

    console.log('100%');
    const seconds = (Date.now() - startTime) / 1000;
    console.log(`Finished in ${seconds} seconds | ${(prevBlocksWithoutFeesCount / seconds).toFixed(2)} blocks/sec`);

    const blocksWithoutFeesCount = await BitcoinBlockStorage.collection.countDocuments({ chain, network, feeData: { $exists: false } });
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