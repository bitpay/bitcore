#!/usr/bin/env node
'use strict';

const { Transform } = require('stream');
const { Storage } = require('../ts_build/storage');
const { Wallet } = require('../ts_build/wallet');
const program = require('../ts_build/program');

program
  .version(require('../package.json').version)
  .option('--path [path]', 'optional - Where wallets are stored')
  .option('--chain [chain]', 'Chain to get balances from')
  .option('--network [network]', 'Network to get balances from')
  .option('--name [name]', 'regex matching wallet name')
  .option('--time [time]', 'optional - Get balance at specific time')
  .parse(process.argv);

const { path, chain, network, time, name: regex } = program;
const regExp = new RegExp(regex);

const parser = new Transform({
  writableObjectMode: false,
  readableObjectMode: true,
  transform(chunk, encoding, callback) {
    try {
      const wallet = JSON.parse(chunk.toString());
      callback(null, wallet);
    } catch (e) {
      callback(e);
    }
  }
});

const filterStream = new Transform({
  objectMode: true,
  transform(wallet, encoding, callback) {
    const { name, chain: walletChain, network: walletNetwork } = wallet;
    if (chain && walletChain !== chain) {
      return callback();
    }
    if (network && walletNetwork !== network) {
      return callback();
    }
    if (regExp && !regExp.test(name)) {
      return callback();
    }
    return callback(null, { name, chain: walletChain, network: walletNetwork });
  }
});

const getBalance = new Transform({
  writableObjectMode: true,
  readableObjectMode: false,
  transform (wallet, encoding, callback) {
    const { name, chain, network } = wallet;
    Wallet.loadWallet({ name, path })
      .then(wallet => wallet.getBalance(time))
      .then(balance => {
        const { confirmed } = balance;
        callback(null, `${name}: ${confirmed / 1e8} ${chain} (${network})\n`);
      })
      .catch(err => callback(err));
  }
});

const storage = new Storage({createIfMissing: false, errorIfExists: false, path});
storage.listWallets()
  .pipe(parser)
  .on('error', err => console.log(err))
  .pipe(filterStream)
  .pipe(getBalance)
  .on('error', err => console.log(err))
  .pipe(process.stdout);
