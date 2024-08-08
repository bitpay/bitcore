import os from 'os';
import request = require('request');
import Web3 from 'web3';
import config from '../../../../config';
import { CoinEvent } from '../../../../models/events';
import { ChainId, ChainNetwork } from '../../../../types/ChainNetwork';
import { IAddressSubscription, IExternalProvider } from '../../../../types/ExternalProvider';
import { StreamAddressUtxosParams, StreamTransactionParams } from '../../../../types/namespaces/ChainStateProvider';
import { isDateValid } from '../../../../utils';
import { EVMTransactionStorage } from '../../evm/models/transaction';
import { EVMTransactionJSON, GethTraceCall, IEVMTransactionTransformed, Transaction } from '../../evm/types';
import { ExternalApiStream as ApiStream } from '../streams/apiStream';


export interface MoralisAddressSubscription {
  id?: string;
  message?: string;
  status?: string;
}

class MoralisClass implements IExternalProvider {
  baseUrl = 'https://deep-index.moralis.io/api/v2.2';
  baseStreamUrl = 'https://api.moralis-streams.com/streams/evm';
  apiKey = config.externalProviders?.moralis?.apiKey;
  baseWebhookurl = config.externalProviders?.moralis?.webhookBaseUrl;
  headers = {
    'Content-Type': 'application/json',
    'X-API-Key': this.apiKey,
  };


  async getBlockNumberByDate({ chainId, date }) {
    if (!date || !isDateValid(date)) {
      throw new Error('Invalid date');
    }
    if (!chainId) {
      throw new Error('Invalid chainId');
    }

    const query = this._transformQueryParams({ chainId, args: { date } });
    const queryStr = this._buildQueryString(query);

    return new Promise<number>((resolve, reject) => {
      request({
        method: 'GET',
        url: `${this.baseUrl}/dateToBlock${queryStr}`,
        headers: this.headers,
        json: true
      }, (err, _data: any, body) => {
        if (err) {
          return reject(err);
        }
        return resolve(body.block as number);
      })
    });
  }


  async getTransaction(params: StreamTransactionParams & ChainId) {
    const { chain, network, chainId, txId } = params;

    const query = this._buildQueryString({ chain: chainId, include: 'internal_transactions' });

    return new Promise<IEVMTransactionTransformed>((resolve, reject) => {
      request({
        method: 'GET',
        url: `${this.baseUrl}/transaction/${txId}${query}`,
        headers: this.headers,
        json: true
      }, (err, data) => {
        if (err) {
          return reject(err);
        }
        if (typeof data === 'string') {
          return reject(new Error(data));
        }
        const tx = data.body;
        return resolve(this._transformTransaction({ chain, network, ...tx }));
      });
    });
  }


  streamAddressTransactions(params: StreamAddressUtxosParams & ChainId) {
    const { chainId, chain, network, address, args } = params;
    if (args.tokenAddress) {
      return this._streamERC20TransactionsByAddress({ chainId, chain, network, address, tokenAddress: args.tokenAddress, args });
    }
    if (!address) {
      throw new Error('Missing address');
    }
    if (!chainId) {
      throw new Error('Invalid chainId');
    }

    const query = this._transformQueryParams({ chainId, args }); // throws if no chain or network
    const queryStr = this._buildQueryString({
      ...query,
      order: args.order || 'DESC', // default to descending order
      limit: args.limit || 10, // limit per request/page. total limit is checked in apiStream._read()
      include: 'internal_transactions'
    });
    args.transform = (tx) => {
      const _tx: any = this._transformTransaction({ chain, network, ...tx });
      const confirmations = this._calculateConfirmations(tx, args.tipHeight);
      return EVMTransactionStorage._apiTransform({ ..._tx, confirmations }, { object: true }) as EVMTransactionJSON;
    }

    return new ApiStream(
      `${this.baseUrl}/${address}${queryStr}`,
      this.headers,
      args
    )
  }

