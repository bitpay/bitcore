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
  fs.readdir(path, function (err, folder) {
    if (err) {
      console.error(err);
      return;
    }
    console.log(folder);
  });
}

main();
