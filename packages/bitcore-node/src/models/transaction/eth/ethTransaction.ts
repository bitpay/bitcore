import logger from '../../../logger';
import * as _ from 'lodash';
import { partition } from '../../../utils/partition';
import { TransformOptions } from '../../../types/TransformOptions';
import { LoggifyClass } from '../../../decorators/Loggify';
import { MongoBound } from '../.././base';
import { StreamingFindOptions, Storage, StorageService } from '../../../services/storage';
import { EthTransactionJSON, IEthTransaction } from '../../../types/Transaction';
import { SpentHeightIndicators } from '../../../types/Coin';
import { Config } from '../../../services/config';
import { EventStorage } from '../.././events';
import { WalletAddressStorage } from '../../walletAddress';
import { TransactionModel } from '../base/base';
import { ObjectID } from 'bson';
import AbiDecoder from 'abi-decoder';
const erc20abi = require('../../../providers/chain-state/erc20/erc20abi');
const erc721abi = require('../../../providers/chain-state/erc20/erc721abi');

@LoggifyClass
export class EthTransactionModel extends TransactionModel<IEthTransaction> {
  constructor(storage?: StorageService) {
    super(storage);
  }

  onConnect() {
    super.onConnect();
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
        this.collection.bulkWrite(txBatch, { ordered: false })
      )
    );

    // Create events for mempool txs
    if (params.height < SpentHeightIndicators.minimum) {
      for (let op of txOps) {
        const filter = op.updateOne.filter;
        const tx = { ...op.updateOne.update.$set, ...filter } as IEthTransaction;
        await EventStorage.signalTx(tx);
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
    [rest: string]: any;
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
        AbiDecoder.addABI(erc20abi);
        const value = AbiDecoder.decodeMethod(input).params.filter(e => e.name === '_value')[0].value;
        return {
          type: 'ERC20',
          value
        };
      } catch {
        AbiDecoder.addABI(erc721abi);
        const value = AbiDecoder.decodeMethod(input).params.filter(e => e.name === '_value')[0].value;
        return {
          type: 'ERC721',
          value
        };
      }
    } catch {
      return false;
    }
  }

  _apiTransform(tx: Partial<MongoBound<IEthTransaction>>, options?: TransformOptions): EthTransactionJSON | string {
    const decodedData = this.abiDecode(`0x${tx.data!.toString('hex')}`);

    const transaction: EthTransactionJSON = {
      _id: tx._id ? tx._id.toString() : '',
      txid: tx.txid || '',
      network: tx.network || '',
      chain: tx.chain || '',
      blockHeight: tx.blockHeight || -1,
      blockHash: tx.blockHash || '',
      blockTime: tx.blockTime ? tx.blockTime.toISOString() : '',
      blockTimeNormalized: tx.blockTimeNormalized ? tx.blockTimeNormalized.toISOString() : '',
      size: tx.size || -1,
      fee: tx.fee || -1,
      value: tx.value || -1,
      gasLimit: tx.gasLimit || -1,
      gasPrice: tx.gasPrice || -1,
      nonce: tx.nonce || 0,
      to: tx.to || '',
      from: tx.from || '',
      decodedData: decodedData ? decodedData : undefined
    };
    if (options && options.object) {
      return transaction;
    }
    return JSON.stringify(transaction);
  }
}
export let EthTransactionStorage = new EthTransactionModel();