  private _streamERC20TransactionsByAddress({ chainId, chain, network, address, tokenAddress, args }): any {
    if (!address) {
      throw new Error('Missing address');
    }
    if (!tokenAddress) {
      throw new Error('Missing token address');
    }
    if (!chainId) {
      throw new Error('Invalid chainId');
    }

    const queryTransform = this._transformQueryParams({ chainId, args }); // throws if no chain or network
    const queryStr = this._buildQueryString({
      ...queryTransform,
      order: args.order || 'DESC', // default to descending order
      limit: args?.page_limit || 10, // limit per request/page. total limit is checked in apiStream._read()
      contract_addresses: [tokenAddress],
    });
    args.transform = (tx) => {
      const _tx: any = this._transformTokenTransfer({ chain, network, ...tx });
      const confirmations = this._calculateConfirmations(tx, args.tipHeight);
      return EVMTransactionStorage._apiTransform({ ..._tx, confirmations }, { object: true }) as EVMTransactionJSON;
    }

    return new ApiStream(
      `${this.baseUrl}/${address}/erc20/transfers${queryStr}`,
      this.headers,
      args
    )
  }

  private _transformTransaction(tx) {
    const transformed = {
      chain: tx.chain,
      network: tx.network,
      txid: tx.hash || tx.transaction_hash, // erc20 transfer txs have transaction_hash
      blockHeight: Number(tx.block_number ?? tx.blockNumber),
      blockHash: tx.block_hash ?? tx.blockHash,
      blockTime: new Date(tx.block_timestamp ?? tx.blockTimestamp),
      blockTimeNormalized: new Date(tx.block_timestamp ?? tx.blockTimestamp),
      value: tx.value,
      gasLimit: tx.gas,
      gasPrice: tx.gas_price ?? tx.gasPrice,
      fee: Number(tx.receipt_gas_used ?? tx.receiptGasUsed) * Number(tx.gas_price ?? tx.gasPrice),
      nonce: tx.nonce,
      to: Web3.utils.toChecksumAddress(tx.to_address ?? tx.toAddress),
      from: Web3.utils.toChecksumAddress(tx.from_address ?? tx.fromAddress),
      data: tx.input,
      internal: [],
      calls: tx?.internal_transactions?.map(t => this._transformInternalTransaction(t)) || [],
      effects: [],
      category: tx.category,
      wallets: [],
      transactionIndex: tx.transaction_index ?? tx.transactionIndex
    } as IEVMTransactionTransformed;
    EVMTransactionStorage.addEffectsToTxs([transformed]);
    return transformed;
  }

  private _transformInternalTransaction(tx) {
    return {
      from: Web3.utils.toChecksumAddress(tx.from),
      to: Web3.utils.toChecksumAddress(tx.to),
      gas: tx.gas,
      gasUsed: tx.gas_used,
      input: tx.input,
      output: tx.output,
      type: tx.type,
      value: tx.value,
      abiType: EVMTransactionStorage.abiDecode(tx.input)
    } as GethTraceCall;
  }

  private _transformTokenTransfer(transfer) {
    let _transfer = this._transformTransaction(transfer);
    return {
      ..._transfer,
      transactionHash: transfer.transaction_hash,
      transactionIndex: transfer.transaction_index,
      contractAddress: transfer.contract_address,
      name: transfer.token_name
    } as Partial<Transaction> | any;
  }

  private _transformQueryParams(params) {
    const { chainId, args } = params;
    let query = {
      chain: this._formatChainId(chainId),
    } as any;
    if (args) {
      if (args.startBlock || args.endBlock) {
        if (args.startBlock) {
          query.from_block = Number(args.startBlock);
        }
        if (args.endBlock) {
          query.to_block = Number(args.endBlock);
        }
      } else {
        if (args.startDate) {
          query.from_date = args.startDate
        }
        if (args.endDate) {
          query.to_date = args.endDate;
        }
      }
      if (args.direction) {
        query.order = Number(args.direction) > 0 ? 'ASC' : 'DESC';
      }
      if (args.date) {
        query.date = new Date(args.date).getTime();
      }
    }
    return query;
  }

  private _calculateConfirmations(tx, tip) {
    let confirmations = 0;
    if (tx.blockHeight && tx.blockHeight >= 0) {
      confirmations = tip - tx.blockHeight + 1;
    }
    return confirmations;
  }

