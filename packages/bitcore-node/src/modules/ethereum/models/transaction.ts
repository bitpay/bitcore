import { ObjectID } from 'bson';
import * as _ from 'lodash';
import { LoggifyClass } from '../../../decorators/Loggify';
import logger from '../../../logger';
import { MongoBound } from '../../../models/base';
import { BaseTransaction } from '../../../models/baseTransaction';
import { CacheStorage } from '../../../models/cache';
import { EventStorage } from '../../../models/events';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { Config } from '../../../services/config';
import { Storage, StorageService } from '../../../services/storage';
import { SpentHeightIndicators } from '../../../types/Coin';
import { StreamingFindOptions } from '../../../types/Query';
import { TransformOptions } from '../../../types/TransformOptions';
import { valueOrDefault } from '../../../utils/check';
import { partition } from '../../../utils/partition';
import { ERC20Abi } from '../abi/erc20';
import { ERC721Abi } from '../abi/erc721';
import { InvoiceAbi } from '../abi/invoice';
import { MultisigAbi } from '../abi/multisig';
import { ETH } from '../api/csp';

import { EthTransactionJSON, IAbiDecodedEvent, IAbiDecodedLogs, IEthTransaction } from '../types';

function requireUncached(module) {
  delete require.cache[require.resolve(module)];
  return require(module);
}

const Erc20Decoder = requireUncached('abi-decoder');
Erc20Decoder.addABI(ERC20Abi);
function getErc20Decoder() {
  return Erc20Decoder;
}

const Erc721Decoder = requireUncached('abi-decoder');
Erc721Decoder.addABI(ERC721Abi);
function getErc721Decoder() {
  return Erc721Decoder;
}

const InvoiceDecoder = requireUncached('abi-decoder');
InvoiceDecoder.addABI(InvoiceAbi);
function getInvoiceDecoder() {
  return InvoiceDecoder;
}

const MultisigDecoder = requireUncached('abi-decoder');
MultisigDecoder.addABI(MultisigAbi);
function getMultisigDecoder() {
  return MultisigDecoder;
}

/*
Qualified events are the Keccak256 hash of the event name and parameter types.
For instance Transfer(address,address,uint256) = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
Listed here in qualifiedEvents we have all the possible event topics for each abi.
*/
const abiSet = [
  {
    type: 'ERC20',
    abi: ERC20Abi,
    decoder: getErc20Decoder,
    qualifiedEvents: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
    ]
  },
  {
    type: 'ERC721',
    abi: ERC721Abi,
    decoder: getErc721Decoder,
    qualifiedEvents: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
      '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31'
    ]
  },
  {
    type: 'INVOICE',
    abi: InvoiceAbi,
    decoder: getInvoiceDecoder,
    qualifiedEvents: ['0x826e7792f434a28ba302e6767da85b4b8e56b83a5e028687f30e848e32667f95']
  },
  {
    type: 'MULTISIG',
    abi: MultisigAbi,
    decoder: getMultisigDecoder,
    qualifiedEvents: [
      '0x4a504a94899432a9846e1aa406dceb1bcfd538bb839071d49d1e5e23f5be30ef',
      '0xf6a317157440607f36269043eb55f1287a5a19ba2216afeab88cd46cbcfb88e9',
      '0xc0ba8fe4b176c1714197d43b9cc6bcf797a4a7461c5fe8d0ef6e184ae7601e51',
      '0x33e13ecb54c3076d8e8bb8c2881800a4d972b792045ffae98fdf46df365fed75',
      '0x526441bb6c1aba3c9a4a6ca1d6545da9c2333c8c48343ef398eb858d72b79236',
      '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
      '0xf39e6e1eb0edcf53c221607b54b00cd28f3196fed0a24994dc308b8f611b682d',
      '0x8001553a916ef2f495d26a907cc54d96ed840d7bda71e73194bf5a9df7a76b90',
      '0xa3f1ee9126a074d9326c682f561767f710e927faa811f7a99829d49dc421797a',
      '0x4fb057ad4a26ed17a57957fa69c306f11987596069b89521c511fc9a894e6161'
    ]
  }
];
@LoggifyClass
export class EthTransactionModel extends BaseTransaction<IEthTransaction> {
  constructor(storage: StorageService = Storage) {
    super(storage);
  }

