#!/usr/bin/env node

const request = require('request');
const Bitcore = require('bitcore-lib');
import { Client } from '../lib//blockchainexplorers/v8/client';

const coin = 'ETH';
console.log('COIN:', coin);
const network = 'mainnet';
const authKey = process.argv[2];
const path = process.argv[3] || 'addresses';
const extra = process.argv[4] ||  '';
  //tokenAddress=$

if (!authKey)
  throw new Error('provide authKey');

// ====================
//
const authKeyObj =  Bitcore.PrivateKey(authKey);

let tmp  = authKeyObj.toObject();
tmp.compressed = false;
const pubKey = Bitcore.PrivateKey(tmp).toPublicKey() ;
//let baseUrl = `https://api.bitcore.io/api/${coin}/${network}`;
let baseUrl = `https://api-eth.bitcore.io/api/${coin}/${network}`;
let client = new Client({
  baseUrl,
  authKey: authKeyObj,
});

// utxos
// addresses

let url = `${baseUrl}/wallet/${pubKey}/${path}`;
if (extra) {
  url = url + '?' + extra;
}

console.log('[v8tool.ts.38:url:]',url); // TODO
console.log('[v8tool.37:url:]', url);
const signature = client.sign({ method: 'GET', url });
const payload = {};

request.get(url, {
  headers: { 'x-signature': signature },
  body: payload,
  json: true
}, (err, req, body) => {
  if (err) {
    console.log('[v8tool.43:err:]', err);
  } else {
    try {
console.log('[v8tool.50:body:]', body);
    } catch (e) {
console.log('[v8tool.52]', e, body);
    }
  }
});
