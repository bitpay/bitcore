import { Readable } from 'stream';
import Config from '../../../config';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { CSP } from '../../../types/namespaces/ChainStateProvider';
import { ObjectID } from 'mongodb';
import Web3 from 'web3';
import { Storage } from '../../../services/storage';
import { InternalStateProvider } from '../../../providers/chain-state/internal/internal';
import { EthTransactionStorage } from '../models/transaction';
import { ITransaction } from '../../../models/baseTransaction';
import { EthTransactionJSON } from '../types';
import { EthBlockStorage } from '../models/block';
import { SpentHeightIndicators } from '../../../types/Coin';
import { EthListTransactionsStream } from './transform';
import { ERC20Abi } from '../abi/erc20';
import { Transaction } from 'web3/eth/types';
import { EventLog } from 'web3/types';
import { EthP2pWorker } from '../p2p';

interface ERC20Transfer extends EventLog {
  returnValues: {
    _from: string;
    _to: string;
    _value: string;
  };
}

export class ETHStateProvider extends InternalStateProvider implements CSP.IChainStateService {
  config: any;
  web3?: Web3;

  constructor(public chain: string = 'ETH') {
    super(chain);
    this.config = Config.chains[this.chain];
  }

  getWeb3(network: string) {
    if (!this.web3) {
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
      this.web3 = new Web3(new ProviderType(connUrl));
    }
    return this.web3;
  }

  erc20For(network: string, address: string) {
    const web3 = this.getWeb3(network);
    const contract = new web3.eth.Contract(ERC20Abi, address);
    return contract;
  }

  async getFee(params) {
    let { network, target = 4 } = params;
    if (network === 'livenet') {
      network = 'mainnet';
    }
    const bestBlock = await this.getWeb3(network).eth.getBlockNumber();
    const gasPrices: number[] = [];
    for (let i = 0; i < target; i++) {
      const block = await this.getWeb3(network).eth.getBlock(bestBlock - i, true);
      const txs = block.transactions as Array<Transaction>;
      var blockGasPrices = txs.map(tx => {
        return Number(tx.gasPrice);
      });
      // sort gas prices in descending order
      blockGasPrices = blockGasPrices.sort((a, b) => {
        return b - a;
      });
      var txCount = txs.length;
      var lowGasPriceIndex = txCount > 1 ? txCount - 2 : 0;
      if (txCount > 0) {
        gasPrices.push(blockGasPrices[lowGasPriceIndex]);
      }
    }
    var gethGasPrice = await this.getWeb3(network).eth.getGasPrice();
    var estimate = gasPrices.reduce((a, b) => {
      return Math.max(a, b);
    }, gethGasPrice);
    return estimate;
  }

  async getBalanceForAddress(params: CSP.GetBalanceForAddressParams) {
    const { network, address } = params;
    if (params.args && params.args.tokenAddress) {
      const balance = await this.erc20For(network, params.args.tokenAddress)
        .methods.balanceOf(address)
        .call();
      return { confirmed: balance, unconfirmed: 0, balance };
    }
    const balance = Number(await this.getWeb3(network).eth.getBalance(address));
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
    const tx = await this.getWeb3(network).eth.sendSignedTransaction(rawTx);
    return tx;
  }

  async getWalletAddresses(walletId: ObjectID) {
    let query = { chain: this.chain, wallet: walletId };
    return WalletAddressStorage.collection
      .find(query)
      .addCursorFlag('noCursorTimeout', true)
      .toArray();
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
        unconfirmed: prev.unconfirmed + cur.unconfirmed,
        confirmed: prev.confirmed + cur.confirmed,
        balance: prev.balance + cur.balance
      }),
      { unconfirmed: 0, confirmed: 0, balance: 0 }
    );
    return balance;
  }

  async streamWalletTransactions(params: CSP.StreamWalletTransactionsParams) {
    const { chain, network, wallet, res, args } = params;
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
      const erc20Txs = await this.getWalletTokenTransactions(network, wallet._id!, args.tokenAddress);
      const p2p = new EthP2pWorker({ chain, network, chainConfig: {} });
      erc20Txs.forEach(tx => transactionStream.push(p2p.convertTx(tx)));
      transactionStream.push(null);
    }
    const listTransactionsStream = new EthListTransactionsStream(wallet);
    transactionStream.pipe(listTransactionsStream).pipe(res);
  }

  async getErc20Transfers(
    network: string,
    address: string,
    tokenAddress: string
  ): Promise<Array<Partial<Transaction>>> {
    const token = this.erc20For(network, tokenAddress);
    const [sent, received] = await Promise.all([
      token.getPastEvents('Transfer', {
        filter: { _from: address },
        fromBlock: 0
      }),
      token.getPastEvents('Transfer', {
        filter: { _to: address },
        fromBlock: 0
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

  async getWalletTokenTransactions(network: string, walletId: ObjectID, tokenAddress: string) {
    const addresses = await this.getWalletAddresses(walletId);
    const allTokenQueries = Array<Promise<Array<Partial<Transaction>>>>();
    for (const walletAddress of addresses) {
      const transfers = this.getErc20Transfers(network, walletAddress.address, tokenAddress);
      allTokenQueries.push(transfers);
    }
    let batches = await Promise.all(allTokenQueries);
    let txs = batches.reduce((agg, batch) => agg.concat(batch));
    return txs.sort((tx1, tx2) => tx1.blockNumber! - tx2.blockNumber!);
  }

  async estimateGas(params): Promise<Number> {
    const { network, from, to, value, data, gasPrice } = params;
    const gasLimit = await this.getWeb3(network).eth.estimateGas({ from, to, value, data, gasPrice });
    return gasLimit;
  }
}
