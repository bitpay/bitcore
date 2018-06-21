const request = require('request-promise-native');
const bitcoreLib = require('bitcore-lib');
const secp256k1 = require('secp256k1');
const stream = require('stream');
const { URL } = require('url');

const Client = function (params) {
  Object.assign(this, params);
};

Client.prototype.sign = function (params) {
  const { method, url, payload = {} } = params;
  const parsedUrl = new URL(url);
  const message = [method, parsedUrl.pathname + parsedUrl.search, JSON.stringify(payload)].join('|');
  const privateKey = new bitcoreLib.PrivateKey(this.authKey).toBuffer();
  const messageHash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));
  return secp256k1.sign(messageHash, privateKey).signature.toString('hex');
};

Client.prototype.register = async function (params) {
  const { payload } = params;
  const url = `${this.baseUrl}/wallet`;
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
  const signature = this.sign({ method: 'GET', url, payload });
  return request.get(url, {
    headers: { 'x-signature': signature },
    body: payload,
    json: true
  });
};

Client.prototype.getAddressTxos = async function (params) {
  const { unspent, address } = params;
  const args = unspent ? `?unspent=${usnpent}` : ``;
  const url = `${this.baseUrl}/address/${address}${args}`;
  return request.get(url, {
    json: true
  });
}

Client.prototype.getCoins = async function (params) {
  const { payload, pubKey, includeSpent } = params;
  const url = `${this.baseUrl}/wallet/${pubKey}/utxos?includeSpent=${includeSpent}`;
  const signature = this.sign({ method: 'GET', url, payload });
  return request.get(url, {
    headers: { 'x-signature': signature },
    body: payload,
    json: true
  });
};

<<<<<<< HEAD
Client.prototype.importAddresses = async function (params) {
  const { addresses, payload, pubKey } = params;
=======
Client.prototype.importAddresses = async function(params) {
  const {  payload, pubKey } = params;
>>>>>>> 657f9c1a6bdfcb4a26bfd11c7ca9cfde158f20a5
  const url = `${this.baseUrl}/wallet/${pubKey}`;
  const signature = this.sign({ method: 'POST', url, payload});

  return new Promise((resolve) => {
    let dataStream = new stream.Readable({objectMode: true});
    dataStream.pipe(request.post(url, {
      headers: { 'x-signature': signature, 'content-type': 'application/octet-stream' }
    })).on('end', resolve);
    let jsonData = JSON.stringify(payload);
    dataStream.push(jsonData);
    dataStream.push(null);
  });
};

Client.prototype.broadcast = async function (params) {
  const { payload } = params;
  const url = `${this.baseUrl}/tx/send`;
  return request.post(url, { body: payload, json: true });
};

module.exports = Client;