  async onConnect() {
    super.onConnect();
    this.collection.createIndex({ chain: 1, network: 1, to: 1 }, { background: true, sparse: true });
    this.collection.createIndex({ chain: 1, network: 1, from: 1 }, { background: true, sparse: true });
    this.collection.createIndex({ chain: 1, network: 1, from: 1, nonce: 1 }, { background: true, sparse: true });
    this.collection.createIndex(
      { chain: 1, network: 1, 'logs.logs.events': 1, blockTimeNormalized: 1 },
      {
        background: true,
        partialFilterExpression: { chain: 'ETH', 'logs.type': 'ERC20', 'logs.logs.name': 'Transfer' }
      }
    );
    this.collection.createIndex(
      { chain: 1, network: 1, 'internal.action.to': 1 },
      {
        background: true,
        sparse: true
      }
    );
  }

  async batchImport(params: {
    txs: Array<IEthTransaction>;
    height: number;
    mempoolTime?: Date;
    blockTime?: Date;
    blockHash?: string;
    blockTimeNormalized?: Date;
    parentChain?: string;
    forkHeight?: number;
    chain: string;
    network: string;
    initialSyncComplete: boolean;
    logs: any[];
  }) {
    const operations = [] as Array<Promise<any>>;
    operations.push(this.pruneMempool({ ...params }));
    const txOps = await this.addTransactions({ ...params });
    logger.debug('Writing Transactions', txOps.length);
    operations.push(
      ...partition(txOps, txOps.length / Config.get().maxPoolSize).map(txBatch =>
        this.collection.bulkWrite(
          txBatch.map(op => this.toMempoolSafeUpsert(op, params.height)),
          { ordered: false }
        )
      )
    );
    await Promise.all(operations);

    if (params.initialSyncComplete) {
      await this.expireBalanceCache(txOps);
    }

    // Create events for mempool txs
    if (params.height < SpentHeightIndicators.minimum) {
      for (let op of txOps) {
        const filter = op.updateOne.filter;
        const tx = { ...op.updateOne.update.$set, ...filter } as IEthTransaction;
        await EventStorage.signalTx(tx);
        await EventStorage.signalAddressCoin({
          address: tx.to,
          coin: { value: tx.value, address: tx.to, chain: params.chain, network: params.network, mintTxid: tx.txid }
        });
      }
    }
  }

  async expireBalanceCache(txOps: Array<any>) {
    for (const op of txOps) {
      let batch = new Array<{ multisigContractAdress?: string; tokenAddress?: string; address: string }>();
      const { chain, network } = op.updateOne.filter;
      const { from, to, logs } = op.updateOne.update.$set;
      batch = batch.concat([{ address: from }, { address: to }]);
      if (logs && logs.length > 0) {
        const ERC20Logs = logs.filter(l => l.type == 'ERC20' && !!l.logs.find(e => e.name == 'Transfer'));
        if (ERC20Logs && ERC20Logs.length > 0) {
          ERC20Logs.forEach(y => {
            for (const i of y.logs) {
              if (i.name == 'Transfer') {
                const toAddress = i.events.find(j => j.name == '_to').value;
                const fromAddress = i.events.find(j => j.name == '_from').value;
                const tokenAddress = i.address;
                batch.push({ address: fromAddress, tokenAddress });
                batch.push({ address: toAddress, tokenAddress });
              }
            }
          });
        }
      }

      for (const payload of batch) {
        const lowerAddress = payload.address.toLowerCase();
        const cacheKey = payload.tokenAddress
          ? `getBalanceForAddress-${chain}-${network}-${lowerAddress}-${payload.tokenAddress.toLowerCase()}`
          : `getBalanceForAddress-${chain}-${network}-${lowerAddress}`;
        await CacheStorage.expire(cacheKey);
      }
    }
  }

