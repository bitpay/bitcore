#!/usr/bin/env node

const config = require('../../ts_build/config').default;
const { Storage } = require('../../ts_build').default;
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });


let stop = false;
process.on('SIGINT', () => {
  stop = true;
});

function usage(errMsg) {
  console.log('USAGE: ./purgeNotifications.js <options>');
  console.log();
  console.log('OPTIONS:');
  console.log('  --walletId <value>      WalletId to purge notifications for. Often this is in the format `<chain>:<network>`');
  console.log('  --batchSize [value]     How many docs to delete at once. Default: 1000');
  console.log('  --doit                  Save the migration to the db');
  if (errMsg) {
    console.log();
    console.log('\nERROR: ' + errMsg);
  }
  process.exit();
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  usage();
}

const walletIdIdx = args.indexOf('--walletId');
const batchSizeIdx = args.indexOf('--batchSize');
const walletId = args[walletIdIdx + 1];
const batchSize = batchSizeIdx > -1 ? parseInt(args[batchSizeIdx + 1]) : 1000;
const doit = args.includes('--doit');

if (walletIdIdx === -1 || !walletId) {
  usage('Missing required --walletId');
}

if (batchSizeIdx > -1 && isNaN(batchSize)) {
  usage('Invalid batch size');
}

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
    if (err) { console.log(err) }
    rl.close();
    storage.disconnect(() => { console.log('done'); });
  }

  try {
    // Get all notifications
    const notiCnt = await storage.db.collection(Storage.collections.NOTIFICATIONS).count({ walletId });

    console.log(`Found ${Intl.NumberFormat().format(notiCnt)} total notifications for ${walletId} to delete`);
    const ans = await new Promise(r => rl.question(`Would you like to continue ${doit ? 'FOR REAL' : 'a dry run'}? (y/N): `, r));
    if (ans?.toLowerCase() !== 'y') {
      return done('Good bye.');
    }

    let count = 0;
    let notifications = [];
    const getNextPage = async () => storage.db.collection(Storage.collections.NOTIFICATIONS).find({ walletId }).skip(doit ? 0 : count).limit(batchSize).toArray();
    while ((notifications = await getNextPage()).length > 0 && !stop) {
      if (count % (batchSize * 10) === 0) {
        process.stdout.write(`Purged ${(count / notiCnt * 100).toFixed(4)}% notifications (${count})\r`); // shows how fast things are working
        await new Promise(resolve => setTimeout(resolve, 250)); // cooldown
      }

      const query = { _id: { $in: notifications.map(n => n._id) } };

      if (doit) {
        const res = await storage.db.collection(Storage.collections.NOTIFICATIONS).deleteMany(query);
        count += res.deletedCount;
      } else {
        // Update Wallets collection
        const notificationCount = await storage.db.collection(Storage.collections.NOTIFICATIONS).countDocuments(query);
        count += notificationCount;
      }
    }
    process.stdout.write('\n');

    console.log(`\u2713 Purged ${Intl.NumberFormat().format(count)} notifications`);
    stop && console.log('Stopped prematurely by user');

    return done();
  } catch (err) {
    return done(err);
  }
});
