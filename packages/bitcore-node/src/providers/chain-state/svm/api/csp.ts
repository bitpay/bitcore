import { CryptoRpc } from 'crypto-rpc';
import { SolRpc } from 'crypto-rpc/lib/sol/SolRpc'
import { instructionKeys } from 'crypto-rpc/lib/sol/transaction-parser';
import { Readable } from 'stream';
import Config from '../../../../config';
import logger from '../../../../logger';
import { CacheStorage } from '../../../../models/cache';
import { Storage } from '../../../../services/storage';
import { IBlock } from '../../../../types/Block';
import { CoinListingJSON } from '../../../../types/Coin';
import { IChainConfig, IProvider, ISVMNetworkConfig } from '../../../../types/Config';
import { BroadcastTransactionParams, GetBalanceForAddressParams, GetBlockParams, GetCoinsForTxParams, GetEstimatePriorityFeeParams, GetWalletBalanceParams, IChainStateService, StreamAddressUtxosParams, StreamTransactionParams, StreamTransactionsParams, StreamWalletTransactionsParams } from '../../../../types/namespaces/ChainStateProvider';
import {
  getProvider,
  isValidProviderType
} from '../../external/providers/provider';
import { ExternalApiStream } from '../../external/streams/apiStream';
import { InternalStateProvider } from '../../internal/internal';

export interface GetSolWeb3Response { rpc: SolRpc; connection: any; dataType: string; };

export class BaseSVMStateProvider extends InternalStateProvider implements IChainStateService {
  config: IChainConfig<ISVMNetworkConfig>;
  static rpcs = {} as { [chain: string]: { [network: string]: GetSolWeb3Response[] } };

  constructor(public chain: string = 'SOL') {
    super(chain);
    this.config = Config.chains[this.chain] as IChainConfig<ISVMNetworkConfig>;
  }

  async getRpc(network: string, params?: { type: IProvider['dataType'] }): Promise<GetSolWeb3Response> {
    for (const rpc of BaseSVMStateProvider.rpcs[this.chain]?.[network] || []) {
      if (!isValidProviderType(params?.type, rpc.dataType)) {
        continue;
      }

      try {
        await Promise.race([
          rpc.connection.getSlot({ commitment: 'confirmed' }).send(),
          new Promise((_, reject) => setTimeout(reject, 5000))
        ]);
        return rpc; // return the first applicable rpc that's responsive
      } catch (e) {
        const idx = BaseSVMStateProvider.rpcs[this.chain][network].indexOf(rpc);
        BaseSVMStateProvider.rpcs[this.chain][network].splice(idx, 1);
      }
    }

    logger.info(`Making a new connection for ${this.chain}:${network}`);
    const dataType = params?.type;
    const providerConfig = getProvider({ network, dataType, config: this.config });
    const wsPort = providerConfig.wsPort ?? providerConfig.port;
    const rpcConfig = { ...providerConfig, chain: 'SOL', currencyConfig: {}, wsPort };
    const rpc = new CryptoRpc(rpcConfig, {}).get('SOL');
    const rpcObj = {
      rpc,
      connection: rpc.rpc,
      dataType: rpcConfig.dataType || 'combined',
    };
    if (!BaseSVMStateProvider.rpcs[this.chain]) {
      BaseSVMStateProvider.rpcs[this.chain] = {};
    }
    if (!BaseSVMStateProvider.rpcs[this.chain][network]) {
      BaseSVMStateProvider.rpcs[this.chain][network] = [];
    }
    BaseSVMStateProvider.rpcs[this.chain][network].push(rpcObj);
    return rpcObj;
  }

