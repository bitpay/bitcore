#!/usr/bin/env node

import { CryptoRpc } from '@bitpay-labs/crypto-rpc';
import { WalletAddressStorage } from '../src/models/walletAddress';
import {
  ERC20_EFFECTS_VERSION,
  attachErc20EffectsToTransactions,
  erc20EffectsEqual,
  fetchTransferLogsForBlock,
  getCanonicalErc20ParticipantAddresses,
  isValidErc20EffectsForTransaction,
  semanticHashEquals
} from '../src/providers/chain-state/evm/erc20Effects';
import { EVMBlockStorage } from '../src/providers/chain-state/evm/models/block';
import { EVMTransactionStorage } from '../src/providers/chain-state/evm/models/transaction';
import { Rpcs } from '../src/providers/chain-state/evm/p2p/rpcs';
import { Config } from '../src/services/config';
import { Storage } from '../src/services/storage';
import type { MongoBound } from '../src/models/base';
import type { IRpc } from '../src/providers/chain-state/evm/p2p/rpcs';
import type { Erc20Effects, IEVMBlock, IEVMTransaction } from '../src/providers/chain-state/evm/types';
import type { IEVMNetworkConfig, IProvider } from '../src/types/Config';

type StoredEvmTransaction = MongoBound<IEVMTransaction> & Required<Pick<MongoBound<IEVMTransaction>, '_id'>>;
const HEX_TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/;

export interface BackfillOptions {
  chain: string;
  network: string;
  startHeight: number;
  endHeight: number;
  dryRun: boolean;
  concurrency: number;
  delayMs: number;
  forceCurrentVersion: boolean;
}

interface BlockBackfillStats {
  height: number;
  transactions: number;
  updated: number;
  skippedCurrent: number;
  skippedNewer: number;
  dryRunWouldUpdate: number;
  racedConverged: number;
  supportedTransferLogs: number;
  unsupportedTransferLogs: number;
}

let shuttingDown = false;

function registerShutdownHandlers() {
  const requestShutdown = () => {
    shuttingDown = true;
    console.error('Stopping after the current bounded batch...');
  };
  process.on('SIGINT', requestShutdown);
  process.on('SIGTERM', requestShutdown);
}

function usage(message?: string): never {
  if (message) {
    console.error(`ERROR: ${message}\n`);
  }
  console.error('Usage: node build/scripts/backfillErc20Effects.js [options]');
  console.error('  --chain <value>                 REQUIRED (for example ETH or MATIC)');
  console.error('  --network <value>               REQUIRED');
  console.error('  --start-height <value>          REQUIRED, inclusive');
  console.error('  --end-height <value>            REQUIRED, inclusive');
  console.error('  --dry-run                       Validate and report without writes');
  console.error('  --concurrency <value>            Max transaction updates in flight per block (default 4)');
  console.error('  --delay-ms <value>               Delay between blocks (default 100)');
  console.error('  --force-current-version          Re-publish valid version-1 rows');
  process.exit(1);
}

function optionValue(args: string[], name: string) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function parseBackfillOptions(args: string[]): BackfillOptions {
  const chain = optionValue(args, '--chain')?.toUpperCase();
  const network = optionValue(args, '--network')?.toLowerCase();
  const startHeight = Number(optionValue(args, '--start-height'));
  const endHeight = Number(optionValue(args, '--end-height'));
  const concurrency = optionValue(args, '--concurrency') === undefined ? 4 : Number(optionValue(args, '--concurrency'));
  const delayMs = optionValue(args, '--delay-ms') === undefined ? 100 : Number(optionValue(args, '--delay-ms'));

  if (!chain || !network) {
    throw new Error('chain and network are required');
  }
  if (!Number.isSafeInteger(startHeight) || startHeight < 0) {
    throw new Error('start-height must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(endHeight) || endHeight < startHeight) {
    throw new Error('end-height must be a safe integer greater than or equal to start-height');
  }
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 100) {
    throw new Error('concurrency must be an integer from 1 through 100');
  }
  if (!Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > 60000) {
    throw new Error('delay-ms must be an integer from 0 through 60000');
  }

  return {
    chain,
    network,
    startHeight,
    endHeight,
    dryRun: args.includes('--dry-run'),
    concurrency,
    delayMs,
    forceCurrentVersion: args.includes('--force-current-version')
  };
}