  private _buildQueryString(params: Record<string, any>): string {
    const query: string[] = [];

    if (params.chain) {
      params.chain = this._formatChainId(params.chain);
    }

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          // add array values in the form of key[i]=value
          if (value[i] != null) query.push(`${key}%5B${i}%5D=${value[i]}`);
        }
      } else if (value != null) {
        query.push(`${key}=${value}`);
      }
    }

    return query.length ? `?${query.join('&')}` : '';
  }

  private _formatChainId(chainId) {
    return '0x' + parseInt(chainId).toString(16);
  }

  /**
   * Request wrapper for moralis Streams (subscriptions)
   * @param method 
   * @param url 
   * @param body 
   * @returns 
   */
  _subsRequest(method: string, url: string, body?: any) {
    return new Promise((resolve, reject) => {
      request({
        method,
        url,
        headers: this.headers,
        json: true,
        body
      }, (err, data) => {
        if (err) {
          return reject(err);
        }
        if (typeof data === 'string') {
          return reject(new Error(data));
        }
        return resolve(data.body);
      });
    });
  }

  async createAddressSubscription(params: ChainNetwork & ChainId) {
    const { chain, network, chainId } = params;
    const _chainId = this._formatChainId(chainId);

    const result: any = await this._subsRequest('PUT', this.baseStreamUrl, {
        description: `Bitcore ${_chainId} - ${os.hostname()} - addresses`,
        // tag: '',
        chainIds: [_chainId],
        webhookUrl: `${this.baseWebhookurl}/${chain}/${network}/moralis`,
        includeNativeTxs: true,
        includeInternalTxs: true
      }
    );
    if (!result.id) {
      throw new Error('Failed to create subscription: ' + JSON.stringify(result));
    }
    return result;
  }

  async getAddressSubscriptions() {
    const subs: any = await this._subsRequest('GET', this.baseStreamUrl + '?limit=100');
    return subs.result as any[];
  }

  deleteAddressSubscription(params: { sub: IAddressSubscription }) {
    const { sub } = params;
    return this._subsRequest('DELETE', `${this.baseStreamUrl}/${sub.id}`) as Promise<MoralisAddressSubscription>;
  }

  async updateAddressSubscription(params: { sub: IAddressSubscription, addressesToAdd?: string[], addressesToRemove?: string[], status?: string }) {
    const { sub, addressesToAdd, addressesToRemove, status } = params;

    let moralisSub: MoralisAddressSubscription | null = null;
    if (addressesToAdd && addressesToAdd.length > 0) {
      moralisSub = await this._subsRequest('POST', `${this.baseStreamUrl}/${sub.id}/address`, { address: addressesToAdd }) as MoralisAddressSubscription;
    } else if (addressesToRemove && addressesToRemove.length > 0) {
      moralisSub = await this._subsRequest('DELETE', `${this.baseStreamUrl}/${sub.id}/address`, { address: addressesToRemove }) as MoralisAddressSubscription;
    } else if (status) {
      moralisSub = await this._subsRequest('POST', `${this.baseStreamUrl}/${sub.id}/status`, { status }) as MoralisAddressSubscription;
    }
    if (moralisSub?.message) {
      throw new Error(moralisSub.message);
    }
    return moralisSub?.id ? moralisSub : sub; // fallback to sub in case there's nothing to update (e.g. addressesToAdd is an empty array)
  }

  webhookToCoinEvents(params: { webhook: any } & ChainNetwork) {
    const { chain, network, webhook } = params;
    if (webhook.body.confirmed) {
      // Moralis broadcasts both confirmed and unconfirmed.
      // Filtering out confirmed de-duplicates events.
      return [];
    }
    const coinEvents: CoinEvent[] = webhook.body.txs.flatMap(tx => this._transformWebhookTransaction({ chain, network, tx, webhook: webhook.body }));
    return coinEvents;
  }

  private _transformWebhookTransaction(params: { webhook, tx } & ChainNetwork): CoinEvent[] {
    const { chain, network, tx } = params;
    const events: CoinEvent[] = [];
    for (const address of tx.triggered_by) {
      events.push({
        address,
        coin: {
          chain,
          network,
          value: tx.value,
          address: tx.toAddress,
          mintTxid: tx.hash
        }
      });
    }
    return events;
  }
}

export const Moralis = new MoralisClass();