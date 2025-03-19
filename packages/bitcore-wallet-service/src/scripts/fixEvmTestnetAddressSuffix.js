#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
const config = require('../../ts_build/config').default;
const { Storage } = require('../../ts_build');

function usage(errMsg) {
  console.log('Usage: fixEvmTestnetAddressSuffix.js <options>');
  console.log('OPTIONS:');
  console.log('  --chain <value>         REQUIRED - e.g. eth, matic...');
  console.log('  --suffix <value>        REQUIRED - The address suffix to change (e.g. testnet, goerli, sepolia...)')
  console.log('  --doit                  Save the migration to the db');
  console.log('  --out [value]           Output file (default: fixEvmTestnetAddressSuffix-<chain>-<suffix>-(timestamp).json)');
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
const suffixIdx = args.indexOf('--suffix');
const chain = args[chainIdx + 1]?.toLowerCase(); // address.chain/coin is lowercase
const suffix = args[suffixIdx + 1]?.toLowerCase();

if (chainIdx === -1 || !chain) {
  usage('Missing required param: --chain');
}

if (suffixIdx === -1 || !suffix) {
  usage('Missing required param: --suffix');
}

const outIdx = args.indexOf('--out');
let outFile = (outIdx > -1 && args[outIdx + 1]) || `fixEvmTestnetAddressSuffix-${chain}-${suffix}-${new Date().toISOString()}.json`;

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
    rl.close();
    storage.disconnect(() => { console.log('done'); });
  }

  const addyCount = await storage.db.collection(Storage.collections.ADDRESSES).countDocuments({
    coin: chain,
    address: { $regex: `\\\:${suffix}$`, $options: 'sm' }
  });

  console.log(`  ${doit ? 'REAL:' : 'DRY RUN:'} Found ${Intl.NumberFormat().format(addyCount)} total addresses to fix`);
  console.log(`  Output file: ${outFile}`);
  const ans = await new Promise(r => rl.question('Would you like to continue? (y/N): ', r));
  if (ans?.toLowerCase() !== 'y') {
    return done('Good bye.');
  }


  try {
    const stream = storage.db.collection(Storage.collections.ADDRESSES).find({
      coin: chain,
      address: { $regex: `\\\:${suffix}$`, $options: 'sm' }
    });

    // const explanation = await stream.explain();
    // console.log('explanation', JSON.stringify(explanation));

    let fixCount = 0;
    let count = 0;
    for await (const address of stream) {
      count++;
      if (count % 100 === 0) {
        console.log(`Processed ${(count / addyCount * 100).toFixed(4)}% addresses`); // shows how fast things are working
      }

      if (!address.network || address.address.slice(-(suffix.length + 1)) !== ':' + suffix) {
        console.log('Unexpected address doc', address);
        continue;
      }

      if (address.network === address.address.slice(-(suffix.length))) {
        console.log('Network and address suffix already match');
        continue;
      }

      fs.appendFileSync(outFile, `${address._id.toString()} :: ${address.network} :: ${address.address}\n`);

      if (doit) {
        const res = await storage.db.collection(Storage.collections.ADDRESSES).updateOne({
          _id: address._id,
        }, {
          $set: { address: address.address.replace(`:${suffix}`, ':' + address.network) }
        });

        if (res?.result?.nModified > 0) {
          fixCount++;
        } else if (!res?.result?.ok) {
          console.log(JSON.stringify(res));
        }
      } else {
        const count = await storage.db.collection(Storage.collections.ADDRESSES).countDocuments({
          _id: address._id,
        });
        fixCount += count;
      }

      await new Promise(resolve => setTimeout(resolve, 80)); // sleep 80ms
    }

    console.log(`Fixed ${fixCount} addresses`);

    return done();
  } catch (err) {
    return done(err);
  }
});