function getBackfillChainConfig(options: Pick<BackfillOptions, 'chain' | 'network'>): IEVMNetworkConfig {
  const chains = Config.get().chains as Record<string, Record<string, IEVMNetworkConfig> | undefined>;
  const config = chains[options.chain]?.[options.network];
  if (!config) {
    throw new Error(`No configuration found for ${options.chain}:${options.network}`);
  }
  return config;
}

function providerForBackfill(config: IEVMNetworkConfig): IProvider {
  if (config.provider && !config.provider.disabled) {
    return config.provider;
  }
  const providers = (config.providers || []).filter(provider => !provider.disabled);
  const historical = providers.find(provider => provider.dataType === 'historical' || provider.dataType === 'combined');
  if (historical) {
    return historical;
  }
  if (providers[0]) {
    return providers[0];
  }
  throw new Error('No enabled EVM RPC provider is configured');
}

async function connectRpc(options: BackfillOptions, config: IEVMNetworkConfig): Promise<IRpc> {
  const providerConfig = providerForBackfill(config);
  const rpcConfig = { ...providerConfig, chain: options.chain, isEVM: true, currencyConfig: {} };
  const web3 = new CryptoRpc(rpcConfig as any).get(options.chain).web3;
  let client = config.client;
  if (!client) {
    const nodeInfo = await web3.eth.getNodeInfo();
    const detected = nodeInfo.split('/')[0].toLowerCase();
    client = detected === 'erigon' ? 'erigon' : 'geth';
  }
  return new Rpcs[client](web3);
}

export function buildBackfillTransactionFilter(params: {
  tx: StoredEvmTransaction;
  observedErc20Effects: Erc20Effects | undefined;
}) {
  const { tx, observedErc20Effects } = params;
  const observedPredicate = observedErc20Effects === undefined
    ? { erc20Effects: { $exists: false } }
    : { erc20Effects: observedErc20Effects };

  return {
    _id: tx._id,
    chain: tx.chain,
    network: tx.network,
    txid: tx.txid,
    blockHeight: tx.blockHeight,
    blockHash: tx.blockHash,
    $and: [
      {
        $or: [
          { 'erc20Effects.version': { $exists: false } },
          { 'erc20Effects.version': { $lte: ERC20_EFFECTS_VERSION } }
        ]
      },
      observedPredicate
    ]
  };
}

function cloneErc20Effects(value: Erc20Effects | undefined) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Erc20Effects;
}

async function loadCanonicalBlock(options: BackfillOptions, height: number) {
  const blocks = await EVMBlockStorage.collection
    .find({ chain: options.chain, network: options.network, height, processed: true })
    .limit(2)
    .toArray();
  if (blocks.length !== 1) {
    throw new Error(`Expected exactly one processed local block at height ${height}; found ${blocks.length}`);
  }
  return blocks[0] as MongoBound<IEVMBlock>;
}

export function validateLocalBlockTransactions(
  block: Pick<IEVMBlock, 'hash' | 'height' | 'transactionCount'>,
  transactions: Array<StoredEvmTransaction>
) {
  if (transactions.length !== block.transactionCount) {
    throw new Error(
      `Local transaction count mismatch at height ${block.height}: block=${block.transactionCount}, rows=${transactions.length}`
    );
  }
  const txids = new Set<string>();
  const transactionIndexes = new Set<number>();
  for (const tx of transactions) {
    if (tx.blockHash?.toLowerCase() !== block.hash.toLowerCase()) {
      throw new Error(`Transaction ${tx.txid} has inconsistent inclusion at height ${block.height}`);
    }
    const txid = tx.txid.toLowerCase();
    if (txids.has(txid)) {
      throw new Error(`Duplicate local transaction ${tx.txid} at height ${block.height}`);
    }
    txids.add(txid);

    const transactionIndex = typeof tx.transactionIndex === 'number'
      ? tx.transactionIndex
      : Number(tx.transactionIndex);
    if (
      !Number.isSafeInteger(transactionIndex) ||
      transactionIndex < 0 ||
      transactionIndex >= block.transactionCount ||
      transactionIndexes.has(transactionIndex)
    ) {
      throw new Error(`Transaction ${tx.txid} has invalid transactionIndex at height ${block.height}`);
    }
    transactionIndexes.add(transactionIndex);
  }
  transactions.sort((left, right) => Number(left.transactionIndex) - Number(right.transactionIndex));
  return transactions;
}

