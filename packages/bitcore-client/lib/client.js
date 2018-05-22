const request = require('request-promise-native');
const bitcoreLib = require('bitcore-lib');
const secp256k1 = require('secp256k1');
const { URL } = require('url');

const Client = function(params) {
  Object.assign(this, params);
};

Client.prototype.sign = function(params) {
  const { method, url, payload = {} } = params;
  const parsedUrl = new URL(url);
  const message = [method, parsedUrl.pathname + parsedUrl.search, JSON.stringify(payload)].join('|');
  const privateKey = new bitcoreLib.PrivateKey(this.authKey).toBuffer();
  const messageHash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));
  return secp256k1.sign(messageHash, privateKey).signature.toString('hex');
};

Client.prototype.register = async function(params) {
  const { payload } = params;
  const url = `${this.baseUrl}/wallet`;
  const signature = this.sign({ method: 'POST', url, payload });
  return request.post(url, {
    headers: { 'x-signature': signature },
    body: payload,
    json: true
  });
};

Client.prototype.getBalance = async function(params) {
  const { payload, pubKey } = params;
  const url = `${this.baseUrl}/wallet/${pubKey}/balance`;
  const signature = this.sign({ method: 'GET', url, payload });
  return request.get(url, {
    headers: { 'x-signature': signature },
    body: payload,
    json: true
  });
};

Client.prototype.getCoins = async function(params) {
  const { payload, pubKey, includeSpent } = params;
  const url = `${this.baseUrl}/wallet/${pubKey}/utxos?includeSpent=${includeSpent}`;
  const signature = this.sign({ method: 'GET', url, payload });
  return request.get(url, {
    headers: { 'x-signature': signature },
    body: payload,
    json: true
  });
};

Client.prototype.importAddresses = async function(params) {
  const { addresses, payload, pubKey } = params;
  const url = `${this.baseUrl}/wallet/${pubKey}`;
  const signature = this.sign({ method: 'POST', url, payload });
  return request.post(url, {
    headers: { 'x-signature': signature },
    body: payload,
    json: true
  });
};

Client.prototype.broadcast = async function(params) {
  const { payload } = params;
  const url = `${this.baseUrl}/tx/send`;
  return request.post(url, { body: payload, json: true });
};

module.exports = Client;
