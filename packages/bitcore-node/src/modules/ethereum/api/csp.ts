import { Readable, Transform } from 'stream';
import Config from '../../../config';
import { CSP } from '../../../types/namespaces/ChainStateProvider';
import { ObjectID } from 'mongodb';
import Web3 from 'web3';
import { Storage } from '../../../services/storage';
import { InternalStateProvider } from '../../../providers/chain-state/internal/internal';
import { EthTransactionStorage } from '../models/transaction';
import { ITransaction } from '../../../models/baseTransaction';
import { EthTransactionJSON, IEthBlock } from '../types';
import { EthBlockStorage } from '../models/block';
import { SpentHeightIndicators } from '../../../types/Coin';
import { EthListTransactionsStream } from './transform';
import { ERC20Abi } from '../abi/erc20';
import { Transaction } from 'web3/eth/types';
import { EventLog } from 'web3/types';
import { partition } from '../../../utils/partition';
import { WalletAddressStorage } from '../../../models/walletAddress';

interface ERC20Transfer extends EventLog {
  returnValues: {
    _from: string;
    _to: string;
    _value: string;
  };
}

export class ETHStateProvider extends InternalStateProvider implements CSP.IChainStateService {
  config: any;
  static web3 = {} as { [network: string]: Web3 };

  constructor(public chain: string = 'ETH') {
    super(chain);
    this.config = Config.chains[this.chain];
  }

  async getWeb3(network: string) {
    try {
      if (ETHStateProvider.web3[network]) {
        await ETHStateProvider.web3[network].eth.getBlockNumber();
      }
    } catch (e) {
      delete ETHStateProvider.web3[network];
    }
    if (!ETHStateProvider.web3[network]) {
      const networkConfig = this.config[network];
      const provider = networkConfig.provider;
      const host = provider.host || 'localhost';
      const protocol = provider.protocol || 'http';
      const portString = provider.port || '8545';
      const connUrl = `${protocol}://${host}:${portString}`;
      let ProviderType;
      switch (provider.protocol) {
        case 'ws':
        case 'wss':
          ProviderType = Web3.providers.WebsocketProvider;
          break;
        default:
          ProviderType = Web3.providers.HttpProvider;
          break;
      }
      ETHStateProvider.web3[network] = new Web3(new ProviderType(connUrl));
    }
    return ETHStateProvider.web3[network];
  }

  async erc20For(network: string, address: string) {
    const web3 = await this.getWeb3(network);
    const contract = new web3.eth.Contract(ERC20Abi, address);
    return contract;
  }

  async getERC20TokenInfo(network: string, tokenAddress: string) {
    const token = await ETH.erc20For(network, tokenAddress);
    const [name, decimals, symbol] = await Promise.all([
      token.methods.name().call(),
      token.methods.decimals().call(),
      token.methods.symbol().call()
    ]);

    return {
      name,
      decimals,
      symbol
    };
  }

  async getFee(params) {
    let { network, target = 4 } = params;
    const chain = this.chain;
    if (network === 'livenet') {
      network = 'mainnet';
    }
    const web3 = await this.getWeb3(network);
    const [gethGasPrice, bestBlock] = await Promise.all([web3.eth.getGasPrice(), this.getLocalTip({ chain, network })]);
    if (!bestBlock) {
      return gethGasPrice;
    }

    const gasPrices: number[] = [];
    const txs = await EthTransactionStorage.collection
      .find({ chain, network, blockHeight: { $gte: bestBlock.height - target } })
      .toArray();

    const blockGasPrices = txs.map(tx => Number(tx.gasPrice)).sort((a, b) => b - a);
    const txCount = txs.length;
    const lowGasPriceIndex = txCount > 1 ? txCount - 1 : 0;
    if (txCount > 0) {
      gasPrices.push(blockGasPrices[lowGasPriceIndex]);
    }
    const estimate = Math.max(...gasPrices, gethGasPrice);
    return estimate;
  }

