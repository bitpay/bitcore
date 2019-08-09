import * as _ from 'lodash';
import { ObjectID } from 'bson';
import AbiDecoder from 'abi-decoder';

import logger from '../../../logger';
import { LoggifyClass } from '../../../decorators/Loggify';
import { IEthTransaction, EthTransactionJSON } from '../types';
import { StorageService, Storage } from '../../../services/storage';
import { partition } from '../../../utils/partition';
import { TransformOptions } from '../../../types/TransformOptions';
import { MongoBound } from '../../../models/base';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { SpentHeightIndicators } from '../../../types/Coin';
import { EventStorage } from '../../../models/events';
import { Config } from '../../../services/config';
import { StreamingFindOptions } from '../../../types/Query';
import { ERC721Abi } from '../abi/erc721';
import { ERC20Abi } from '../abi/erc20';
import { BaseTransaction } from '../../../models/baseTransaction';
import { valueOrDefault } from '../../../utils/check';

@LoggifyClass
export class EthTransactionModel extends BaseTransaction<IEthTransaction> {
  constructor(storage: StorageService = Storage) {
    super(storage);
  }

  onConnect() {
    super.onConnect();
    this.collection.createIndex({ chain: 1, network: 1, to: 1 }, { background: true });
    this.collection.createIndex({ chain: 1, network: 1, from: 1 }, { background: true });
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
  }) {
    await this.pruneMempool({ ...params });
    const txOps = await this.addTransactions({ ...params });
    logger.debug('Writing Transactions', txOps.length);
    await Promise.all(
      partition(txOps, txOps.length / Config.get().maxPoolSize).map(txBatch =>
        this.collection.bulkWrite(txBatch.map(op => this.toMempoolSafeUpsert(op, params.height)), { ordered: false })
      )
    );

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
  }) {
    let { blockTimeNormalized, chain, height, network, parentChain, forkHeight } = params;
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
          const sentWallets = await WalletAddressStorage.collection.find({ chain, network, address: from }).toArray();
          const receivedWallets = await WalletAddressStorage.collection.find({ chain, network, address: to }).toArray();
          const wallets = _.uniqBy(sentWallets.concat(receivedWallets).map(w => w.wallet), w => w.toHexString());

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
    const { chain, network, initialSyncComplete } = params;
    if (!initialSyncComplete) {
      return;
    }
    let prunedTxs = {};
    if (Object.keys(prunedTxs).length) {
      prunedTxs = Object.keys(prunedTxs);
      await Promise.all([
        this.collection.update(
          { chain, network, txid: { $in: prunedTxs } },
          { $set: { blockHeight: SpentHeightIndicators.conflicting } },
          { w: 0, j: false, multi: true }
        )
      ]);
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
    try {
      try {
        AbiDecoder.addABI(ERC20Abi);
        const decodedData = AbiDecoder.decodeMethod(input);
        if (!decodedData || decodedData.length === 0) {
          throw new Error();
        }
        return {
          type: 'ERC20',
          ...decodedData
        };
      } catch {
        AbiDecoder.addABI(ERC721Abi);
        const decodedData = AbiDecoder.decodeMethod(input);
        if (!decodedData || decodedData.length === 0) {
          throw new Error();
        }
        return {
          type: 'ERC721',
          ...decodedData
        };
      }
    } catch {
      return undefined;
    }
  }

  _apiTransform(
    tx: IEthTransaction | Partial<MongoBound<IEthTransaction>>,
    options?: TransformOptions
  ): EthTransactionJSON | string {
    const decodedData = this.abiDecode(`0x${tx.data!.toString('hex')}`);

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
      gasLimit: valueOrDefault(tx.gasLimit, -1),
      gasPrice: valueOrDefault(tx.gasPrice, -1),
      nonce: valueOrDefault(tx.nonce, 0),
      to: tx.to || '',
      from: tx.from || '',
      internal: tx.internal
        ? tx.internal.map(t => ({ ...t, decodedData: this.abiDecode(t.action.input || '0x') }))
        : [],
      decodedData: valueOrDefault(decodedData, undefined)
    };
    if (options && options.object) {
      return transaction;
    }
    return JSON.stringify(transaction);
  }
}
export let EthTransactionStorage = new EthTransactionModel();
