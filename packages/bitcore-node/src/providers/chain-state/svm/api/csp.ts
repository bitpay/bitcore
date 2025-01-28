import Web3 from '@solana/web3.js';
import { CryptoRpc } from 'crypto-rpc';
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
import { InternalStateProvider } from '../../internal/internal';
import { ISVMTransaction } from '../../svm/types';
import { ExternalApiStream } from '../../external/streams/apiStream';

export interface GetSolWeb3Response { rpc: CryptoRpc; connection: Web3.Connection; web3: any; dataType: string; };

export class BaseSVMStateProvider extends InternalStateProvider implements IChainStateService {
  config: IChainConfig<ISVMNetworkConfig>;
  static rpcs = {} as { [chain: string]: { [network: string]: GetSolWeb3Response[] } };

  constructor(public chain: string = 'SOL') {
    super(chain);
    this.config = Config.chains[this.chain] as IChainConfig<ISVMNetworkConfig>;
  }

  async getWeb3(network: string, params?: { type: IProvider['dataType'] }): Promise<GetSolWeb3Response> {
    for (const rpc of BaseSVMStateProvider.rpcs[this.chain]?.[network] || []) {
      if (!isValidProviderType(params?.type, rpc.dataType)) {
        continue;
      }

      try {
        await Promise.race([
          rpc.connection.getSlot({ commitment: 'confirmed' }),
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
    const rpcConfig = { ...providerConfig, chain: 'SOL', currencyConfig: {} };
    const rpc = new CryptoRpc(rpcConfig, {}).get('SOL');
    const rpcObj = {
      rpc,
      connection: rpc.connection,
      dataType: rpcConfig.dataType || 'combined',
      web3: rpc.web3,
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
        const { rpc } = await this.getWeb3(network);
        try {
          if (rawTx) {
            feerate = await rpc.estimateFee({ nBlocks: target, rawTx })
          } else {
            const { height } = await rpc.getTip();
            const { transactions } = await rpc.getBlock({ height });
            const _signatures = signatures || 1;
            let lamportsPerSig = 5000; // default
            if (transactions.length) {
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
    const { connection } = await this.getWeb3(network);
    const tx = await connection.getParsedTransaction(txId, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
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

        const { rpc } = this.getWeb3(network) as CryptoRpc;
        const block = rpc.getBlock({ height: blockHeight });
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

  async getParsedAddressTransactions(address: string, network: string, limit?: number): Promise<any> {
    const { connection, web3 } = await this.getWeb3(network);
    const pubKey = new web3.PublicKey(address);
    const txList = await connection.getSignaturesForAddress(pubKey, { limit });
    const sigList = txList.map(tx => tx.signature);
    const parsedTxs = await connection.getParsedTransactions(sigList, { maxSupportedTransactionVersion: 3 });
    return this.txTransform(network, { txStatuses: txList, transactions: parsedTxs });
  }

  txTransform(network, params) {
    let { block, transactions, txStatuses } = params;
    let height;
    let blockTime;
    let blockHash;

    if (block) {
      ({ blockHeight: height, blockTime, blockhash: blockHash } = block);
    }
    transactions = transactions || block.transactions;
    if (!transactions || transactions.length === 0) {
      return [];
    }

    return transactions.map((tx, index) => {
      blockTime = blockTime || tx?.blockTime

      const { meta, transaction, version } = tx;
      const txStatus = txStatuses?.[index];
      const slot = meta.slot || height || txStatus?.slot;
      const recentBlockhash = transaction.message.recentBlockhash || blockHash;
      const txid = transaction.signatures[0] || txStatus?.signature;
      const date = new Date((blockTime || 0) * 1000);
      const status = tx?.confirmationStatus || txStatus?.confirmationStatus;

      const fee = meta.fee;
      const feePayer = transaction.message.accountKeys.find((key) => key.signer)?.pubkey || '';
      const transactionError = meta.err ? { error: JSON.stringify(meta.err) } : null;
      const txType = version;
      // find instructions with parsed data
      const instruction = transaction.message.instructions?.find((key) => key.parsed)?.parsed;
      const category = instruction?.type;
      const to = instruction?.info?.destination;
      const value = Number(instruction?.info?.lamports) || 0;
      const tokenTransfers: any[] = []
      const accountData: any[] = [];
      const instructions: any[] = [];

      // Process instructions
      for (const instruction of transaction.message.instructions) {
        // Collect instruction data
        const outputInstruction = {
          accounts: instruction.accounts || [],
          data: instruction.data,
          programId: instruction.programId || '',
        };
        instructions.push(outputInstruction);
      }
      // Process token transfers
      if (meta.preTokenBalances.length > 0 && meta.postTokenBalances.length > 0) {
        for (const preTokenBalance of meta.preTokenBalances) {
          const postTokenBalance = meta.postTokenBalances.find(
            (ptb) => ptb.accountIndex === preTokenBalance.accountIndex && ptb.mint === preTokenBalance.mint
          );

          if (postTokenBalance) {
            const tokenAmountChange =
              Number(postTokenBalance.uiTokenAmount.amount) - Number(preTokenBalance.uiTokenAmount.amount);
            if (tokenAmountChange !== 0) {
              const fromTokenAccount = transaction.message.accountKeys[preTokenBalance.accountIndex].pubkey;
              const toTokenAccount = transaction.message.accountKeys[postTokenBalance.accountIndex].pubkey;

              tokenTransfers.push({
                fromTokenAccount,
                toTokenAccount,
                tokenAmount: tokenAmountChange,
                mint: preTokenBalance.mint,
              });
            }
          }
        }
      }
      // Process account data
      for (const [index, accountKey] of transaction.message.accountKeys.entries()) {
        const preBalance = meta.preBalances[index];
        const postBalance = meta.postBalances[index];
        const balanceChange = postBalance - preBalance;

        const _accountData = {
          account: accountKey.pubkey,
          nativeBalanceChange: balanceChange,
        };

        accountData.push(_accountData);
      };

      const outputTx = {
        chain: 'SOL',
        network,
        txid,
        category,
        from: feePayer,
        to,
        value: value || 0,
        fee,
        status,
        txType,
        blockHeight: slot,
        blockHash: recentBlockhash,
        blockTime: date,
        blockTimeNormalized: date,
        error: transactionError,
        tokenTransfers,
        accountData,
        instructions
      } as ISVMTransaction;

      // Move this into its own transaform function
      const baseTx = {
        txid: outputTx.txid,
        fee: outputTx.fee,
        height: outputTx.blockHeight,
        from: outputTx.from,
        category: outputTx.category,
        initialFrom: outputTx.from,
        txType: outputTx.txType,
        address: outputTx.to,
        blockTime: outputTx.blockTimeNormalized,
        error: outputTx.error,
        network: outputTx.network,
        chain: outputTx.chain,
        effects: outputTx.accountData,
        internal: outputTx.tokenTransfers,
        satoshis: outputTx.value
      } as any;

      if (outputTx.category == 'transfer') {
        const balanceChange = outputTx.accountData.filter(data => data?.account === outputTx.from)[0]?.nativeBalanceChange;
        console.log(balanceChange)
        if (outputTx.to === outputTx.from) {
          baseTx.category = 'move';
        } else if (balanceChange > 0) {
          baseTx.category = 'receive';
        } else {
          baseTx.category = 'send';
        }
      }

      return baseTx;
    });
  }

  async getBalanceForAddress(params: GetBalanceForAddressParams): Promise<{ confirmed: number; unconfirmed: number; balance: number }> {
    const { address, network } = params;
    const { rpc } = await this.getWeb3(network);
    const balance = await rpc.getBalance({ address })
    return { confirmed: 0, unconfirmed: 0, balance };
  }

  async getBlock(params: GetBlockParams): Promise<IBlock> {
    const { height, network } = params;
    const { rpc } = await this.getWeb3(network);
    return await rpc.getBlock({ height: Number(height) });
  }

  async getPriorityFee(params: GetEstimatePriorityFeeParams): Promise<any> {
    const { percentile, network } = params;
    const { rpc } = await this.getWeb3(network);
    const fee = await rpc.estimateMaxPriorityFee({ percentile });
    // TODO use the quicknode function if available
    return fee;
  }

  async broadcastTransaction(params: BroadcastTransactionParams): Promise<any> {
    const { rawTx, network } = params;
    const { rpc } = await this.getWeb3(network);
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
    const { connection } = await this.getWeb3(network);
    return await connection.getMinimumBalanceForRentExemption(Number(space));
  }

  async getCoinsForTx(_params: GetCoinsForTxParams): Promise<CoinListingJSON> {
    return {
      inputs: [],
      outputs: []
    };
  }

  async getLocalTip(params: any): Promise<IBlock> {
    const { network } = params;
    const { connection, rpc } = await this.getWeb3(network);
    const height = await connection.getSlot({ commitment: 'confirmed' });
    const block = await rpc.getBlock({ height });
    const txs = block?.transactions?.map(tx => tx?.transaction?.signatures[0]);
    return {
      chain: this.chain,
      network,
      height: block?.blockHeight,
      hash: block?.blockhash,
      time: new Date(block?.blockTime * 1000),
      timeNormalized: new Date(block?.blockTime * 1000),
      previousBlockHash: block?.previousBlockHash,
      transactions: txs,
      transactionCount:  block?.transactions?.length,
      size: block?.transactions?.length,
      reward: block?.rewards[0]?.lamports,
      processed: true,
    } as IBlock;
  }
}