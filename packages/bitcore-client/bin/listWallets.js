'use strict';

const fs = require('fs');
const config = require('../lib/config');
const program = require('commander');

program
  .version(require('../package.json').version)
  .option('--path <path>', 'REQUIRED - Where wallet is stored')
  .parse(process.argv);

const main = async () => {
  const path = program.path;
  const walletsInPath = config.wallets.filter(wallet => wallet.path === path);
  fs.readdir(path, (err, files) => {
    if (err) {
      return console.error(err);
    }
    const matchingWallets = walletsInPath.filter(wallet => files.includes(wallet));
    console.log(matchingWallets);
  });
}

main();