  async addTransactions(params: {
    txs: Array<IEthTransaction>;
    height: number;
    blockTime?: Date;
    blockHash?: string;
    blockTimeNormalized?: Date;
    parentChain?: string;
    forkHeight?: number;
    initialSyncComplete: boolean;
    chain: string;
    network: string;
    mempoolTime?: Date;
    logs: any[];
  }) {
    let { blockTimeNormalized, chain, height, network, parentChain, forkHeight, logs } = params;
    if (parentChain && forkHeight && height < forkHeight) {
      const parentTxs = await EthTransactionStorage.collection
        .find({ blockHeight: height, chain: parentChain, network })
        .toArray();
      return parentTxs.map(parentTx => {
        return {
          updateOne: {
            filter: { txid: parentTx.txid, chain, network },
            update: {
              $set: {
                ...parentTx,
                wallets: new Array<ObjectID>()
              }
            },
            upsert: true,
            forceServerObjectId: true
          }
        };
      });
    } else {
      return Promise.all(
        params.txs.map(async (tx: IEthTransaction) => {
          const { to, txid, from } = tx;
          const tos = [to];
          const froms = [from];
          const txEvents = logs.filter(log => log.transactionIndex === tx.transactionIndex);
          if (txEvents && txEvents.length > 0) {
            const decodedLogs = EthTransactionStorage.abiDecodeLogs(txEvents);
            if (decodedLogs.length > 0) {
              tx.logs = decodedLogs;
            }
          }
          const { web3 } = await ETH.getWeb3(network);

          // handle incoming ERC20 transactions
          if (tx.logs && tx.logs.length > 0) {
            const ERC20TransferLogs = tx.logs.find(l => l.type == 'ERC20')
              ? tx.logs.find(l => l.type == 'ERC20')!.logs.filter(l => l.name == 'Transfer')
              : undefined;
            if (ERC20TransferLogs && ERC20TransferLogs.length > 0) {
              for (let log of ERC20TransferLogs) {
                const _to = log.events.find(f => f.name === '_to');
                const _from = log.events.find(f => f.name === '_from');
                if (_to && _to.value) {
                  tos.push(web3.utils.toChecksumAddress(_to.value));
                }
                if (_from && _from.value) {
                  froms.push(web3.utils.toChecksumAddress(_from.value));
                }
              }
            }
          }

          // handle incoming internal transactions ( receiving a token swap from a different wallet )
          if (tx.internal) {
            for (let internal of tx.internal) {
              const { to, from } = internal.action;
              if (to) {
                tos.push(web3.utils.toChecksumAddress(to));
              }
              if (from) {
                froms.push(web3.utils.toChecksumAddress(from));
              }
            }
          }

          const sentWallets = await WalletAddressStorage.collection
            .find({ chain, network, address: { $in: froms } })
            .toArray();
          const receivedWallets = await WalletAddressStorage.collection
            .find({ chain, network, address: { $in: tos } })
            .toArray();
          const wallets = _.uniqBy(
            sentWallets.concat(receivedWallets).map(w => w.wallet),
            w => w.toHexString()
          );

          return {
            updateOne: {
              filter: { txid, chain, network },
              update: {
                $set: {
                  ...tx,
                  blockTimeNormalized,
                  wallets
                }
              },
              upsert: true,
              forceServerObjectId: true
            }
          };
        })
      );
    }
  }

  async pruneMempool(params: {
    txs: Array<IEthTransaction>;
    height: number;
    parentChain?: string;
    forkHeight?: number;
    chain: string;
    network: string;
    initialSyncComplete: boolean;
  }) {
    const { chain, network, initialSyncComplete, txs } = params;
    if (!initialSyncComplete) {
      return;
    }
    for (const tx of txs) {
      await this.collection.update(
        {
          chain,
          network,
          from: tx.from,
          nonce: tx.nonce,
          txid: { $ne: tx.txid },
          blockHeight: SpentHeightIndicators.pending
        },
        { $set: { blockHeight: SpentHeightIndicators.conflicting } },
        { w: 0, j: false, multi: true }
      );
    }
    return;
  }

  getTransactions(params: { query: any; options: StreamingFindOptions<IEthTransaction> }) {
    let originalQuery = params.query;
    const { query, options } = Storage.getFindOptions(this, params.options);
    const finalQuery = Object.assign({}, originalQuery, query);
    return this.collection.find(finalQuery, options).addCursorFlag('noCursorTimeout', true);
  }

  abiDecode(input: string) {
    for (let i = 0; i < abiSet.length; i++) {
      const abi = abiSet[i];
      try {
        const data = abi.decoder().decodeMethod(input);
        if (data) {
          return {
            type: abi.type,
            ...data
          };
        }
      } catch (e) {}
    }
    return;
  }