  async getFee(params) {
    const { network, target = 4, rawTx, signatures } = params;
    let cacheKey = `getFee-${this.chain}-${network}-${target}`;
    cacheKey += rawTx ? `-${rawTx}` : '';
    cacheKey += signatures ? `-${signatures}` : '';

    return CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        let feerate;
        const { rpc } = await this.getRpc(network);
        try {
          if (rawTx) {
            feerate = await rpc.estimateFee({ nBlocks: target, rawTx })
          } else {
            const { height } = await rpc.getTip();
            const { transactions } = await rpc.getBlock({ height });
            const _signatures = signatures || 1;
            let lamportsPerSig = 5000; // default
            if (transactions?.length) {
              const fee = transactions[0]?.meta?.fee || 5000;
              const numberOfSignatures = transactions[0]?.transactions?.signatures?.length || 1;
              lamportsPerSig = fee / numberOfSignatures;
            }
            // Total Fee = Number of Signatures × Lamports per Signature
            feerate = _signatures * lamportsPerSig
          }
        } catch (err: any) {
          logger.error('getFee: %o', err.stack || err.message || err);
          throw err;
        }
        return { feerate, blocks: target };
      },
      CacheStorage.Times.Minute
    );
  }

  async getTransaction(params: StreamTransactionParams): Promise<any | undefined> {
    const { txId, network } = params;
    const { rpc } = await this.getRpc(network);
    const tx = await rpc.getTransaction({ txid: txId });
    return this.txTransform(network, { transactions: [tx] });
  }

  async streamTransactions(params: StreamTransactionsParams): Promise<any> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const { chain, network, req, res, args } = params;
        let { blockHeight } = args;

        if (!chain || !network) {
          throw new Error('Missing chain or network');
        }
        if (blockHeight !== undefined) {
          blockHeight = Number(blockHeight);
        } else {
          throw new Error('Missing required block height / slot.');
        }

        const { rpc } = await this.getRpc(network);
        const block = await rpc.getBlock({ height: blockHeight });
        const transformedTxs = this.txTransform(network, { block });
        const stream = new Readable({ objectMode: true });

        transformedTxs.map(tx => stream.push(tx));
        stream.push(null);
        Storage.stream(stream, req!, res!);

        return resolve();
      } catch (err: any) {
        logger.error('Error streaming block transactions: %o', err.stack || err.message || err);
        reject(err);
      }
    });
  }

  async streamAddressTransactions(params: StreamAddressUtxosParams) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        await this._buildAddressTransactionsStream(params);
        return resolve();
      } catch (err) {
        return reject(err);
      }
    });
  }

  async streamWalletTransactions(params: StreamWalletTransactionsParams): Promise<any> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const { network, wallet, req, res, args } = params;
        const { limit } = args;
        const stream = new Readable({ objectMode: true });
        const walletAddresses = (await this.getWalletAddresses(wallet._id!)).map(waddress => waddress.address);
        let parsedTxs = [];

        for (const address of walletAddresses) {
          parsedTxs = parsedTxs.concat(await this.getParsedAddressTransactions(address, network, limit));
        }
        parsedTxs.map(tx => stream.push(tx));
        stream.push(null);
        ExternalApiStream.onStream(stream, req!, res!, { jsonl: true });
        return resolve();
      } catch (err: any) {
        logger.error('Error streaming wallet transactions: %o', err.stack || err.message || err);
        return reject(err);
      }
    });
  }

  async _buildAddressTransactionsStream(params: StreamAddressUtxosParams) {
    const { req, res, args, network, address } = params;
    const { limit } = args;
    const stream = new Readable({ objectMode: true });

    try {
      const parsedTxs = await this.getParsedAddressTransactions(address, network, limit);
      parsedTxs.map(tx => stream.push(tx));
      stream.push(null); // End stream
      ExternalApiStream.onStream(stream, req!, res!, { jsonl: true });
    } catch (err: any) {
      logger.error('Error streaming address transactions: %o', err.stack || err.message || err);
      throw err;
    }
  }

  async getParsedAddressTransactions(address: string, network: string, _limit?: number): Promise<any> {
    const { rpc, connection } = await this.getRpc(network);
    const txList = await connection.getSignaturesForAddress(address).send();
    const parsedTxs = await rpc.getTransactions({ address });
    return this.txTransform(network, { txStatuses: txList, transactions: parsedTxs, parsedTxs });
  }

  txTransform(network, params) {
    let { block, transactions, txStatuses } = params;
    let blockTime;
    let blockHash;

    if (block) {
      ({ blockHeight: blockTime, blockTime, blockhash: blockHash } = block);
    }
    transactions = transactions || block.transactions;
    if (!transactions || transactions.length === 0) {
      return [];
    }

    return transactions.map((tx, index) => {
      blockTime = blockTime || tx?.blockTime

      const { feePayerAddress, slot, meta, version, txid } = tx;
      const txStatus = txStatuses?.[index];
      const recentBlockhash = tx.lifetimeConstraint.blockhash || blockHash;
      const date = new Date((blockTime || 0) * 1000);
      const status = tx.status || txStatus?.confirmationStatus;
      const error = meta?.err || txStatus?.err;
      const transactionError = error ? { error: JSON.stringify(error, (_, v) => typeof v === 'bigint' ? v.toString() : v) } : null;
      const txType = version;
      const instructions = tx.instructions;
      const fee = meta?.fee;
      const from = feePayerAddress;
      const recipientAddresses = new Set();
      let mainToAddress = null;
      let value = 0;

      if (instructions?.[instructionKeys.TRANSFER_SOL]?.length > 0) {
        const solTransfers = instructions[instructionKeys.TRANSFER_SOL];
        mainToAddress = solTransfers.find(transfer =>
          transfer.destination !== from)?.destination || null;
        for (const transfer of solTransfers) {
          if (transfer.destination !== from) {
            recipientAddresses.add(transfer.destination);
          }
        };
        value = solTransfers.reduce((sum, transfer) => sum + Number(transfer.amount), 0);
      }
      if (instructions?.[instructionKeys.TRANSFER_CHECKED_TOKEN]?.length > 0) {
        const tokenTransfers = instructions[instructionKeys.TRANSFER_CHECKED_TOKEN];
        if (!mainToAddress) {
          mainToAddress = tokenTransfers.find(transfer =>
            transfer.destination !== from)?.destination || null;
        }
        for (const transfer of tokenTransfers) {
          if (transfer.destination !== from) {
            recipientAddresses.add(transfer.destination);
          }
        };
      }


      const allRecipients = Array.from(recipientAddresses);
      let txCategory = 'other';

      if (instructions?.[instructionKeys.TRANSFER_SOL]?.length > 0 ||
        instructions?.[instructionKeys.TRANSFER_CHECKED_TOKEN]?.length > 0) {
        if (allRecipients.length === 0) {
          txCategory = 'move';
        } else {
          const solSentOut = instructions?.[instructionKeys.TRANSFER_SOL]?.some(transfer =>
            transfer.source === from && transfer.destination !== from) || false;
          const tokensSentOut = instructions?.[instructionKeys.TRANSFER_CHECKED_TOKEN]?.some(transfer =>
            transfer.source === from && transfer.destination !== from) || false;
          const solReceived = instructions?.[instructionKeys.TRANSFER_SOL]?.some(transfer =>
            transfer.destination === from && transfer.source !== from) || false;
          const tokensReceived = instructions?.[instructionKeys.TRANSFER_CHECKED_TOKEN]?.some(transfer =>
            transfer.destination === from && transfer.source !== from) || false;

          if ((solSentOut || tokensSentOut) && !(solReceived || tokensReceived)) {
            txCategory = 'send';
          } else if (!(solSentOut || tokensSentOut) && (solReceived || tokensReceived)) {
            txCategory = 'receive';
          } else if ((solSentOut || tokensSentOut) && (solReceived || tokensReceived)) {
            // Both sending and receiving in the same transaction
            txCategory = 'move';
          }
        }
      }
      return {
        txid,
        fee: Number(fee),
        height: slot,
        from,
        initialFrom: from,
        txType,
        address: mainToAddress, // This is the main "to" address
        recipients: allRecipients, // New field for all recipient addresses
        blockTime: date,
        error: transactionError,
        network,
        chain: 'SOL',
        status,
        recentBlockhash,
        instructions,
        satoshis: value,
        category: txCategory
      } as any;
    });
  }

  blockTransform(network, block) {
    const txs = block?.transactions?.map(tx => tx?.transaction?.signatures[0]);
    return {
      chain: this.chain,
      network,
      height: Number(block?.blockHeight),
      hash: block?.blockhash,
      time: new Date(Number(block?.blockTime) * 1000),
      timeNormalized: new Date(Number(block?.blockTime) * 1000),
      previousBlockHash: block?.previousBlockHash,
      transactions: txs,
      transactionCount: block?.transactions?.length,
      size: block?.transactions?.length,
      reward: Number(block?.rewards[0]?.lamports),
      processed: true,
    } as IBlock;
  }

  async getBalanceForAddress(params: GetBalanceForAddressParams): Promise<{ confirmed: number; unconfirmed: number; balance: number }> {
    const { address, network, args } = params;
    const { rpc, connection } = await this.getRpc(network);
    const tokenAddress = args?.tokenAddress || args?.mintAddress;
    const cacheKey = tokenAddress
      ? `getBalanceForAddress-SOL-${network}-${address}-${tokenAddress.toLowerCase()}`
      : `getBalanceForAddress-SOL-${network}-${address}`;
    return await CacheStorage.getGlobalOrRefresh(
      cacheKey,
      async () => {
        if (tokenAddress) {
          const ata = await rpc.getConfirmedAta({ solAddress: address, mintAddress: tokenAddress });
          const { value } = await connection.getTokenAccountBalance(ata).send()
          const balance = value?.amount || 0;
          return { confirmed: balance, unconfirmed: 0, balance };
        } else {
          const balance = await rpc.getBalance({ address })
          return { confirmed: balance, unconfirmed: 0, balance };
        }
      },
      CacheStorage.Times.Minute
    );
  }

  async getBlock(params: GetBlockParams): Promise<IBlock> {
    const { height, blockId, network } = params;
    const { rpc } = await this.getRpc(network);
    const block = await rpc.getBlock({ height: Number(height || blockId) });
    return this.blockTransform(network, block);
  }

  async getPriorityFee(params: GetEstimatePriorityFeeParams): Promise<any> {
    const { percentile, network } = params;
    const { rpc } = await this.getRpc(network);
    const fee = await rpc.estimateMaxPriorityFee({ percentile });
    return fee;
  }

  async broadcastTransaction(params: BroadcastTransactionParams): Promise<any> {
    const { rawTx, network } = params;
    const { rpc } = await this.getRpc(network);
    return await rpc.sendRawTransaction({ rawTx });
  }

  async getWalletBalance(params: GetWalletBalanceParams): Promise<{ confirmed: number; unconfirmed: number; balance: number }> {
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

  async getRentExemptionAmount(params) {
    const { space, network } = params;
    const { connection } = await this.getRpc(network);
    return await connection.getMinimumBalanceForRentExemption(Number(space)).send();
  }

  async getCoinsForTx(_params: GetCoinsForTxParams): Promise<CoinListingJSON> {
    return {
      inputs: [],
      outputs: []
    };
  }

  async getTokenAccountAddresses(params) {
    const { network, address } = params;
    const { rpc, connection } = await this.getRpc(network);
    const addresses = await rpc.getTokenAccountsByOwner({ address })
    const result : {}[] = [];
    for (const addr of addresses) {
      if (addr.state === 'initialized') {
        const { value } = await connection.getTokenAccountBalance(addr.pubkey).send()
        result.push({ mintAddress: addr.mint, ataAddress: addr.pubkey, decimals: value.decimals })
      } 
    }
    return result;
  }

  async getLocalTip(params: any): Promise<IBlock> {
    const { network } = params;
    const { rpc, connection } = await this.getRpc(network);
    const height = await connection.getSlot({ commitment: 'confirmed' }).send();
    const block = await rpc.getBlock({ height });
    return this.blockTransform(network, block);
  }
}