  async getBalanceForAddress(params: CSP.GetBalanceForAddressParams) {
    const { network, address } = params;
    const web3 = await this.getWeb3(network);
    if (params.args && params.args.tokenAddress) {
      const token = await this.erc20For(network, params.args.tokenAddress);

      const balance = Number(await token.methods.balanceOf(address).call());
      return { confirmed: balance, unconfirmed: 0, balance };
    }
    const balance = Number(await web3.eth.getBalance(address));
    return { confirmed: balance, unconfirmed: 0, balance };
  }

  async getLocalTip({ chain, network }) {
    return EthBlockStorage.getLocalTip({ chain, network });
  }

  async getTransaction(params: CSP.StreamTransactionParams) {
    try {
      let { chain, network, txId } = params;
      if (typeof txId !== 'string' || !chain || !network) {
        throw 'Missing required param';
      }
      network = network.toLowerCase();
      let query = { chain: chain, network, txid: txId };
      const tip = await this.getLocalTip(params);
      const tipHeight = tip ? tip.height : 0;
      const found = await EthTransactionStorage.collection.findOne(query);
      if (found) {
        let confirmations = 0;
        if (found.blockHeight && found.blockHeight >= 0) {
          confirmations = tipHeight - found.blockHeight + 1;
        }
        const convertedTx = EthTransactionStorage._apiTransform(found, { object: true }) as EthTransactionJSON;
        return { ...convertedTx, confirmations: confirmations } as any;
      } else {
        return undefined;
      }
    } catch (err) {
      console.error(err);
    }
    return undefined;
  }

  async broadcastTransaction(params: CSP.BroadcastTransactionParams) {
    const { network, rawTx } = params;
    const web3 = await this.getWeb3(network);
    const rawTxs = typeof rawTx === 'string' ? [rawTx] : rawTx;
    const txids = new Array<string>();
    for (const tx of rawTxs) {
      const txid = await new Promise<string>((resolve, reject) => {
        web3.eth
          .sendSignedTransaction(tx)
          .on('transactionHash', resolve)
          .on('error', reject)
          .catch(e => reject(e));
      });
      txids.push(txid);
    }
    return txids.length === 1 ? txids[0] : txids;
  }

  async streamAddressTransactions(params: CSP.StreamAddressUtxosParams) {
    const { req, res, args, chain, network, address } = params;
    const { limit, since, tokenAddress } = args;
    if (!args.tokenAddress) {
      const query = { chain, network, $or: [{ from: address }, { to: address }] };
      Storage.apiStreamingFind(EthTransactionStorage, query, { limit, since, paging: '_id' }, req, res);
    } else {
      try {
        const tokenTransfers = await this.getErc20Transfers(network, address, tokenAddress);
        res.json(tokenTransfers);
      } catch (e) {
        res.status(500).send(e);
      }
    }
  }

  async streamTransactions(params: CSP.StreamTransactionsParams) {
    const { chain, network, req, res, args } = params;
    let { blockHash, blockHeight } = args;
    if (!chain || !network) {
      throw 'Missing chain or network';
    }
    let query: any = {
      chain: chain,
      network: network.toLowerCase()
    };
    if (blockHeight !== undefined) {
      query.blockHeight = Number(blockHeight);
    }
    if (blockHash !== undefined) {
      query.blockHash = blockHash;
    }
    const tip = await this.getLocalTip(params);
    const tipHeight = tip ? tip.height : 0;
    return Storage.apiStreamingFind(EthTransactionStorage, query, args, req, res, t => {
      let confirmations = 0;
      if (t.blockHeight !== undefined && t.blockHeight >= 0) {
        confirmations = tipHeight - t.blockHeight + 1;
      }
      const convertedTx = EthTransactionStorage._apiTransform(t, { object: true }) as Partial<ITransaction>;
      return JSON.stringify({ ...convertedTx, confirmations: confirmations });
    });
  }

  async getWalletBalance(params: CSP.GetWalletBalanceParams) {
    const { network } = params;
    if (params.wallet._id === undefined) {
      throw new Error('Wallet balance can only be retrieved for wallets with the _id property');
    }
    let addresses = await this.getWalletAddresses(params.wallet._id);
    let addressBalancePromises = addresses.map(({ address }) =>
      this.getBalanceForAddress({ chain: this.chain, network, address, args: params.args })
    );
    let addressBalances = await Promise.all<{ confirmed: number; unconfirmed: number; balance: number }>(
      addressBalancePromises
    );
    let balance = addressBalances.reduce(
      (prev, cur) => ({
        unconfirmed: prev.unconfirmed + Number(cur.unconfirmed),
        confirmed: prev.confirmed + Number(cur.confirmed),
        balance: prev.balance + Number(cur.balance)
      }),
      { unconfirmed: 0, confirmed: 0, balance: 0 }
    );
    return balance;
  }