  checkTopics(topics, abi) {
    const containsEvents = abi.qualifiedEvents.some(q => topics.includes(q));
    if (containsEvents) {
      if (abi.type == 'ERC20' && topics.length != 3) {
        return false;
      }
      if (abi.type == 'ERC721' && topics.length != 4) {
        return false;
      }
      return containsEvents;
    }
  }

  abiDecodeLogs(inputs) {
    let finalResult: IAbiDecodedLogs[] = [];
    let madeEntry = false;
    let results = {
      ERC20: [] as IAbiDecodedEvent[],
      ERC721: [] as IAbiDecodedEvent[],
      INVOICE: [] as IAbiDecodedEvent[],
      MULTISIG: [] as IAbiDecodedEvent[]
    };
    for (let input of inputs) {
      for (let abi of abiSet) {
        try {
          if (abi.type == 'ERC20') {
            if (this.checkTopics(input.topics, abi)) {
              const data = abi.decoder().decodeLogs([input]);
              if (data && data.length > 0) {
                results[abi.type].push(data);
                madeEntry = true;
              }
            }
          } else if (abi.type == 'ERC721') {
            if (this.checkTopics(input.topics, abi)) {
              const data = abi.decoder().decodeLogs([input]);
              if (data && data.length > 0) {
                results[abi.type].push(data);
                madeEntry = true;
              }
            }
          } else if (abi.type == 'INVOICE') {
            if (this.checkTopics(input.topics, abi)) {
              const data = abi.decoder().decodeLogs([input]);
              if (data && data.length > 0) {
                results[abi.type].push(data);
                madeEntry = true;
              }
            }
          } else if (abi.type == 'MULTISIG') {
            if (this.checkTopics(input.topics, abi)) {
              const data = abi.decoder().decodeLogs([input]);
              if (data && data.length > 0) {
                results[abi.type].push(data);
                madeEntry = true;
              }
            }
          }
        } catch (e) {}
      }
    }
    if (madeEntry) {
      for (let abiType of Object.keys(results)) {
        if (results[abiType].length > 0) {
          finalResult.push({
            type: abiType as 'ERC20' | 'ERC721' | 'INVOICE' | 'MULTISIG',
            logs: results[abiType].flat()
          });
        }
      }
    }
    return finalResult;
  }
  // Correct tx.data.toString() => 0xa9059cbb00000000000000000000000001503dfc5ad81bf630d83697e98601871bb211b60000000000000000000000000000000000000000000000000000000000002710
  // Incorrect: tx.data.toString('hex') => 307861393035396362623030303030303030303030303030303030303030303030303031353033646663356164383162663633306438333639376539383630313837316262323131623630303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303032373130

  _apiTransform(
    tx: IEthTransaction | Partial<MongoBound<IEthTransaction>>,
    options?: TransformOptions
  ): EthTransactionJSON | string {
    const dataStr = tx.data ? tx.data.toString() : '';
    const transaction: EthTransactionJSON = {
      txid: tx.txid || '',
      network: tx.network || '',
      chain: tx.chain || '',
      blockHeight: valueOrDefault(tx.blockHeight, -1),
      blockHash: tx.blockHash || '',
      blockTime: tx.blockTime ? tx.blockTime.toISOString() : '',
      blockTimeNormalized: tx.blockTimeNormalized ? tx.blockTimeNormalized.toISOString() : '',
      fee: valueOrDefault(tx.fee, -1),
      value: valueOrDefault(tx.value, -1),
      data: dataStr,
      gasLimit: valueOrDefault(tx.gasLimit, -1),
      gasPrice: valueOrDefault(tx.gasPrice, -1),
      nonce: valueOrDefault(tx.nonce, 0),
      to: tx.to || '',
      from: tx.from || '',
      logs: tx.logs,
      internal: tx.internal
        ? tx.internal.map(t => ({ ...t, decodedData: this.abiDecode(t.action.input || '0x') }))
        : [],
      receipt: valueOrDefault(tx.receipt, undefined)
    };
    if (options && options.object) {
      return transaction;
    }
    return JSON.stringify(transaction);
  }
}
export let EthTransactionStorage = new EthTransactionModel();
