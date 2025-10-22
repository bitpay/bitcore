#!/usr/bin/env node

const { BitcoinBlockStorage } = require('../build/src/models/block');
const { CoinStorage } = require('../build/src/models/coin');
const { TransactionStorage } = require('../build/src/models/transaction');
const { WalletStorage } = require('../build/src/models/wallet');
const { WalletAddressStorage } = require('../build/src/models/walletAddress');
const { Storage } = require('../build/src/services/storage');
const { wait } = require('../build/src/utils');

const chain = 'LTC';
const oldNetwork = 'testnet';
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

    const cnt1 = await CoinStorage.collection.countDocuments({ chain, network: oldNetwork });
    const cnt2 = await TransactionStorage.collection.countDocuments({ chain, network: oldNetwork });
    const cnt3 = await BitcoinBlockStorage.collection.countDocuments({ chain, network: oldNetwork });
    const cnt4 = await WalletStorage.collection.countDocuments({ chain, network: oldNetwork });
    const cnt5 = await WalletAddressStorage.collection.countDocuments({ chain, network: oldNetwork });

    console.log(`${chain} ${oldNetwork} coins:`, cnt1);
    console.log(`${chain} ${oldNetwork} transactions:`, cnt2);
    console.log(`${chain} ${oldNetwork} blocks:`, cnt3);
    console.log(`${chain} ${oldNetwork} wallets:`, cnt4);
    console.log(`${chain} ${oldNetwork} walletAddresses:`, cnt5);

    if (dryRun) {
      return;
    }
    console.log('----------------------------------------');

    console.log(`Updating ${chain} ${oldNetwork} => ${newNetwork} coins in 10 seconds...`);
    !quit && await wait(10000);
    console.log(`Updating ${chain} ${oldNetwork} coins...`);
    let coins = await CoinStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    let coinsUpdated = 0;
    while (coins.length > 0 && !quit) {
      const res = await CoinStorage.collection.updateMany({ _id: { $in: coins.map(c => c._id) } }, { $set: { network: newNetwork } });
      coinsUpdated += res.modifiedCount;
      console.log(`Updated ${coinsUpdated} coins (${(coinsUpdated / cnt1 * 100).toFixed(2)}%)`);
      await wait(250);
      coins = await CoinStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    }

    console.log(`Updating ${chain} ${oldNetwork} => ${newNetwork} transactions in 10 seconds...`);
    !quit && await wait(10000);
    console.log(`Updating ${chain} ${oldNetwork} transactions...`);
    let txs = await TransactionStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    let txsUpdated = 0;
    while (txs.length > 0 && !quit) {
      const res = await TransactionStorage.collection.updateMany({ _id: { $in: txs.map(c => c._id) } }, { $set: { network: newNetwork } });
      txsUpdated += res.modifiedCount;
      console.log(`Updated ${txsUpdated} transactions (${(txsUpdated / cnt2 * 100).toFixed(2)}%)`);
      await wait(250);
      txs = await TransactionStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    }
    
    console.log(`Updating ${chain} ${oldNetwork} => ${newNetwork} blocks in 10 seconds...`);
    !quit && await wait(10000);
    console.log(`Updating ${chain} ${oldNetwork} blocks...`);
    let blocks = await BitcoinBlockStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    let blocksUpdated = 0;
    while (blocks.length > 0 && !quit) {
      const res = await BitcoinBlockStorage.collection.updateMany({ _id: { $in: blocks.map(c => c._id) } }, { $set: { network: newNetwork } });
      blocksUpdated += res.modifiedCount;
      console.log(`Updated ${blocksUpdated} blocks (${(blocksUpdated / cnt3 * 100).toFixed(2)}%)`);
      await wait(250);
      blocks = await BitcoinBlockStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    }

    console.log(`Updating ${chain} ${oldNetwork} => ${newNetwork} wallets in 10 seconds...`);
    !quit && await wait(10000);
    console.log(`Updating ${chain} ${oldNetwork} wallets...`);
    let wallets = await WalletStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    let walletsUpdated = 0;
    while (wallets.length > 0 && !quit) {
      const res = await WalletStorage.collection.updateMany({ _id: { $in: wallets.map(c => c._id) } }, { $set: { network: newNetwork } });
      walletsUpdated += res.modifiedCount;
      console.log(`Updated ${walletsUpdated} wallets (${(walletsUpdated / cnt4 * 100).toFixed(2)}%)`);
      await wait(250);
      wallets = await WalletStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    }

    console.log(`Updating ${chain} ${oldNetwork} => ${newNetwork} walletAddresses in 10 seconds...`);
    !quit && await wait(10000);
    console.log(`Updating ${chain} ${oldNetwork} walletAddresses...`);
    let walletAddresses = await WalletAddressStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    let walletAddressesUpdated = 0;
    while (walletAddresses.length > 0 && !quit) {
      const res = await WalletAddressStorage.collection.updateMany({ _id: { $in: walletAddresses.map(c => c._id) } }, { $set: { network: newNetwork } });
      walletAddressesUpdated += res.modifiedCount;
      console.log(`Updated ${walletAddressesUpdated} walletAddresses (${(walletAddressesUpdated / cnt5 * 100).toFixed(2)}%)`);
      await wait(250);
      walletAddresses = await WalletAddressStorage.collection.find({ chain, network: oldNetwork }).project({ _id: 1 }).limit(batchSize).toArray();
    }
  })
  .catch(console.error)
  .finally(() => {
    console.log('Closing the database connection');
    Storage.stop();
  });