  async streamWalletTransactions(params: CSP.StreamWalletTransactionsParams) {
    const { chain, network, wallet, res, args } = params;
    const web3 = await this.getWeb3(network);
    const query: any = {
      chain,
      network,
      wallets: wallet._id,
      'wallets.0': { $exists: true }
    };

    if (args) {
      if (args.startBlock || args.endBlock) {
        query.$or = [];
        if (args.includeMempool) {
          query.$or.push({ blockHeight: SpentHeightIndicators.pending });
        }
        let blockRangeQuery = {} as any;
        if (args.startBlock) {
          blockRangeQuery.$gte = Number(args.startBlock);
        }
        if (args.endBlock) {
          blockRangeQuery.$lte = Number(args.endBlock);
        }
        query.$or.push({ blockHeight: blockRangeQuery });
      } else {
        if (args.startDate) {
          const startDate = new Date(args.startDate);
          if (startDate.getTime()) {
            query.blockTimeNormalized = { $gte: new Date(args.startDate) };
          }
        }
        if (args.endDate) {
          const endDate = new Date(args.endDate);
          if (endDate.getTime()) {
            query.blockTimeNormalized = query.blockTimeNormalized || {};
            query.blockTimeNormalized.$lt = new Date(args.endDate);
          }
        }
      }
    }

    let transactionStream = new Readable({ objectMode: true });
    if (!args.tokenAddress) {
      transactionStream = EthTransactionStorage.collection
        .find(query)
        .sort({ blockTimeNormalized: 1 })
        .addCursorFlag('noCursorTimeout', true);
    } else {
      const walletAddresses = await this.getWalletAddresses(wallet._id!);
      const query = {
        chain,
        network,
        $or: [
          {
            wallets: wallet._id,
            abiType: { $exists: true },
            to: web3.utils.toChecksumAddress(args.tokenAddress),
            'abiType.type': 'ERC20',
            'abiType.name': 'transfer',
            'wallets.0': { $exists: true }
          },
          {
            abiType: { $exists: true },
            to: web3.utils.toChecksumAddress(args.tokenAddress),
            'abiType.type': 'ERC20',
            'abiType.name': 'transfer',
            'abiType.params.0.value': { $in: walletAddresses.map(w => w.address.toLowerCase()) }
          },
          {
            wallets: wallet._id,
            abiType: { $exists: true },
            'abiType.type': 'INVOICE',
            'abiType.params.8.value': args.tokenAddress.toLowerCase(),
            'wallets.0': { $exists: true }
          }
        ]
      };
      transactionStream = EthTransactionStorage.collection
        .find(query)
        .sort({ blockTimeNormalized: 1 })
        .addCursorFlag('noCursorTimeout', true)
        .pipe(
          new Transform({
            objectMode: true,
            transform: (tx: any, _, cb) => {
              if (tx.abiType && tx.abiType.type === 'ERC20') {
                return cb(null, {
                  ...tx,
                  value: tx.abiType!.params[1].value,
                  to: web3.utils.toChecksumAddress(tx.abiType!.params[0].value)
                });
              }
              if (tx.abiType && tx.abiType.type === 'INVOICE') {
                return cb(null, {
                  ...tx,
                  value: tx.abiType!.params[0].value,
                  to: tx.to
                });
              }
              return cb(null, tx);
            }
          })
        );
    }
    const listTransactionsStream = new EthListTransactionsStream(wallet);
    transactionStream.pipe(listTransactionsStream).pipe(res);
  }