function rpcTransactionHash(value: unknown, height: number, transactionIndex: number) {
  const hash = typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? (value as any).hash
      : undefined;
  if (typeof hash !== 'string' || !HEX_TRANSACTION_HASH.test(hash)) {
    throw new Error(`RPC block at height ${height} has a missing or malformed transaction hash at index ${transactionIndex}`);
  }
  return hash.toLowerCase();
}

export function validateRpcBlockTransactions(
  block: Pick<IEVMBlock, 'hash' | 'height' | 'transactionCount'>,
  transactions: Array<StoredEvmTransaction>,
  rpcBlock: unknown
) {
  if (!rpcBlock || typeof rpcBlock !== 'object' || !semanticHashEquals((rpcBlock as any).hash, block.hash)) {
    throw new Error(`RPC block identity changed before persistence at height ${block.height}`);
  }
  const rpcTransactions = (rpcBlock as any).transactions;
  if (!Array.isArray(rpcTransactions)) {
    throw new Error(`RPC block at height ${block.height} is missing transaction membership`);
  }
  if (rpcTransactions.length !== block.transactionCount || rpcTransactions.length !== transactions.length) {
    throw new Error(
      `RPC transaction count mismatch at height ${block.height}: block=${block.transactionCount}, rpc=${rpcTransactions.length}, local=${transactions.length}`
    );
  }

  const seenRpcTransactionHashes = new Set<string>();
  for (let transactionIndex = 0; transactionIndex < rpcTransactions.length; transactionIndex++) {
    const rpcTxid = rpcTransactionHash(rpcTransactions[transactionIndex], block.height, transactionIndex);
    if (seenRpcTransactionHashes.has(rpcTxid)) {
      throw new Error(`Duplicate RPC transaction ${rpcTxid} at height ${block.height}`);
    }
    seenRpcTransactionHashes.add(rpcTxid);

    const local = transactions[transactionIndex];
    if (
      Number(local.transactionIndex) !== transactionIndex ||
      typeof local.txid !== 'string' ||
      !HEX_TRANSACTION_HASH.test(local.txid) ||
      !semanticHashEquals(local.txid, rpcTxid)
    ) {
      throw new Error(
        `RPC transaction membership mismatch at height ${block.height}, index ${transactionIndex}: local=${local.txid}, rpc=${rpcTxid}`
      );
    }
  }
}

export async function assertRpcBlockTransactions(
  rpc: IRpc,
  block: Pick<IEVMBlock, 'hash' | 'height' | 'transactionCount'>,
  transactions: Array<StoredEvmTransaction>
) {
  const rpcBlock = await rpc.getBlock(block.height);
  validateRpcBlockTransactions(block, transactions, rpcBlock);
}

export function materializeBackfillTransactions(params: {
  block: Pick<IEVMBlock, 'hash' | 'height' | 'transactionCount'>;
  transactions: Array<StoredEvmTransaction>;
  logs: unknown;
}) {
  return attachErc20EffectsToTransactions(params);
}

async function loadAndValidateBlockTransactions(options: BackfillOptions, block: MongoBound<IEVMBlock>) {
  const transactions = await EVMTransactionStorage.collection
    .find({ chain: options.chain, network: options.network, blockHeight: block.height })
    .sort({ transactionIndex: 1, txid: 1 })
    .toArray() as Array<StoredEvmTransaction>;
  return validateLocalBlockTransactions(block, transactions);
}

