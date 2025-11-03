#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import readline from 'readline';
import config from '../ts_build/src/config';
import { Storage } from '../ts_build/src/lib/storage';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const startDate = new Date('2011-01-01T00:00:00.000Z');
const endDate = new Date();

function usage(errMsg) {
  console.log('USAGE: ./migrateWalletsNetwork.js [options]');
  console.log('OPTIONS:');
  console.log('  --chain <value>         REQUIRED - e.g. BTC, BCH, DOGE, LTC...');
  console.log('  --oldNetwork <value>    REQUIRED - e.g. testnet3');
  console.log('  --newNetwork <value>    REQUIRED - e.g. testnet4');
  console.log('  --doit                  Save the migration to the db');
  console.log('  --out <value>           Output file (default: <chain>-<oldNetwork>-<newNetwork>-migrate.json)');
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
const oldNetworkIdx = args.indexOf('--oldNetwork');
const newNetworkIdx = args.indexOf('--newNetwork');
const chain = args[chainIdx + 1]?.toLowerCase(); // wallet.chain/coin is lowercase
const oldNetwork = args[oldNetworkIdx + 1]?.toLowerCase();
const newNetwork = args[newNetworkIdx + 1]?.toLowerCase();

if (
  chainIdx === -1 ||
  oldNetworkIdx === -1 ||
  newNetworkIdx === -1 ||
  !chain ||
  !oldNetwork ||
  !newNetwork
) {
  usage('Missing required options.');
}

const outIdx = args.indexOf('--out');
let outFile = (outIdx > -1 && args[outIdx + 1]) || `${chain}-${oldNetwork}-${newNetwork}-migrate.json`;

if (outFile.startsWith('~')) {
  outFile = outFile.replace('~', os.homedir());
}
if (outFile.startsWith('$HOME')) {
  outFile = outFile.replace('$HOME', os.homedir());
}
if (!outFile.startsWith('/') && !outFile.startsWith('./') && !outFile.startsWith('../')) {
  outFile = __dirname + '/' + outFile;
}

const doit = args.includes('--doit');

if (!doit) {
  console.log('Dry run (pass --doit to actually do it)');
} else {
  console.log('LET\'S DO IT FOR REAL');
}

const storage = new Storage();
storage.connect(config.storageOpts, async (err) => {
  if (err) {
    console.log(err);
    return;
  }
  
  function done(err) {
    if (err) { console.log(err); }
    rl.close();
    storage.disconnect(() => { console.log('done'); });
  }

  try {
    // Get all wallets
    const walletCnt = await storage.db.collection(Storage.collections.WALLETS).count({});
    const walletStream = storage.db.collection(Storage.collections.WALLETS).find({});

    let fixAddressCount = 0;
    let fixWalletsCount = 0;
    let fixTxsCount = 0;
    let count = 0;

    console.log(`  ${doit ? 'REAL:' : 'DRY RUN:'} Found ${Intl.NumberFormat().format(walletCnt)} total wallets to scan`);
    console.log(`  Migrating ${chain}:${oldNetwork}->${newNetwork}`);
    console.log(`  Output file: ${outFile}`);
    const ans = await new Promise(r => rl.question('Would you like to continue? (y/N): ', r));
    if (ans?.toLowerCase() !== 'y') {
      return done('Good bye.');
    }

    for await (const wallet of walletStream) {
      count++;
      if (count % 100 === 0) {
        process.stdout.write(`Processed ${(count / walletCnt * 100).toFixed(4)}% wallets (${count}) - fixed ${fixWalletsCount}\r`); // shows how fast things are working
        await new Promise(resolve => setTimeout(resolve, 250)); // cooldown
      }
      // if wallet chain is not covered or if network isn't testnet then skip
      if (wallet.chain !== chain || (!wallet.chain && wallet.coin !== chain) || wallet.network !== oldNetwork) {
        continue;
      }

      fs.appendFileSync(outFile, wallet.id + '\n');

      if (doit) {
        // Update Wallets collection
        const resWallet = await storage.db.collection(Storage.collections.WALLETS).updateMany({
          id: wallet.id,
          network: oldNetwork
        }, {
          $set: { network: newNetwork }
        });

        if (resWallet?.result?.nModified > 0) {
          fixWalletsCount++;
        } else if (!resWallet?.result?.ok) {
          console.log(JSON.stringify(resWallet));
        }

        // Update Addresses collection
        const resAddress = await storage.db.collection(Storage.collections.ADDRESSES).updateMany({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 }, // Included only to use index
          network: oldNetwork
        }, {
          $set: { network: newNetwork }
        });

        if (resAddress?.result?.nModified > 0) {
          fixAddressCount++;
        } else if (!resAddress?.result?.ok) {
          console.log(JSON.stringify(resAddress));
        }

        // Delete Txs for old network
        const resTxs = await storage.db.collection(Storage.collections.TXS).deleteMany({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 }, // Included only to use index
          network: oldNetwork
        });

        if (resTxs?.result?.n > 0) {
          fixTxsCount++;
        } else if (!resTxs?.result?.ok) {
          console.log(JSON.stringify(resTxs));
        }

        const resCache = await storage.db.collection(Storage.collections.CACHE).deleteMany({
          walletId: wallet.id
        });
        if (!resCache?.result?.ok) {
          console.log(JSON.stringify(resTxs));
        }
      } else {
        // Update Wallets collection
        const walletCount = await storage.db.collection(Storage.collections.WALLETS).countDocuments({
          id: wallet.id,
          network: oldNetwork
        });

        fixWalletsCount += walletCount;

        // Update Addresses collection
        const addressCount = await storage.db.collection(Storage.collections.ADDRESSES).countDocuments({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 }, // Included only to use index
          network: oldNetwork
        });

        fixAddressCount += addressCount;

        // Delete Txs collection
        const txsCount = await storage.db.collection(Storage.collections.TXS).countDocuments({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 }, // Included only to use index
          network: oldNetwork
        });

        fixTxsCount += txsCount;
      }
    }
    process.stdout.write('\n');

    console.log(`Fixed ${fixWalletsCount} wallets`);
    console.log(`Fixed ${fixAddressCount} Addresses`);
    console.log(`Fixed ${fixTxsCount} Txs`);

    return done();
  } catch (err) {
    return done(err);
  }
});