  async getErc20Transfers(
    network: string,
    address: string,
    tokenAddress: string,
    args: Partial<CSP.StreamWalletTransactionsArgs> = {}
  ): Promise<Array<Partial<Transaction>>> {
    const token = await this.erc20For(network, tokenAddress);
    const [sent, received] = await Promise.all([
      token.getPastEvents('Transfer', {
        filter: { _from: address },
        fromBlock: args.startBlock || 0,
        toBlock: args.endBlock || 'latest'
      }),
      token.getPastEvents('Transfer', {
        filter: { _to: address },
        fromBlock: args.startBlock || 0,
        toBlock: args.endBlock || 'latest'
      })
    ]);
    return this.convertTokenTransfers([...sent, ...received]);
  }

  convertTokenTransfers(tokenTransfers: Array<ERC20Transfer>) {
    return tokenTransfers.map(this.convertTokenTransfer);
  }

  convertTokenTransfer(transfer: ERC20Transfer) {
    const { blockHash, blockNumber, transactionHash, returnValues, transactionIndex } = transfer;
    return {
      blockHash,
      blockNumber,
      transactionHash,
      transactionIndex,
      hash: transactionHash,
      from: returnValues._from,
      to: returnValues._to,
      value: returnValues._value
    } as Partial<Transaction>;
  }

  async getAccountNonce(network: string, address: string) {
    const web3 = await this.getWeb3(network);
    const count = await web3.eth.getTransactionCount(address);
    return count;
    /*
     *return EthTransactionStorage.collection.countDocuments({
     *  chain: 'ETH',
     *  network,
     *  from: address,
     *  blockHeight: { $gt: -1 }
     *});
     */
  }

  async getWalletTokenTransactions(
    network: string,
    walletId: ObjectID,
    tokenAddress: string,
    args: CSP.StreamWalletTransactionsArgs
  ) {
    const addresses = await this.getWalletAddresses(walletId);
    const allTokenQueries = Array<Promise<Array<Partial<Transaction>>>>();
    for (const walletAddress of addresses) {
      const transfers = this.getErc20Transfers(network, walletAddress.address, tokenAddress, args);
      allTokenQueries.push(transfers);
    }
    let batches = await Promise.all(allTokenQueries);
    let txs = batches.reduce((agg, batch) => agg.concat(batch));
    return txs.sort((tx1, tx2) => tx1.blockNumber! - tx2.blockNumber!);
  }

  async estimateGas(params): Promise<Number> {
    const { network, from, to, value, data, gasPrice } = params;
    const web3 = await this.getWeb3(network);
    const gasLimit = await web3.eth.estimateGas({ from, to, value, data, gasPrice });
    return gasLimit;
  }

  async getBlocks(params: CSP.GetBlockParams) {
    const { query, options } = this.getBlocksQuery(params);
    let cursor = EthBlockStorage.collection.find(query, options).addCursorFlag('noCursorTimeout', true);
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }
    let blocks = await cursor.toArray();
    const tip = await this.getLocalTip(params);
    const tipHeight = tip ? tip.height : 0;
    const blockTransform = (b: IEthBlock) => {
      let confirmations = 0;
      if (b.height && b.height >= 0) {
        confirmations = tipHeight - b.height + 1;
      }
      const convertedBlock = EthBlockStorage._apiTransform(b, { object: true }) as IEthBlock;
      return { ...convertedBlock, confirmations };
    };
    return blocks.map(blockTransform);
  }

  async updateWallet(params: CSP.UpdateWalletParams) {
    const { chain, network } = params;
    const addressBatches = partition(params.addresses, 500);
    for (let addressBatch of addressBatches) {
      const walletAddressInserts = addressBatch.map(address => {
        return {
          insertOne: {
            document: { chain, network, wallet: params.wallet._id, address, processed: false }
          }
        };
      });

      try {
        await WalletAddressStorage.collection.bulkWrite(walletAddressInserts);
      } catch (err) {
        if (err.code !== 11000) {
          throw err;
        }
      }

      await EthTransactionStorage.collection.updateMany(
        { chain, network, $or: [{ from: { $in: addressBatch } }, { to: { $in: addressBatch } }] },
        { $addToSet: { wallets: params.wallet._id } }
      );

      await WalletAddressStorage.collection.updateMany(
        { chain, network, address: { $in: addressBatch }, wallet: params.wallet._id },
        { $set: { processed: true } }
      );
    }
  }
}

export const ETH = new ETHStateProvider();
