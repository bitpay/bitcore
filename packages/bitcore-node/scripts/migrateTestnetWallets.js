#!/usr/bin/env node

const { WalletStorage } = require('../build/src/models/wallet');
const { WalletAddressStorage } = require('../build/src/models/walletAddress');
const { Storage } = require('../build/src/services/storage');
const { wait } = require('../build/src/utils');

const chain = 'BTC';
const oldNetwork = 'testnet3';
const newNetwork = 'testnet4';
const dryRun = true; // make sure you stop sync services before running this script
const batchSize = 10000;

let quit = false;
process.on('SIGINT', () => {
  if (quit) {
    process.exit(1);
  }
  console.log('Caught interrupt signal');
  quit = true;
});

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
      wallets = await WalletStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray()
    }

    console.log(`Updating ${chain} ${oldNetwork} => ${newNetwork} walletAddresses in 10 seconds...`);
    !quit && await wait(10000);
    console.log(`Updating ${chain} ${oldNetwork} walletAddresses...`);
    let walletAddresses = await WalletAddressStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    let walletAddressesUpdated = 0;
    while (walletAddresses.length > 0 && !quit) {
      const res = await WalletAddressStorage.collection.updateMany({ _id: { $in: walletAddresses.map(c => c._id) } }, { $set: { network: newNetwork } });
      walletAddressesUpdated += res.modifiedCount;
      process.stdout.write(`Updated ${walletAddressesUpdated} walletAddresses (${(walletAddressesUpdated / cnt2 * 100).toFixed(2)}%)\r`);
      await wait(250);
      walletAddresses = await WalletAddressStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray()
    }
  })
  .catch(console.error)
  .finally(() => {
    console.log('Closing the database connection');
    Storage.stop();
  });
