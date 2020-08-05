import * as requestStream from 'request';
import * as request from 'request-promise-native';
import * as secp256k1 from 'secp256k1';
import { URL } from 'url';
import logger from '../../logger';

const bitcoreLib = require('bitcore-lib');

export class Client {
  authKey: { bn: { toBuffer: (arg) => Buffer } };
  baseUrl: string;

  constructor(params) {
    Object.assign(this, params);
  }

  getMessage(params: { method: string; url: string; payload?: any }) {
    const { method, url, payload = {} } = params;
    const parsedUrl = new URL(url);
    return [method, parsedUrl.pathname + parsedUrl.search, JSON.stringify(payload)].join('|');
  }

  sign(params: { method: string; url: string; payload?: any }) {
    const message = this.getMessage(params);
    const privateKey = this.authKey.bn.toBuffer({ size: 32 });
    const messageHash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));

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

  async getBalance(params) {
    const { payload, pubKey, tokenAddress, multisigContractAddress } = params;
    let query = '';
    let apiUrl = `${this.baseUrl}/wallet/${pubKey}/balance`;

    if (tokenAddress) {
      query = `?tokenAddress=${tokenAddress}`;
    }

    if (multisigContractAddress) {
      apiUrl = `${this.baseUrl}/address/${multisigContractAddress}/balance`;
    }

    const url = apiUrl + query;
    const signature = this.sign({ method: 'GET', url, payload });
    return request.get(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  async getCheckData(params) {
    const { payload, pubKey } = params;
    const url = `${this.baseUrl}/wallet/${pubKey}/check`;
    logger.debug('WALLET CHECK');
    const signature = this.sign({ method: 'GET', url, payload });
    return request.get(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  async getAddressTxos(params) {
    const { unspent, address } = params;
    const args = unspent ? `?unspent=${unspent}` : '';
    const url = `${this.baseUrl}/address/${address}${args}`;
    return request.get(url, {
      json: true
    });
  }

  async getTx(params) {
    const { txid } = params;
    const url = `${this.baseUrl}/tx/${txid}`;
    return request.get(url, {
      json: true
    });
  }

  async getCoins(params) {
    const { payload, pubKey, includeSpent } = params;

    var extra = '';
    if (includeSpent) {
      extra = `?includeSpent=${includeSpent}`;
    }
    const url = `${this.baseUrl}/wallet/${pubKey}/utxos${extra}`;
    logger.debug('GET UTXOS:', url);
    const signature = this.sign({ method: 'GET', url, payload });
    return request.get(url, {
      headers: { 'x-signature': signature },
      body: payload,
      json: true
    });
  }

  async getCoinsForTx(params) {
    const { txId } = params;
    const url = `${this.baseUrl}/tx/${txId}/coins`;
    logger.debug('GET COINS FOR TX:', url);
    return request.get(url, {
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
      tokenAddress,
      multisigContractAddress
    } = params;
    let query = '';
    let apiUrl = `${this.baseUrl}/wallet/${pubKey}/transactions?`;
    if (startBlock) {
      query += `startBlock=${startBlock}&`;
    }
    if (endBlock) {
      query += `endBlock=${endBlock}&`;
    }
    if (tokenAddress) {
      query += `tokenAddress=${tokenAddress}&`;
    }
    if (multisigContractAddress) {
      apiUrl = `${this.baseUrl}/ethmultisig/transactions/${multisigContractAddress}?`;
    }
    if (includeMempool) {
      query += 'includeMempool=true';
    }
    const url = apiUrl + query;
    const signature = this.sign({ method: 'GET', url });
    logger.debug('List transactions', url);
    return requestStream.get(url, {
      headers: { 'x-signature': signature },
      json: true
    });
  }

  async importAddresses(params) {
    const { payload, pubKey } = params;
    const url = `${this.baseUrl}/wallet/${pubKey}`;

    logger.debug('addAddresses:', url, payload);
    const signature = this.sign({ method: 'POST', url, payload });
    const h = { 'x-signature': signature };
    return request.post(url, {
      headers: h,
      body: payload,
      json: true
    });
  }

  async broadcast(params) {
    const { payload } = params;
    const url = `${this.baseUrl}/tx/send`;
    logger.debug('Broadcast', url);
    return request.post(url, { body: payload, json: true });
  }
}
