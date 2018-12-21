
const request = require('request-promise-native');
const bitcoreLib = require('bitcore-lib');
const secp256k1 = require('secp256k1');
const stream = require('stream');
const requestStream = require('request');
const { URL } = require('url');

const Client = function (params) {
  Object.assign(this, params);
};

Client.prototype.sign = function (params) {
  const { method, url, payload = {} } = params;
  const parsedUrl = new URL(url);
  const message = [method, parsedUrl.pathname + parsedUrl.search, JSON.stringify(payload)].join('|');
  const privateKey = this.authKey.bn.toBuffer({ size: 32 });
  const messageHash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));

  return secp256k1.sign(messageHash, privateKey).signature.toString('hex');
};

Client.prototype.register = async function (params) {
  const { payload } = params;
  // allow you to overload the client's baseUrl
  const { baseUrl = this.baseUrl } = payload;
  const url = `${baseUrl}/wallet`;
  const signature = this.sign({ method: 'POST', url, payload });
  return request.post(url, {
    headers: { 'x-signature': signature },
    body: payload,
    json: true
  });
};

Client.prototype.getBalance = async function (params) {
  const { payload, pubKey } = params;
  const url = `${this.baseUrl}/wallet/${pubKey}/balance`;
console.log('[client.js.37:url:]',url); //TODO
  const signature = this.sign({ method: 'GET', url, payload });
  return request.get(url, {
    headers: { 'x-signature': signature },
    body: payload,
    json: true
  });
};

Client.prototype.getAddressTxos = async function (params) {
  const { unspent, address } = params;
  const args = unspent ? `?unspent=${unspent}` : '';
  const url = `${this.baseUrl}/address/${address}${args}`;
  return request.get(url, {
    json: true
  });
};

Client.prototype.getTx = async function (params) {
  const { txid } = params;
  const url = `${this.baseUrl}/tx/${txid}`;
console.log('[client.js.59:url:]',url); //TODO
  return request.get(url, {
    json: true
  });
};



Client.prototype.getCoins = async function (params) {
  const { payload, pubKey, includeSpent } = params;

  var extra ='';
  if (includeSpent) {
    extra = `?includeSpent=${includeSpent}`;
  }
  const url = `${this.baseUrl}/wallet/${pubKey}/utxos${extra}`;
  console.log('[client.js.74:url:]',url); //TODO
  const signature = this.sign({ method: 'GET', url, payload });
  return request.get(url, {
    headers: { 'x-signature': signature },
    body: payload,
    json: true
  });
};

Client.prototype.listTransactions = function(params) {
  const { pubKey, startBlock, startDate, endBlock, endDate, includeMempool } = params;
  let url = `${this.baseUrl}/wallet/${pubKey}/transactions?`;
  if (startBlock) {
    url += `startBlock=${startBlock}&`;
  }
  if (endBlock) {
    url += `endBlock=${endBlock}&`;
  }
  if (includeMempool) {
    url += 'includeMempool=true';
  }
  const signature = this.sign({ method: 'GET', url });
  console.log('[client.js.96:url:]',url); //TODO
  return requestStream.get(url, {
    headers: { 'x-signature': signature },
    json: true
  });
};

Client.prototype.importAddresses = async function(params) {
  const { payload, pubKey } = params;
  const url = `${this.baseUrl}/wallet/${pubKey}`;

  console.log('add addresses:',url); //TODO
  const signature = this.sign({ method: 'POST', url, payload});
  let h = { 'x-signature': signature};
  return request.post(url, {
    headers: h,
    body: payload,
    json: true
  });
};



Client.prototype.broadcast = async function (params) {
  const { payload } = params;
  const url = `${this.baseUrl}/tx/send`;
console.log('[client.js.113:url:]',url); //TODO
  return request.post(url, { body: payload, json: true });
};

module.exports = Client;
