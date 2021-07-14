import requestStream from 'request';
import request from 'request-promise-native';
import * as secp256k1 from 'secp256k1';
import * as stream from 'stream';
import { URL } from 'url';
let usingBrowser = (global as any).window;
const URLClass = usingBrowser ? usingBrowser.URL : URL;
const bitcoreLib = require('crypto-wallet-core').BitcoreLib;

export class Client {
  apiUrl: string;
  authKey: any;
  constructor(params) {
    Object.assign(this, params);
  }

  getMessage(params: { method: string; url: string; payload?: any }) {
    const { method, url, payload = {} } = params;
    const parsedUrl = new URLClass(url);
    return [method, parsedUrl.pathname + parsedUrl.search, JSON.stringify(payload)].join('|');
  }

  sign(params: { method: string; url: string; payload?: any }) {
    const message = this.getMessage(params);
    const privateKey = this.authKey.toBuffer();
    const messageHash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));
    return secp256k1.sign(messageHash, privateKey).signature.toString('hex');
  }

  async register(params: { payload: { baseUrl?: string } & any }) {
    const { payload } = params;
    // allow you to overload the client's baseUrl
    const { baseUrl = this.apiUrl } = payload;
    const url = `${baseUrl}/wallet`;
    const signature = this.sign({ method: 'POST', url, payload });
    return request.post(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  async getToken(contractAddress) {
    const url = `${this.apiUrl}/token/${contractAddress}`;
    return request.get(url, { json: true });
  }

  async getBalance(params: { payload?: any; pubKey: string; time?: string }) {
    const { payload, pubKey, time } = params;
    let url = `${this.apiUrl}/wallet/${pubKey}/balance`;
    if (time) {
      url += `/${time}`;
    }
    if (payload && payload.tokenContractAddress) {
      url += `?tokenAddress=${payload.tokenContractAddress}`;
    }
    const signature = this.sign({ method: 'GET', url });
    return request.get(url, {
      headers: { 'x-signature': signature },
      json: true
    });
  }

  async getTransaction(params: { txid: string }) {
    const { txid } = params;
    let url = `${this.apiUrl}/tx/${txid}`;
    return request.get(url);
  }

  async getNonce(params) {
    const { address } = params;
    const url = `${this.apiUrl}/address/${address}/txs/count`;
    return request.get(url, { json: true });
  }

  getAddressTxos = async function(params) {
    const { unspent, address } = params;
    const args = unspent ? `?unspent=${unspent}` : '';
    const url = `${this.apiUrl}/address/${address}${args}`;
    return request.get(url, {
      json: true
    });
  };

  getCoins(params: { payload?: any; pubKey: string; includeSpent: boolean }) {
    const { payload, pubKey, includeSpent } = params;
    const url = `${this.apiUrl}/wallet/${pubKey}/utxos?includeSpent=${includeSpent}`;
    const signature = this.sign({ method: 'GET', url, payload });
    return requestStream.get(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  listTransactions(params) {
    const { pubKey, startBlock, startDate, endBlock, endDate, includeMempool, payload, tokenContractAddress } = params;
    let url = `${this.apiUrl}/wallet/${pubKey}/transactions`;
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
    if (tokenContractAddress) {
      query += `tokenAddress=${tokenContractAddress}`;
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
    const url = `${this.apiUrl}/fee/${target}`;
    return new Promise(resolve =>
      request
        .get(url, {
          json: true
        })
        .on('data', d => resolve(d))
    );
  }

  async importAddresses(params) {
    const { payload, pubKey } = params;
    const url = `${this.apiUrl}/wallet/${pubKey}`;
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
    const url = `${this.apiUrl}/tx/send`;
    return request.post(url, { body: payload, json: true });
  }

  async checkWallet(params) {
    const { pubKey } = params;
    const url = `${this.apiUrl}/wallet/${pubKey}/check`;
    const signature = this.sign({ method: 'GET', url });
    return request.get(url, {
      headers: { 'x-signature': signature },
      json: true
    });
  }

  getAddresses(params: { pubKey: string }) {
    const { pubKey } = params;
    const url = `${this.apiUrl}/wallet/${pubKey}/addresses`;
    const signature = this.sign({ method: 'GET', url });
    return request.get(url, {
      headers: { 'x-signature': signature },
      json: true
    });
  }
}
