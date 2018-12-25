import request from 'request-promise-native';
import requestStream from 'request';
import * as secp256k1 from 'secp256k1';
import * as stream from 'stream';
import { URL } from 'url';
const bitcoreLib = require('bitcore-lib');

export class Client {
  baseUrl: string;
  authKey: any;
  constructor(params) {
    Object.assign(this, params);
  }

  getUrl(payload: { chain; network; baseUrl?: string }) {
    const { baseUrl = this.baseUrl, chain, network } = payload;
    return `${baseUrl}/${chain}/${network}`;
  }

  sign(params) {
    const { method, url, payload = {} } = params;
    const parsedUrl = new URL(url);
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

  async register(params: { chain: string; network: string; baseUrl: string }) {
    // allow you to overload the client's baseUrl
    const { baseUrl = this.baseUrl, chain, network } = params;
    const url = `${this.getUrl(params)}/wallet`;
    const signature = this.sign({ method: 'POST', url, payload: '' });
    return request.post(url, {
      headers: { 'x-signature': signature },
      body: '',
      json: true
    });
  }

  async getBalance(params: { pubKey: string; chain: string; network: string }) {
    const { pubKey } = params;
    const url = `${this.getUrl(params)}/wallet/${pubKey}/balance`;
    const signature = this.sign({ method: 'GET', url, payload: '' });
    return request.get(url, {
      headers: { 'x-signature': signature },
      body: '',
      json: true
    });
  }

  getAddressTxos = async function(params: {
    unspent: boolean;
    address: string;
    chain: string;
    network: string;
  }) {
    const { unspent, address } = params;
    const args = unspent ? `?unspent=${unspent}` : '';
    const url = `${this.getUrl(params)}/address/${address}${args}`;
    return request.get(url, {
      json: true
    });
  };

  getCoins(params: {
    pubKey: string;
    includeSpent: boolean;
    chain: string;
    network: string;
  }) {
    const { pubKey, includeSpent } = params;
    const url = `${this.getUrl(
      params
    )}/wallet/${pubKey}/utxos?includeSpent=${includeSpent}`;
    const signature = this.sign({ method: 'GET', url, payload: '' });
    return requestStream.get(url, {
      headers: { 'x-signature': signature },
      body: '',
      json: true
    });
  }

  listTransactions(params: {
    chain: string;
    network: string;
    pubKey: string;
    startBlock: string | number;
    startDate: string;
    endBlock: string | number;
    endDate: string;
    includeMempool: boolean;
  }) {
    const {
      pubKey,
      startBlock,
      startDate,
      endBlock,
      endDate,
      includeMempool
    } = params;
    let url = `${this.getUrl(params)}/wallet/${pubKey}/transactions?`;
    if (startBlock) {
      url += `startBlock=${startBlock}&`;
    }
    if (endBlock) {
      url += `endBlock=${endBlock}&`;
    }
    if (startDate) {
      url += `startDate=${startDate}&`;
    }
    if (endDate) {
      url += `endDate=${endDate}&`;
    }
    if (includeMempool) {
      url += 'includeMempool=true';
    }
    const signature = this.sign({ method: 'GET', url });
    return requestStream.get(url, {
      headers: { 'x-signature': signature },
      json: true
    });
  }

  async getFee(params: { target: number; chain: string; network: string }) {
    const { target } = params;
    const url = `${this.getUrl(params)}/fee/${target}`;
    return request.get(url, {
      json: true
    });
  }

  async importAddresses(params: {
    payload: Array<{ address: string }>;
    pubKey: string;
    chain: string;
    network: string;
  }) {
    const { payload, pubKey } = params;
    const url = `${this.getUrl(params)}/wallet/${pubKey}`;
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
    const url = `${this.getUrl(params)}/tx/send`;
    return request.post(url, { body: payload, json: true });
  }
}
