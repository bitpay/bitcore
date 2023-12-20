#!/usr/bin/env node
'use strict';

const { Storage } = require('../build/src/services/storage');
const { EVMTransactionStorage } = require('../build/src/providers/chain-state/evm/models/transaction');
const { CryptoRpc } = require('crypto-rpc');

function usage(err) {
  if (err) {
    console.log(err);
    console.log('');
  }
  console.log('Usage: ./backfillEvmTxEffects.js [options]');
  console.log('');
  console.log('  --chain <value>          ETH, MATIC');
  console.log('  --network <value>        mainnet, testnet, or regtest');
  console.log('  --startHeight <value>    Block height to start at (inclusive)');
  console.log('  --endHeight <value>      Block height to end at (inclusive) (optional)');
  console.log('  --event <value>          Filter to txs that emitted a specific event ("eventName:contractAddress") (optional)');
  console.log('  --node <value>           Use a custom rpc ("protocol://host:port") (optional - will default to rpc in config)');
  process.exit();
};

const chain = process.argv.find(a => a == '--chain') ? process.argv[process.argv.indexOf('--chain') + 1] : undefined;
const network = process.argv.find(a => a == '--network') ? process.argv[process.argv.indexOf('--network') + 1] : undefined;
const startBlockHeight = process.argv.find(a => a == '--startHeight') ? Number(process.argv[process.argv.indexOf('--startHeight') + 1]) : undefined;
const endBlockHeight = process.argv.find(a => a == '--endHeight') ? Number(process.argv[process.argv.indexOf('--endHeight') + 1]) : undefined;
const event = process.argv.find(a => a == '--event') ? process.argv[process.argv.indexOf('--event') + 1] : undefined;
const node = process.argv.find(a => a == '--node') ? process.argv[process.argv.indexOf('--node') + 1] : undefined;

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

let eventName, contractAddress;
if (event) {
  eventName = event.split(':')[0];
  contractAddress = event.split(':')[1];
  if (!eventName || !contractAddress) {
    usage('Invalid event received: ' + event + '\nShould be formatted like "eventName:contractAddress"');
  }
}

let host, port, protocol;
if (rpc) {
  protocol = rpc.split("://")[0];
  host = rpc.split("://")[1].split(":")[0];
  port = rpc.split("://")[1].split(":")[1] || "";
  if (!protocol || !host) {
    usage('Invalid node config recieved: ' + node + '\n Should be formatted like "protocol://host:port" (port is optional)')
  }
}

console.log('Connecting to database...');

Storage.start()
  .then(async () => {
    // Initialize RPC connection
    let rpc;
    try {
      if (!node) {
        if (!Config.default.chains[chain]) {
          console.error(`There is no RPC config for chain '${chain}'`);
          this.endProcess();
        }
        if (!Config.default.chains[chain][network]) {
          console.error(`There is no RPC config for chain '${chain}' with network '${network}'`);
          this.endProcess();
        }
        const rpcConfig = Config.default.chains[chain][network];
        const provider = rpcConfig.providers[0] ? rpcConfig.providers[0] : rpcConfig.provider;
        rpc = new CryptoRpc(
          {
            ...provider,
            chain
          },
          {}
        ).get(chain);
      } else {
        rpc = new CryptoRpc({
          host,
          port,
          protocol,
          chain
        })
      }

    } catch (err) {
      console.error('RPC could not be initialized', err);
      process.exit(1);
    }


    if (event) {
      // Get all events between blocks one segment at a time
      const batchSize = 1000;
      let start = startBlockHeight;
      let end = startBlockHeight + batchSize;
      let events = [];
      while (end < endBlockHeight) {
        console.log(`Fetching events between blocks ${start} and ${end}...`);
        const blockEvents = await rpc.getEvents(eventName, contractAddress, start, end);
        if (blockEvents.length === 0) {
          break;
        }
        events = events.concat(blockEvents);
        start += batchSize;
        if (end + batchSize > endBlockHeight) {
          if (end === endBlockHeight) {
            break;
          }
          end = endBlockHeight;
        } else {
          end += batchSize;
        }
      }
      // Iterate over all events and backfill/change/modify tx effects
      // TBD
    }
  })
  .catch(console.error)
  .finally(Storage.stop.bind(Storage));
