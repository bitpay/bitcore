import { fetchDigitalAsset, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { PublicKey as UmiPublicKey } from '@metaplex-foundation/umi-public-keys';
import { TokenListProvider } from '@solana/spl-token-registry';
import { CryptoRpc } from 'crypto-rpc';
import { SolRpc } from 'crypto-rpc/lib/sol/SolRpc'
import { instructionKeys } from 'crypto-rpc/lib/sol/transaction-parser';
import Config from '../../../../config';
import logger from '../../../../logger';
import { CacheStorage } from '../../../../models/cache';
import { IBlock } from '../../../../types/Block';
import { CoinListingJSON } from '../../../../types/Coin';
import { IChainConfig, IProvider, ISVMNetworkConfig } from '../../../../types/Config';
import { BroadcastTransactionParams, GetBalanceForAddressParams, GetBlockParams, GetCoinsForTxParams, GetEstimatePriorityFeeParams, GetWalletBalanceParams, IChainStateService, StreamAddressUtxosParams, StreamBlocksParams, StreamTransactionParams, StreamTransactionsParams, StreamWalletTransactionsParams, WalletBalanceType, GetBlockBeforeTimeParams, GetWalletBalanceAtTimeParams } from '../../../../types/namespaces/ChainStateProvider';
import { range } from '../../../../utils';
import { TransformWithEventPipe } from '../../../../utils/streamWithEventPipe';
import {
  getProvider,
  isValidProviderType
} from '../../external/providers/provider';
import { ExternalApiStream } from '../../external/streams/apiStream';
import { InternalStateProvider } from '../../internal/internal';

export interface GetSolWeb3Response { rpc: SolRpc; connection: any; umi: any; dataType: string; };

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
    const provider = getProvider({ network, dataType, config: this.config });
    const wsPort = provider.wsPort ?? provider.port;
    const rpcConfig = { ...provider, chain: 'SOL', currencyConfig: {}, wsPort };
    const rpc = new CryptoRpc(rpcConfig, {}).get('SOL');
    const umi = createUmi(`${provider.protocol}://${provider.host}${provider.port ? `:${provider.port}` : ''}`)
      .use(mplTokenMetadata());
    const rpcObj = {
      rpc,
      connection: rpc.rpc,
      umi,
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
        const { rpc, connection } = await this.getRpc(network);
        try {
          if (rawTx) {
            feerate = await rpc.estimateFee({ nBlocks: target, rawTx })
          } else {
            const { height } = await rpc.getTip();
            const { transactions } = await connection.getBlock(height);
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
    if (!tx) return undefined;
    return this.txTransform(network, { tx });
  }

  async streamTransactions(params: StreamTransactionsParams): Promise<any> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const { chain, network, req, res, args } = params;
        let { blockHeight, limit = 50 } = args;

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
        const stream = new TransformWithEventPipe({
          objectMode: true,
          passThrough: true
        });
        let count = 0;
        for (const signature of block.signatures) {
          if (limit && count >= limit) break;
          const transformedTx = await this._getTransformedTx(rpc, network, { signature });
          stream.push(transformedTx);
          count++;
        }
        stream.push(null);
        const result = await ExternalApiStream.onStream(stream, req!, res!);
        if (!result?.success) {
          logger.error('Error mid-stream (streamTransactions): %o', result.error?.log || result.error);
        }  
        return resolve();
      } catch (err: any) {
        logger.error('Error streaming block transactions: %o', err.stack || err.message || err);
        reject(err);
      }
    });
  }

  async streamAddressTransactions(params: StreamAddressUtxosParams) {
    return new Promise<void>(async (resolve, reject) => {
      const { req, res } = params;
      try {
        const addressStream = await this._buildAddressTransactionsStream(params);
        const result = await ExternalApiStream.onStream(addressStream, req!, res!, { jsonl: true });
        if (!result?.success) {
          logger.error('Error mid-stream (streamAddressTransactions): %o', result.error?.log || result.error);
        }  
        return resolve();
      } catch (err) {
        return reject(err);
      }
    });
  }

  async streamWalletTransactions(params: StreamWalletTransactionsParams): Promise<any> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const { wallet, req, res } = params;
        const walletStream = new TransformWithEventPipe({ objectMode: true, passThrough: true });
        const walletAddresses = (await this.getWalletAddresses(wallet._id!)).map(waddress => waddress.address);
        const addressStreams: TransformWithEventPipe[] = [];

        for (const address of walletAddresses) {
          const addressStream = await this._buildAddressTransactionsStream({ ...params, address });
          addressStreams.push(addressStream);
        }
        ExternalApiStream.mergeStreams(addressStreams, walletStream);
        const result = await ExternalApiStream.onStream(walletStream, req!, res!, { jsonl: true });
        if (!result?.success) {
          logger.error('Error mid-stream (streamWalletTransactions): %o', result.error?.log || result.error);
        }
        return resolve();
      } catch (err: any) {
        logger.error('Error streaming wallet transactions: %o', err.stack || err.message || err);
        return reject(err);
      }
    });
  }

  async _buildAddressTransactionsStream(params: StreamAddressUtxosParams) {
    const { args, network, address } = params;
    const { limit = 50 } = args;
    const tokenAddress = args?.tokenAddress || args?.mintAddress;
    const addressStream = new TransformWithEventPipe({
      objectMode: true,
      passThrough: true,
      read() {}  // no-op; we’ll push manually
    });
    (async () => {
      try {
        const { rpc, connection } = await this.getRpc(network);
        let before;
        let count = 0;
        let _address = address
        if (tokenAddress) {
          try {
            const { rpc } = await this.getRpc(network);
            _address =  await rpc.getConfirmedAta({ solAddress: address, mintAddress: tokenAddress });
            if (!_address) throw new Error('Missing ATA');
          } catch (e: any) {
            const errMsg = 'Error getting ATA address';
            logger.error(`${errMsg} %o`, e.stack || e.message || e);
            throw new Error(errMsg);
          }
        }
        do {
          // fetch the next page of signatures
          const txlimit = Math.min(100, limit);
          const txList = await connection.getSignaturesForAddress(_address, { limit: txlimit, before }).send();
          if (!txList.length) break;
          before = txList[txList.length - 1].signature;

          for (const tx of txList.reverse()) {
            if (limit && count >= limit) break;
            const transformedTx = await this._getTransformedTx(rpc, network, tx, _address, tokenAddress);
            if (transformedTx) {
              addressStream.push(JSON.stringify(transformedTx) + '\n');
              count++;
            }
          }
        } while (!limit || count < limit);

        addressStream.push(null);
      } catch (err) {
        addressStream.emit('error', err);
      }
    })();
    return addressStream;
  }

  async _getTransformedTx(rpc, network, tx, address?, tokenAddress? ) {
    try {
      const parsedTx = await rpc.getTransaction({ txid: tx.signature });
      return this.txTransform(network, { txStatuses: tx, tx: parsedTx, targetAddress: address, tokenAddress });
    } catch (err: any) {
      return {
        error: err?.message,
        txid: tx.signature,
        network,
        chain: 'SOL',
        status: tx?.confirmationStatus,
        height: Number(tx.slot)
      }
    }
  }


  txTransform(network, params) {
    let { block, tx, txStatus, targetAddress, tokenAddress } = params;
    let blockTime;
    let blockHash;

    if (block) {
      ({ blockHeight: blockTime, blockTime, blockhash: blockHash } = block);
    }

    blockTime = blockTime || tx?.blockTime

    const { feePayerAddress, slot, meta, version, txid } = tx;
    const recentBlockhash = tx.lifetimeConstraint.blockhash || blockHash;
    const date = new Date((blockTime || 0) * 1000);
    const status = tx.status || txStatus?.confirmationStatus;
    const error = meta?.err || txStatus?.err;
    const transactionError = error ? { error: JSON.stringify(error, (_, v) => typeof v === 'bigint' ? v.toString() : v) } : null;
    const txType = version;
    const instructions = tx.instructions;
    const fee = meta?.fee;
    const from = feePayerAddress;
    const target = targetAddress || from;
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
      if (!tokenAddress) {
        const relevantTransfers = targetAddress ? solTransfers.filter(transfer => [transfer.destination, transfer.source].includes(targetAddress)) : solTransfers;
        value = relevantTransfers.reduce((sum, transfer) => sum + Number(transfer.amount), 0);
      }
    }

    const transferTokenInstructions = instructions?.[instructionKeys.TRANSFER_TOKEN] || [];
    const transferCheckedTokenInstructions = instructions?.[instructionKeys.TRANSFER_CHECKED_TOKEN] || [];
    const allTokenTransfers = [...transferTokenInstructions, ...transferCheckedTokenInstructions];

    if (allTokenTransfers.length > 0) {
      const filteredTransferCheckedToken = tokenAddress ? transferCheckedTokenInstructions.filter(transfer => tokenAddress.toLowerCase() === transfer.mint.toLowerCase()) : transferCheckedTokenInstructions;
      const tokenTransfers = [...transferTokenInstructions, ...filteredTransferCheckedToken];
      if (!tokenTransfers?.length) {
        return;
      }
      if (tokenAddress || !mainToAddress) {
        mainToAddress = tokenTransfers.find(transfer =>
          transfer.destination !== from)?.destination || null;
      }
      for (const transfer of tokenTransfers) {
        if (transfer.destination !== from) {
          recipientAddresses.add(transfer.destination);
        }
      };
      if (tokenAddress) {
        const relevantTransfers = targetAddress ? tokenTransfers.filter(transfer => [transfer.destination, transfer.source].includes(targetAddress)) : tokenTransfers;
        value = relevantTransfers.reduce((sum, transfer) => sum + Number(transfer.amount), 0);
      }
    }

    const allRecipients = Array.from(recipientAddresses);
    let txCategory = 'other';

    if (instructions?.[instructionKeys.TRANSFER_SOL]?.length > 0 ||
      allTokenTransfers.length > 0) {
      if (allRecipients.length === 0) {
        txCategory = 'move';
      } else {
        const solSentOut = instructions?.[instructionKeys.TRANSFER_SOL]?.some(transfer =>
          transfer.source === target && transfer.destination !== target) || false;
        const tokensSentOut = allTokenTransfers.some(transfer =>
          transfer.source === target && transfer.destination !== target) || false;
        const solReceived = instructions?.[instructionKeys.TRANSFER_SOL]?.some(transfer =>
          transfer.destination === target && transfer.source !== target) || false;
        const tokensReceived = allTokenTransfers.some(transfer =>
          transfer.destination === target && transfer.source !== target) || false;

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
  }

  async getWalletBalanceAtTime(params: GetWalletBalanceAtTimeParams): Promise<WalletBalanceType> {
    const { network, time } = params;
    if (time) {
      if (params.args) {
        params.args.time = time;
      } else {
        params.args = { time };
      }
    }
    if (params.wallet._id === undefined) {
      throw new Error('Wallet balance can only be retrieved for wallets with the _id property');
    }
    let addresses = await this.getWalletAddresses(params.wallet._id);
    let addressBalancePromises = addresses.map(({ address }) =>
      this.getBalanceForAddress({ chain: this.chain, network, address, args: params.args })
    );
    let addressBalances = await Promise.all<WalletBalanceType>(
      addressBalancePromises
    );
    let balance = addressBalances.reduce(
      (prev, cur) => ({
        unconfirmed: BigInt(prev.unconfirmed) + BigInt(cur.unconfirmed),
        confirmed: BigInt(prev.confirmed) + BigInt(cur.confirmed),
        balance: BigInt(prev.balance) + BigInt(cur.balance)
      }),
      { unconfirmed: 0n, confirmed: 0n, balance: 0n }
    );
    return {
      unconfirmed: Number(balance.unconfirmed),
      confirmed: Number(balance.confirmed),
      balance: Number(balance.balance)
    };;
  }

  async getBalanceForAddress(params: GetBalanceForAddressParams): Promise<WalletBalanceType> {
    const { chain, address, network, args } = params;
    const { rpc, connection } = await this.getRpc(network);
    const tokenAddress = args?.tokenAddress || args?.mintAddress;
    if (args?.time) {
      const block = await this.getBlockBeforeTime({ chain, network, time: args.time });
      if (!block) {
        throw new Error(`Balance not found at ${args.time}`);
      }
      const sigInBlock = block.transactions?.[0];
      if (!sigInBlock) {
        throw new Error(`Balance not found at ${args.time}`);
      }
      let ata;
      if (tokenAddress) {
        ata = await rpc.getConfirmedAta({ solAddress: address, mintAddress: tokenAddress });
        if (!ata) {
          throw new Error('Missing ATA');
        }
      }
      const txList = await connection.getSignaturesForAddress(ata || address, { limit: 1, before: sigInBlock }).send();
      if (!txList.length || !txList[0]?.signature) {
        throw new Error(`Balance not found at ${args.time}`);
      }
      const tx = await rpc.getTransaction({ txid: txList[0].signature });
      if (!tx) {
        throw new Error(`Balance not found at ${args.time}`);
      }
      const index = tx.accountKeys?.findIndex(acct => acct == address);
      if (!index || index === -1) {
        throw new Error(`Balance not found at ${args.time}`);
      }
      let balance;
      if (tokenAddress) {
        const tokenBalance = tx.meta?.postTokenBalances?.find(tb => tb.accountIndex === index && tb.mint.toLowerCase() === tokenAddress.toLowerCase());
        const decimals = tokenBalance?.uiTokenAmount?.decimals;
        balance = (tokenBalance?.uiTokenAmount?.uiAmount || 0) * (10 ** decimals) || null;
      } else {
        balance = tx.meta?.postBalances ? tx.meta.postBalances[index] : null;
      }
      if (balance === null) {
        throw new Error(`Balance not found at ${args.time}`);
      }
      return { confirmed: Number(balance), unconfirmed: 0, balance: Number(balance) };
    }
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
    const slot = Number(height || blockId);
    const block = await rpc.getBlock({ height: slot });
    return this.blockTransform(network, block, slot);
  }

  async getBlockBeforeTime(params: GetBlockBeforeTimeParams): Promise<IBlock | null> {
    const { network, time = new Date() } = params;
    const { rpc } = await this.getRpc(network);
    const beforeTimeSlot = await this._findSlotByDate(network, new Date(time));
    if (!beforeTimeSlot) {
      return null;
    }
    const block = await rpc.getBlock({ height: beforeTimeSlot });
    return this.blockTransform(network, block, beforeTimeSlot);
  }

  async streamBlocks(params: StreamBlocksParams) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const { chain, network, req, res } = params;
        if (!chain || !network) {
          throw new Error('Missing chain or network');
        }
        const { rpc } = await this.getRpc(network);
        const blockRange = await this.getBlocksRange({ ...params });
        const { height } = await rpc.getTip();
        const stream = new TransformWithEventPipe({
          objectMode: true,
          passThrough: true
        });
        let count = 0;
        try {
          let block;
          let nextBlock;
          for (const blockNum of blockRange) {
            const thisNextBlock = Number(block?.height) === blockNum + 1 ? block :  await this._getTransformedBlock(rpc, network, blockNum + 1);
            block = Number(nextBlock?.number) === blockNum ? nextBlock : await this._getTransformedBlock(rpc, network, blockNum);
            if (!block) {
              continue;
            }
            nextBlock = thisNextBlock;
            block.nextBlockHash = nextBlock?.hash;
            block.confirmations = height - block.height + 1;
            stream.push(block);
            count++;
          }
        } catch (e: any) {
          logger.error('Error streaming blocks: %o', e);
        }
        stream.push(null);
        const result = await ExternalApiStream.onStream(stream, req!, res!, { jsonl: true });
        if (!result?.success) {
          logger.error('Error mid-stream (streamBlocks): %o', result.error?.log || result.error);
        }  
        return resolve();
      } catch (err: any) {
        logger.error('Error streaming blocks: %o', err.stack || err.message || err);
        reject(err);
      }
    });

  }

  async _getTransformedBlock(rpc, network, height ) {
    const block = await rpc.getBlock({ height: Number(height) });
    try {
      return this.blockTransform(network, block, height);
    } catch (err: any) {
      return {
        error: err?.message,
        height,
        network,
        chain: 'SOL',
        status: block?.confirmationStatus,
      }
    }
  }

  blockTransform(network, block, height) {
    return {
      chain: this.chain,
      network,
      height: Number(height),
      hash: block?.blockhash,
      time: new Date(Number(block?.blockTime) * 1000),
      timeNormalized: new Date(Number(block?.blockTime) * 1000),
      previousBlockHash: block?.previousBlockHash,
      transactions: block?.signatures,
      transactionCount: block?.signatures?.length,
      size: block?.transactions?.length,
      reward: Number(block?.rewards[0]?.lamports),
      processed: true,
    } as IBlock;
  }

  protected async getBlocksRange(params: GetBlockParams) {
    const { chain, network, sinceBlock, args = {} } = params;
    let { blockId } = params;
    let { startDate, endDate, date, limit = 10, sort = { height: -1 } } = args;
    const query: { startBlock?: number; endBlock?: number } = {};
    if (!chain || !network) {
      throw new Error('Missing required chain and/or network param');
    }
  
    // limit - 1 because startBlock is inclusive; ensure limit is >= 0
    limit = Math.max(limit - 1, 0);

    let height: number | null = null;  
    if (date) {
      startDate = new Date(date);
      endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
    }
    if (startDate || endDate) {
      if (startDate) {
        query.startBlock = await this._findSlotByDate(network, startDate) || 0;
      }
      if (endDate) {
        query.endBlock = await this._findSlotByDate(network, endDate) || 0;
      }
    }

    // Get range
    if (sinceBlock) {
      let height = Number(sinceBlock);
      if (isNaN(height) || height.toString(10) != sinceBlock) {
        throw new Error('invalid block id provided');
      }
      const { rpc } = await this.getRpc(network);
      const { height: _height } = await rpc.getTip();
      const tipHeight = Number(_height) || 0;
      if (tipHeight < height) {
        return [];
      }
      if (!tipHeight) {
        throw new Error('unable to fetch tip height');
      }
      query.endBlock = query.endBlock ?? tipHeight;
      query.startBlock = query.startBlock ?? query.endBlock - limit;
    } else if (blockId) {
      height =  Number(blockId);
    }

    if (height != null) {
      query.startBlock = height;
      query.endBlock = height + limit;
    }

    if (query.startBlock == null || query.endBlock == null) {
      // Calaculate range with options
      const { rpc } = await this.getRpc(network);
      const { height: _height } = await rpc.getTip();
      const tipHeight = Number(_height) || 0;
      query.endBlock = query.endBlock ?? tipHeight;
      query.startBlock = query.startBlock ?? query.endBlock - limit;
    }

    if (query.endBlock - query.startBlock > limit) {
      query.endBlock = query.startBlock + limit;
    }

    const r = range(query.startBlock, query.endBlock + 1); // +1 since range is [start, end)

    if (sort?.height === -1 && query.startBlock < query.endBlock) {
      return r.reverse();
    }
    return r;
  }

  async _findSlotByDate(network: string,  targetDate: Date): Promise<number | null> {
    const { connection } = await this.getRpc(network);
    let lo = await connection.getFirstAvailableBlock().send(); 
    let hi = await connection.getSlot({ commitment: 'finalized' }).send();
    let result: bigint | null = null;
    const targetTime = Math.floor(targetDate.getTime() / 1000);
    const loBlockTime = await connection.getBlockTime(lo).send();
    if (loBlockTime !== null && loBlockTime >= targetTime) {
      return lo;
    }

    let errorCount = 0;
    while (lo <= hi) {
      const mid = (lo + hi) / 2n;
      let blockTime: number | null = null;
      try {
        blockTime = await connection.getBlockTime(mid).send();
        if (errorCount > 0) {
          errorCount = 0; // reset error count on successful fetch
        }
      } catch (e: any) {
        // possible rate limit exceeded
        errorCount++;
        if (errorCount >= 5) {
          throw new Error(e?.message || 'Too many errors occurred');
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
  
      if (blockTime === null) {
        lo = mid + 1n;
      } else if (blockTime < targetTime) {
        lo = mid + 1n;
      } else {
        result = mid;
        hi = mid - 1n;
      }
    }
  
    return Number(result) || null;
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
    const txids = new Array<string>();
    const rawTxs = typeof rawTx === 'string' ? [rawTx] : rawTx;
    for (const tx of rawTxs) {
      const txid = await rpc.sendRawTransaction({ rawTx: tx });
      txids.push(txid);
    }
    return txids.length === 1 ? txids[0] : txids;
  }

  async getWalletBalance(params: GetWalletBalanceParams): Promise<WalletBalanceType> {
    const { network } = params;
    if (params.wallet._id === undefined) {
      throw new Error('Wallet balance can only be retrieved for wallets with the _id property');
    }
    let addresses = await this.getWalletAddresses(params.wallet._id);
    let addressBalancePromises = addresses.map(({ address }) =>
      this.getBalanceForAddress({ chain: this.chain, network, address, args: params.args })
    );
    let addressBalances = await Promise.all<WalletBalanceType>(
      addressBalancePromises
    );
    let balance = addressBalances.reduce(
      (prev, cur) => ({
        unconfirmed: BigInt(prev.unconfirmed) + BigInt(cur.unconfirmed),
        confirmed: BigInt(prev.confirmed) + BigInt(cur.confirmed),
        balance: BigInt(prev.balance) + BigInt(cur.balance)
      }),
      { unconfirmed: 0n, confirmed: 0n, balance: 0n }
    );
    return {
      unconfirmed: Number(balance.unconfirmed),
      confirmed: Number(balance.confirmed),
      balance: Number(balance.balance)
    };;
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

 async getSPLTokenInfo(
    network: string, 
    tokenAddress: string
  ): Promise<{ name: string; symbol: string; decimals: number }> {
    const { umi } = await this.getRpc(network);
    let decimals;
    let name = '';
    let symbol = '';
    try {
      let error;
      let token;
      try {
        token = await fetchDigitalAsset(umi, tokenAddress as UmiPublicKey);
      } catch (e) {
        error = e;
      }
      
      if (token) {
        name = token.metadata.name;
        symbol = token.metadata.symbol;
        decimals = token.mint.decimals;
      } else {
        // If a token doesn't use the Token Metadata Standard (above), it uses the Solana Labs Token List (below). 
        // This list is obsolete since June 20,2022
        const provider = await new TokenListProvider().resolve();
        const networkId = {
          mainnet: 101,
          testnet: 102,
          devnet: 103
        }
        const tokenList = provider.filterByChainId(networkId[network]).getList();
        const tokenMap = tokenList.reduce((map, item) => {
          map.set(item.address, item);
          return map;
        }, new Map());

        token = tokenMap.get(tokenAddress);

        name = token?.name;
        symbol = token?.symbol;
        decimals = token?.decimals;

        if (!token && error) {
          throw error;
        }
      }
    } catch (err) {
      logger.error('Error getting SPL token info: %o', err);
    }
    return { name, symbol, decimals };
  }

  async getLocalTip(params: any): Promise<IBlock> {
    const { network } = params;
    const { rpc, connection } = await this.getRpc(network);
    const height = await connection.getSlot({ commitment: 'confirmed' }).send();
    const block = await rpc.getBlock({ height });
    return this.blockTransform(network, block, height);
  }

  validateRawTx(rawTx: string) {
    const MAX_TRANSACTION_SIZE = 1232; // Solana's packet size limit
    const MIN_TRANSACTION_SIZE = 64;

    if (!rawTx) {
      throw new Error('Missing raw transaction string')
    }
    if (!(Buffer.from(rawTx, 'base64').toString('base64') === rawTx)) {
      throw new Error('Invalid base64 encoding');
    }

    const buffer = Buffer.from(rawTx, 'base64');

    if (buffer.length > MAX_TRANSACTION_SIZE) {
      throw new Error(`Transaction size (${buffer.length}) exceeds maximum (${MAX_TRANSACTION_SIZE})`);
    }
    if (buffer.length < MIN_TRANSACTION_SIZE) {
      throw new Error('Transaction too small to be valid');
    }
    return true;
  }

  async decodeRawTransaction(params: any): Promise<any> {
    const { network, rawTx } = params;
    const { rpc } = await this.getRpc(network);
    const decodedTx =  await rpc.decodeRawTransaction({ rawTx });
    return decodedTx ? JSON.parse(JSON.stringify(decodedTx, (_, v) => typeof v === 'bigint' ? v.toString() : v)) : null;
  }
}
