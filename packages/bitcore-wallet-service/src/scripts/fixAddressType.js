#!/usr/bin/env node
const config = require('../../ts_build/config').default;
const { Storage } = require('../../ts_build');
const { ObjectId } = require('mongodb');

if (!process.argv[2]) {
  console.log('Usage: fixAddressType.js <chain> [--doit]');
  process.exit(1);
}

const startDate = new Date('2022-10-05T00:00:00.000Z');
const endDate = new Date();

const chain = process.argv[2];
const doit = process.argv[3] === '--doit';

if (!['bch', 'doge'].includes(chain)) {
  console.log('Invalid chain');
  process.exit(1);
}

if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
  console.log('Invalid date');
  process.exit(1);
}

if (!doit) {
  console.log('Dry run');
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
    storage.disconnect(() => { console.log('done'); });
  }

  try {
    const walletStream = storage.db.collection(Storage.collections.WALLETS).find({
      _id: { $gte: ObjectId.createFromTime(startDate.getTime() / 1000), $lte: ObjectId.createFromTime(endDate.getTime() / 1000) },
      // chain: chain,
      // addressType: 'P2WPKH'
    });


    let fixCount = 0;
    let count = 0;
    for await (const wallet of walletStream) {
      count++;
      if (count % 100 === 0) {
        console.log(`Processed ${count} wallets`); // shows how fast things are working
      }
      if (wallet.chain !== chain && wallet.coin !== chain) {
        continue;
      }

      if (doit) {
        const res = await storage.db.collection(Storage.collections.ADDRESSES).updateMany({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 },
          type: 'P2WPKH'
        }, {
          $set: { type: 'P2PKH' }
        });

        if (wallet.addressType === 'P2WPKH') {
          await storage.db.collection(Storage.collections.WALLETS).updateOne({ _id: wallet._id }, { $set: { addressType: 'P2PKH' } });
          fixCount++;
        } else if (res?.result?.nModified > 0) {
          fixCount++;
        } else if (!res?.result?.ok) {
          console.log(JSON.stringify(res));
        }
      } else {
        const count = await storage.db.collection(Storage.collections.ADDRESSES).countDocuments({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 },
          type: 'P2WPKH'
        });
        fixCount += (count > 0 || wallet.addressType === 'P2WPKH') ? 1 : 0;
      }
      await new Promise(resolve => setTimeout(resolve, 80)); // sleep 80ms
    }

    console.log(`Fixed ${fixCount} wallets`);

    return done();
  } catch (err) {
    return done(err);
  }
});
