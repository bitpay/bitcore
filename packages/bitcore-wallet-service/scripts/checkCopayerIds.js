#!/usr/bin/env node

const config = require('../../ts_build/src/config').default;
const { Storage } = require('../../ts_build/src').default;
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
const fs = require('fs');
const os = require('os');
const CWC = require('crypto-wallet-core');

const startDate = new Date('2011-01-01T00:00:00.000Z');
const endDate = new Date();

function usage(errMsg) {
  console.log('USAGE: ./checkCopayerIds.js [options]');
  console.log('OPTIONS:');
  console.log('  --out <value>           Output file (default: copayerid-mismatches.json)');
  if (errMsg) {
    console.log('\nERROR: ' + errMsg);
  }
  process.exit();
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  usage();
}

const outIdx = args.indexOf('--out');
let outFile = (outIdx > -1 && args[outIdx + 1]) || 'copayerid-mismatches.json';

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
    if (err) { console.log(err) }
    rl.close();
    storage.disconnect(() => { console.log('done'); });
  }

  try {
    // Get all wallets
    const walletCnt = await storage.db.collection(Storage.collections.WALLETS).count({});
    const walletStream = storage.db.collection(Storage.collections.WALLETS).find({});

    let count = 0;
    let mismatches = 0;
    let missing = 0;

    console.log(`  ${doit ? 'REAL:' : 'DRY RUN:'} Found ${Intl.NumberFormat().format(walletCnt)} total wallets to scan`);
    console.log(`  Output file: ${outFile}`);
    const ans = await new Promise(r => rl.question('Would you like to continue? (y/N): ', r));
    if (ans?.toLowerCase() !== 'y') {
      return done('Good bye.');
    }

    for await (const wallet of walletStream) {
      count++;
      if (count % 100 === 0) {
        process.stdout.write(`Processed ${(count / walletCnt * 100).toFixed(4)}% wallets (${count}) - found mismatches ${mismatches}\r`); // shows how fast things are working
        await new Promise(resolve => setTimeout(resolve, 250)); // cooldown
      }

      if (!wallet.copayers?.length) {
        if (wallet.status !== 'pending') {
          missing++;
          fs.appendFileSync(outFile + '-missing', `${wallet.id}:${wallet.status}\n`);
        }
        continue; // no copayers, nothing to check
      }

      const chain = wallet.chain || wallet.coin || 'btc';

      for (const copayer of wallet.copayers) {
        const copayerId = copayer.id;
        const xpub = copayer.xPubKey;
        const str = chain === 'btc' ? xpub : (chain + xpub);
        
        const hash = CWC.BitcoreLib.crypto.Hash.sha256(Buffer.from(str));
        const computed =  hash.toString('hex');
        if (copayerId !== computed) {
          mismatches++;
          fs.appendFileSync(outFile, `${wallet.id}:${copayerId} -> expected: ${computed}\n`);
        }
      }
    }
    process.stdout.write('\n');

    console.log(`Found ${mismatches} mismatching copayerIds`);
    console.log(`Found ${missing} missing copayerIds`);

    return done();
  } catch (err) {
    return done(err);
  }
});
