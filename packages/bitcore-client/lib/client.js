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
  const privateKey = this.authKey.toBuffer();
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

Client.prototype.listTransactions = async function(params) {
  const getTransactions = ({pubKey, startDate, endDate, since}) => {
    let url = `${this.baseUrl}/wallet/${pubKey}/transactions?startDate=${startDate}&endDate=${endDate}&paging=_id&limit=1000`;
    if(since) {
      url += `&since=${since}`;
    }
    const signature = this.sign({ method: 'GET', url});
    return request.get(url, {
      headers: { 'x-signature': signature },
      json: true
    });
  };

  let totalResults = [];
  let since = '';
  let splitResults = null;
  do {
    try {
      let results = await getTransactions({...params, since });
      if(!results) {
        throw new Error('No more results');
      }
      splitResults = results.split('\n').filter(r => r!= '');
      totalResults = totalResults.concat(splitResults);
      const last = JSON.parse(splitResults[splitResults.length - 1]);
      since = last.id;
    } catch (e) {
      splitResults = null;
    }
  }
  while(splitResults && splitResults != []);
  return totalResults;
};

Client.prototype.getFee = async function (params) {
  const { target } = params;
  const url = `${this.baseUrl}/fee/${target}`;
  return request.get(url, {
    json: true
  });
};

Client.prototype.importAddresses = async function(params) {
  const { payload, pubKey } = params;
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