async function walletIdsByAddress(options: BackfillOptions, transactions: Array<StoredEvmTransaction>) {
  const addresses = new Set<string>();
  for (const tx of transactions) {
    for (const address of getCanonicalErc20ParticipantAddresses(tx)) {
      addresses.add(address);
      addresses.add(address.toLowerCase());
    }
  }
  if (!addresses.size) {
    return new Map<string, any[]>();
  }

  const rows = await WalletAddressStorage.collection.find({
    chain: options.chain,
    network: options.network,
    address: { $in: Array.from(addresses) }
  }).toArray();
  const byAddress = new Map<string, any[]>();
  for (const row of rows) {
    const key = row.address.toLowerCase();
    const wallets = byAddress.get(key) || [];
    if (!wallets.some(wallet => wallet.toHexString() === row.wallet.toHexString())) {
      wallets.push(row.wallet);
    }
    byAddress.set(key, wallets);
  }
  return byAddress;
}

function walletsForTransaction(tx: StoredEvmTransaction, byAddress: Map<string, any[]>) {
  const wallets = new Map<string, any>();
  for (const address of getCanonicalErc20ParticipantAddresses(tx)) {
    for (const wallet of byAddress.get(address.toLowerCase()) || []) {
      wallets.set(wallet.toHexString(), wallet);
    }
  }
  return Array.from(wallets.values());
}

export function getBackfillDisposition(params: {
  tx: StoredEvmTransaction;
  observedErc20Effects: Erc20Effects | undefined;
  forceCurrentVersion: boolean;
}) {
  const { tx, observedErc20Effects, forceCurrentVersion } = params;
  const observedVersion = observedErc20Effects?.version;
  if (typeof observedVersion === 'number' && observedVersion > ERC20_EFFECTS_VERSION) {
    return 'skipped-newer' as const;
  }
  if (!forceCurrentVersion && observedErc20Effects !== undefined && isValidErc20EffectsForTransaction(tx, observedErc20Effects)) {
    return 'skipped-current' as const;
  }
  return 'write' as const;
}

export async function updateBackfillTransaction(params: {
  options: BackfillOptions;
  tx: StoredEvmTransaction;
  observedErc20Effects: Erc20Effects | undefined;
  wallets: any[];
}) {
  const { options, tx, observedErc20Effects, wallets } = params;
  const newErc20Effects = tx.erc20Effects!;
  const disposition = getBackfillDisposition({
    tx,
    observedErc20Effects,
    forceCurrentVersion: options.forceCurrentVersion
  });
  if (disposition !== 'write') {
    return disposition;
  }
  if (options.dryRun) {
    return 'dry-run' as const;
  }

  const update: any = { $set: { erc20Effects: newErc20Effects } };
  if (wallets.length) {
    update.$addToSet = { wallets: { $each: wallets } };
  }
  const result = await EVMTransactionStorage.collection.updateOne(
    buildBackfillTransactionFilter({ tx, observedErc20Effects }),
    update
  );
  const matchedCount = result.matchedCount ?? result.result?.n ?? 0;
  const modifiedCount = result.modifiedCount ?? result.result?.nModified ?? 0;
  if (!matchedCount) {
    const current = await EVMTransactionStorage.collection.findOne({ _id: tx._id });
    if (
      current &&
      current.chain === tx.chain &&
      current.network === tx.network &&
      current.txid?.toLowerCase() === tx.txid?.toLowerCase() &&
      current.blockHeight === tx.blockHeight &&
      current.blockHash?.toLowerCase() === tx.blockHash?.toLowerCase() &&
      isValidErc20EffectsForTransaction(current) &&
      erc20EffectsEqual(current.erc20Effects, newErc20Effects)
    ) {
      if (wallets.length) {
        const walletResult = await EVMTransactionStorage.collection.updateOne(
          {
            _id: current._id,
            chain: current.chain,
            network: current.network,
            txid: current.txid,
            blockHeight: current.blockHeight,
            blockHash: current.blockHash,
            erc20Effects: current.erc20Effects
          },
          { $addToSet: { wallets: { $each: wallets } } }
        );
        const walletMatchedCount = walletResult.matchedCount ?? walletResult.result?.n ?? 0;
        if (!walletMatchedCount) {
          throw new Error(`Inclusion/version CAS lost while merging wallets for transaction ${tx.txid}`);
        }
      }
      return 'raced-converged' as const;
    }
    throw new Error(`Inclusion/version CAS lost for transaction ${tx.txid}`);
  }

  if (modifiedCount) {
    await EVMTransactionStorage.expireErc20BalanceCacheForTransaction({
      chain: options.chain,
      network: options.network,
      tx
    });
  }
  return 'updated' as const;
}

