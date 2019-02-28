import request from 'request-promise-native';
import requestStream from 'request';
import * as secp256k1 from 'secp256k1';
import * as stream from 'stream';
import { URL } from 'url';
let usingBrowser = (global as any).window;
const URLClass = usingBrowser ? usingBrowser.URL : URL;
const bitcoreLib = require('bitcore-lib');

export class Client {
  baseUrl: string;
  authKey: any;
  constructor(params) {
    Object.assign(this, params);
  }

  sign(params) {
    const { method, url, payload = {} } = params;
    const parsedUrl = new URLClass(url);
    const message = [
      method,
      parsedUrl.pathname + parsedUrl.search,
      JSON.stringify(payload)
    ].join('|');
    const privateKey = this.authKey.toBuffer();
    const messageHash = bitcoreLib.crypto.Hash.sha256sha256(
      Buffer.from(message)
    );
    return secp256k1.sign(messageHash, privateKey).signature.toString('hex');
  }

  async register(params) {
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
  }

  async getBalance(params: { payload?: any; pubKey: string; time?: string }) {
    const { payload, pubKey, time } = params;
    let url = `${this.baseUrl}/wallet/${pubKey}/balance`;
    if (time) {
      url += `/${time}`;
    }
    const signature = this.sign({ method: 'GET', url, payload });
    return request.get(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  getAddressTxos = async function(params) {
    const { unspent, address } = params;
    const args = unspent ? `?unspent=${unspent}` : '';
    const url = `${this.baseUrl}/address/${address}${args}`;
    return request.get(url, {
      json: true
    });
  };

  getCoins(params: { payload?: any; pubKey: string; includeSpent: boolean }) {
    const { payload, pubKey, includeSpent } = params;
    const url = `${
      this.baseUrl
    }/wallet/${pubKey}/utxos?includeSpent=${includeSpent}`;
    const signature = this.sign({ method: 'GET', url, payload });
    return requestStream.get(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  listTransactions(params) {
    const {
      pubKey,
      startBlock,
      startDate,
      endBlock,
      endDate,
      includeMempool,
      payload
    } = params;
    let url = `${this.baseUrl}/wallet/${pubKey}/transactions`;
    let query = '';
    if (startBlock) {
      query += `startBlock=${startBlock}&`;
    }
    if (endBlock) {
      query += `endBlock=${endBlock}&`;
    }
    if (startDate) {
      query += `startDate=${startDate}&`;
    }
    if (endDate) {
      query += `endDate=${endDate}&`;
    }
    if (includeMempool) {
      query += 'includeMempool=true';
    }
    if (query) {
      url += '?' + query;
    }
    const signature = this.sign({ method: 'GET', url, payload });
    return requestStream.get(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  async getFee(params) {
    const { target } = params;
    const url = `${this.baseUrl}/fee/${target}`;
    return new Promise(resolve =>
      request
        .get(url, {
          json: true
        })
        .on('data', d => resolve(d.toString()))
    );
  }

  async importAddresses(params) {
    const { payload, pubKey } = params;
    const url = `${this.baseUrl}/wallet/${pubKey}`;
    const signature = this.sign({ method: 'POST', url, payload });

    return new Promise(resolve => {
      let dataStream = new stream.Readable({ objectMode: true });
      dataStream
        .pipe(
          request.post(url, {
            headers: {
              'x-signature': signature,
              'content-type': 'application/octet-stream'
            }
          })
        )
        .on('end', resolve);
      let jsonData = JSON.stringify(payload);
      dataStream.push(jsonData);
      dataStream.push(null);
    });
  }

  async broadcast(params) {
    const { payload } = params;
    const url = `${this.baseUrl}/tx/send`;
    return request.post(url, { body: payload, json: true });
  }

  async checkWallet(params) {
    const { pubKey } = params;
    const url = `${this.baseUrl}/wallet/${pubKey}/check`;
    const signature = this.sign({ method: 'GET', url });
    return request.get(url, {
      headers: { 'x-signature': signature },
      json: true
    });
  }

  getAddresses(params: { pubKey: string }) {
    const { pubKey } = params;
    const url = `${this.baseUrl}/wallet/${pubKey}/addresses`;
    const signature = this.sign({ method: 'GET', url });
    return request.get(url, {
      headers: { 'x-signature': signature },
      json: true
    });
  }
}
