#!/usr/bin/env node


const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
const Config = require('../build/src/config');
const { BitcoinBlockStorage } = require('../build/src/models/block');
const { BitcoinP2PWorker } = require('../build/src/modules/bitcoin/p2p');
const { Storage } = require('../build/src/services/storage');


function usage(errMsg) {
  console.log('USAGE: ./addGenesisBlock.js [options]');
  console.log('OPTIONS:');
  console.log('  --chain <value>      BTC, BCH, DOGE, or LTC');
  console.log('  --network <value>    mainnet, testnet, or regtest');
  console.log('  --real               Write the change to the db. If not given, will only do a dry run');
  if (errMsg) {
    console.log('\nERROR: ' + errMsg);
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

const real = !!args.find(a => a === '--real');
console.log('Real:', real);
real && console.log('~~~~ REAL RUN ~~~~');

let p2pWorker;

console.log('Connecting to storage...');
Storage.start()
  .then(async () => {
    const genesisExists = await BitcoinBlockStorage.collection.findOne({ chain, network, height: 0 });
    if (genesisExists) {
      console.log('Genesis block already exists.', genesisExists.hash);
      return;
    }

    const blockOne = await BitcoinBlockStorage.collection.findOne({ chain, network, height: 1 });
    if (!blockOne) {
      console.log('Block 1 not found.');
      return;
    }

    const chainConfig = Config.default.chains[chain][network];
    p2pWorker = new BitcoinP2PWorker({ chain, network, chainConfig });
    await p2pWorker.connect();
    p2pWorker.pool.on('peerblock', async (peer, message) => {
      if (message.block?.hash === blockOne.previousBlockHash) {
        p2pWorker.events.emit(message.block.hash, message.block);
      }
    });
    const genesisBlock = await p2pWorker.getBlock(blockOne.previousBlockHash);
    
    console.log('\nGenesis block:', genesisBlock.hash);
    const ans = await new Promise(r => rl.question(`${real ? '' : 'DRY RUN: '}Do you want to continue? (y/N): `, r));
    if (ans?.toLowerCase() !== 'y') {
      console.log('Aborted.');
      return;
    }

    if (real) {
      await BitcoinBlockStorage.processBlock({
        block: genesisBlock,
        initialSyncComplete: true,
        chain,
        network
      });
      const cnt = await BitcoinBlockStorage.collection.countDocuments({ chain, network, height: 0 });
      cnt == 1 ? console.log('Genesis block added') : console.log(`Somethings wrong. There are ${cnt} genesis blocks in the db`);
    } else {
      console.log('Dry run. Genesis block not added.');
    }
  })
  .catch(console.error)
  .finally(() => {
    rl.close();
    p2pWorker?.disconnect();
    Storage.stop();
  });