export async function processBlock(options: BackfillOptions, rpc: IRpc, height: number): Promise<BlockBackfillStats> {
  const block = await loadCanonicalBlock(options, height);
  const transactions = await loadAndValidateBlockTransactions(options, block);
  const observed = new Map<string, Erc20Effects | undefined>();
  for (const tx of transactions) {
    observed.set(tx._id.toHexString(), cloneErc20Effects(tx.erc20Effects));
  }

  const fetched = await fetchTransferLogsForBlock(rpc, block);
  const attached = materializeBackfillTransactions({ block, transactions, logs: fetched.logs });
  const walletsByAddress = await walletIdsByAddress(options, transactions);
  // Historical local state must still identify the RPC's canonical block,
  // and its ordered transaction membership, including when an exact blockHash
  // log filter returns an empty result.
  // Keep this check immediately before the bounded publication loop.
  await assertRpcBlockTransactions(rpc, block, transactions);

  const stats: BlockBackfillStats = {
    height,
    transactions: transactions.length,
    updated: 0,
    skippedCurrent: 0,
    skippedNewer: 0,
    dryRunWouldUpdate: 0,
    racedConverged: 0,
    supportedTransferLogs: attached.supportedTransferLogs,
    unsupportedTransferLogs: attached.unsupportedTransferLogs
  };

  for (let offset = 0; offset < transactions.length; offset += options.concurrency) {
    if (shuttingDown) {
      throw new Error(`Interrupted while processing height ${height}`);
    }
    const batch = transactions.slice(offset, offset + options.concurrency);
    const outcomes = await Promise.all(batch.map(tx => updateBackfillTransaction({
      options,
      tx,
      observedErc20Effects: observed.get(tx._id.toHexString()),
      wallets: walletsForTransaction(tx, walletsByAddress)
    })));
    for (const outcome of outcomes) {
      if (outcome === 'updated') stats.updated++;
      if (outcome === 'skipped-current') stats.skippedCurrent++;
      if (outcome === 'skipped-newer') stats.skippedNewer++;
      if (outcome === 'dry-run') stats.dryRunWouldUpdate++;
      if (outcome === 'raced-converged') stats.racedConverged++;
    }
  }

  return stats;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runBackfill(options: BackfillOptions) {
  const chainConfig = getBackfillChainConfig(options);
  const rpc = await connectRpc(options, chainConfig);
  let lastCompletedHeight = options.startHeight - 1;

  for (let height = options.startHeight; height <= options.endHeight; height++) {
    if (shuttingDown) {
      break;
    }
    const stats = await processBlock(options, rpc, height);
    lastCompletedHeight = height;
    console.log(JSON.stringify({ ...stats, lastCompletedHeight }));
    if (height < options.endHeight && options.delayMs) {
      await sleep(options.delayMs);
    }
  }

  console.log(JSON.stringify({
    complete: lastCompletedHeight === options.endHeight,
    lastCompletedHeight,
    requestedEndHeight: options.endHeight
  }));
}

if (require.main === module) {
  registerShutdownHandlers();
  let options: BackfillOptions;
  try {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      usage();
    }
    options = parseBackfillOptions(process.argv.slice(2));
  } catch (err) {
    usage(err instanceof Error ? err.message : String(err));
  }

  Storage.start()
    .then(() => runBackfill(options))
    .catch(err => {
      console.error(err?.stack || err);
      process.exitCode = 1;
    })
    .finally(() => Storage.stop());
}
