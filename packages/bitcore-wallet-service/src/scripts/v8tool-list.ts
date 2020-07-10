#!/usr/bin/env node

var _ = require('lodash');
const request = require('request');
const Bitcore = require('bitcore-lib');
const requestStream = require('request');
import { Client } from '../lib//blockchainexplorers/v8/client';

const coin = process.argv[2];

if (!coin) {
  console.log(' Usage: coin authKey (extra: tokenAddress= )');
  process.exit(1);
}

const network = 'mainnet';
const authKey = process.argv[3];
const extra = process.argv[4] || '';
// tokenAddress=$

console.log('COIN:', coin);
if (!authKey) throw new Error('provide authKey');

// ====================
//
const authKeyObj = Bitcore.PrivateKey(authKey);

let tmp = authKeyObj.toObject();
tmp.compressed = false;
const pubKey = Bitcore.PrivateKey(tmp).toPublicKey();

const BASE = {
  BTC: `https://api.bitcore.io/api/${coin}/${network}`,
  BCH: `https://api.bitcore.io/api/${coin}/${network}`,
  ETH: `https://api-eth.bitcore.io/api/${coin}/${network}`,
  XRP: `https://api-xrp.bitcore.io/api/${coin}/${network}`
};

let baseUrl = BASE[coin];

let client = new Client({
  baseUrl,
  authKey: authKeyObj
});

// utxos
// addresses

// const url = `${baseUrl}/wallet/${pubKey}/${path}`;
let url = `${baseUrl}/wallet/${pubKey}/transactions?startBlock=0&includeMempool=true`;
if (extra) {
  url = url + '&' + extra;
}

console.log('[v8tool.37:url:]', url);
const signature = client.sign({ method: 'GET', url });
const payload = {};
var acum = '';

let r = requestStream.get(url, {
  headers: { 'x-signature': signature },
  json: true
});

r.on('data', raw => {
  acum = acum + raw.toString();
});

r.on('end', () => {
  let txs = [],
    unconf = [],
    err;
  _.each(acum.split(/\r?\n/), rawTx => {
    if (!rawTx) return;

    let tx;
    try {
      tx = JSON.parse(rawTx);
    } catch (e) {
      console.log('v8 error at JSON.parse:' + e + ' Parsing:' + rawTx + ':');
    }
    // v8 field name differences
    if (tx.value) tx.amount = tx.satoshis / 1e8;
    if (tx.abiType) tx.abiType = JSON.stringify(tx.abiType);

    if (tx.height >= 0) txs.push(tx);
    else unconf.push(tx);
  });
  console.log('txs', _.flatten(_.orderBy(unconf, 'blockTime', 'desc').concat(txs.reverse())));
});
