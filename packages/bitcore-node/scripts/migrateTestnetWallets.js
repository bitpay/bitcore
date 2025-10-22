#!/usr/bin/env node

const { WalletStorage } = require('../build/src/models/wallet');
const { WalletAddressStorage } = require('../build/src/models/walletAddress');
const { Storage } = require('../build/src/services/storage');
const { wait } = require('../build/src/utils');

function usage(errMsg) {
  console.log('USAGE: ./migrateTestnetWallets.js [options]');
  console.log('OPTIONS:');
  console.log('  --chain <value>         REQUIRED - e.g. BTC, BCH, DOGE, LTC...');
  console.log('  --oldNetwork <value>    REQUIRED - e.g. testnet3');
  console.log('  --newNetwork <value>    REQUIRED - e.g. testnet4');
  console.log('  --batchSize <value>     Number of documents to update at a time. Default: 10000');
  console.log('  --deDup                 Delete duplicate walletAddresses (dups can happen if an updated wallet is queried before addresses are updated)');
  console.log('  --doit                  Save the migration to the db. Make sure you stop sync services before running this script');
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
const chain = args[chainIdx + 1]?.toUpperCase();
const oldNetwork = args[oldNetworkIdx + 1]?.toLowerCase();
const newNetwork = args[newNetworkIdx + 1]?.toLowerCase();
const deDup = args.includes('--deDup');
const dryRun = !args.includes('--doit');

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

const batchSizeIdx = args.indexOf('--batchSize');
const batchSize = (batchSizeIdx > -1 && parseInt(args[batchSizeIdx + 1])) || 10000;
if (batchSize > -1 && isNaN(parseInt(args[batchSizeIdx + 1]))) {
  usage('batchSize must be an integer');
}


let quit = false;
process.on('SIGINT', () => {
  if (quit) {
    process.exit(1);
  }
  console.log('Caught interrupt signal');
  quit = true;
});

async function deleteOldAddress(e) {
  let [_, c, n, w, a] = e.message.split('{')[1].split(':');
  c = c.trim().replace(/"/g, '').replace(/,/g, '');
  n = n.trim().replace(/"/g, '').replace(/,/g, '');
  w = w.trim().replace('ObjectId(', '').replace(')', '').replace(/'/g, '').replace(/,/g, '');
  a = a.replace('}', '').trim().replace(/"/g, '').replace(/,/g, '');
  console.log('Deleting dup:', c, n, w, a);
  const del1 = await WalletAddressStorage.collection.findOne({ chain, network: oldNetwork, wallet: new ObjectID(w), address: a });
  const del2 = await WalletAddressStorage.collection.findOne({ chain, network: newNetwork, wallet: new ObjectID(w), address: a });
  console.log(del1);
  console.log(del2);
  if (!!del1 && !!del2) {
    const del = await WalletAddressStorage.collection.deleteOne({ chain, network: oldNetwork, wallet: new ObjectID(w), address: a });
    console.log(del.deletedCount);
  }
};

Storage.start()
  .then(async () => {
    console.log('Connected to the database');

    const cnt1 = await WalletStorage.collection.countDocuments({ chain, network: oldNetwork });
    const cnt2 = await WalletAddressStorage.collection.countDocuments({ chain, network: oldNetwork });

    console.log(`${chain} ${oldNetwork} wallets:`, cnt1);
    console.log(`${chain} ${oldNetwork} walletAddresses:`, cnt2);

    if (dryRun) {
      return;
    }
    console.log('----------------------------------------');

    console.log(`Updating ${chain} ${oldNetwork} => ${newNetwork} wallets in 10 seconds...`);
    !quit && await wait(10000);
    console.log(`Updating ${chain} ${oldNetwork} wallets...`);
    let wallets = await WalletStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    let walletsUpdated = 0;
    while (wallets.length > 0 && !quit) {
      const res = await WalletStorage.collection.updateMany({ _id: { $in: wallets.map(c => c._id) } }, { $set: { network: newNetwork } });
      walletsUpdated += res.modifiedCount;
      process.stdout.write(`Updated ${walletsUpdated} wallets (${(walletsUpdated / cnt1 * 100).toFixed(2)}%)\r`);
      await wait(250);
      wallets = await WalletStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    }

    console.log(`Updating ${chain} ${oldNetwork} => ${newNetwork} walletAddresses in 10 seconds...`);
    !quit && await wait(10000);
    console.log(`Updating ${chain} ${oldNetwork} walletAddresses...`);
    let walletAddresses = await WalletAddressStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    let walletAddressesUpdated = 0;
    while (walletAddresses.length > 0 && !quit) {
      try {
        const res = await WalletAddressStorage.collection.updateMany({ _id: { $in: walletAddresses.map(c => c._id) } }, { $set: { network: newNetwork } });
        walletAddressesUpdated += res.modifiedCount;
      } catch (e) {
        if (e.message.includes('E11000') && deDup) {
          await deleteOldAddress(e);
        } else { throw e; }
      }
      process.stdout.write(`Updated ${walletAddressesUpdated} walletAddresses (${(walletAddressesUpdated / cnt2 * 100).toFixed(2)}%)\r`);
      await wait(250);
      walletAddresses = await WalletAddressStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    }
  })
  .catch(console.error)
  .finally(() => {
    console.log('Closing the database connection');
    Storage.stop();
  });
