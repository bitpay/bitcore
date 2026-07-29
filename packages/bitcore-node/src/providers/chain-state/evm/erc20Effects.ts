import { Web3 } from '@bitpay-labs/crypto-wallet-core';
import logger from '../../../logger';
import type { IRpc } from './p2p/rpcs';
import type {
  CanonicalErc20Effect,
  Effect,
  Erc20Effects,
  IEVMBlock,
  IEVMTransaction
} from './types';
import type { IEVMNetworkConfig } from '../../../types/Config';

export const ERC20_EFFECTS_VERSION = 1;
export const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface RpcEvmLog {
  address: unknown;
  blockHash: unknown;
  blockNumber: unknown;
  data: unknown;
  logIndex: unknown;
  removed?: unknown;
  topics: unknown;
  transactionHash: unknown;
  transactionIndex?: unknown;
}

export interface ParsedErc20BlockLogs {
  itemsByTransaction: Map<string, CanonicalErc20Effect[]>;
  unsupportedTransferLogs: number;
}

export interface Erc20MaterializationResult {
  enabled: boolean;
  logCount: number;
  supportedTransferLogs: number;
  unsupportedTransferLogs: number;
  usedHeightFallback: boolean;
}

const HEX_HASH = /^0x[0-9a-fA-F]{64}$/;
const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX_WORD = /^0x[0-9a-fA-F]{64}$/;
const HEX_BYTES = /^0x(?:[0-9a-fA-F]{2})*$/;
const DECIMAL_UINT = /^(0|[1-9][0-9]*)$/;
const MAX_UINT256 = 2n ** 256n - 1n;

function rpcErrorText(err: unknown) {
  if (err instanceof Error) {
    return err.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function isUnsupportedBlockHashFilterError(err: unknown) {
  const message = rpcErrorText(err).toLowerCase();
  const code = err && typeof err === 'object' ? (err as any).code : undefined;
  const unsupportedWording =
    message.includes('unsupported') ||
    message.includes('not support') ||
    message.includes('invalid argument') ||
    message.includes('invalid params') ||
    message.includes('unknown field') ||
    message.includes('cannot specify');
  return (message.includes('blockhash') && unsupportedWording) || code === -32602;
}

function sendRpc<T>(rpc: IRpc, data: { jsonrpc: string; method: string; params: any[]; id: number }) {
  return rpc.send<T>(data);
}

function normalizeHash(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || !HEX_HASH.test(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return value.toLowerCase();
}

function normalizeAddress(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || !HEX_ADDRESS.test(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return Web3.utils.toChecksumAddress(value);
}

function parseRpcQuantity(value: unknown, fieldName: string) {
  let parsed: bigint;
  if (typeof value === 'bigint') {
    parsed = value;
  } else if (typeof value === 'number' && Number.isSafeInteger(value)) {
    parsed = BigInt(value);
  } else if (typeof value === 'string' && (/^0x[0-9a-fA-F]+$/.test(value) || /^(0|[1-9][0-9]*)$/.test(value))) {
    parsed = BigInt(value);
  } else {
    throw new Error(`Invalid ${fieldName}`);
  }
  if (parsed < 0n || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return Number(parsed);
}

export function semanticHashEquals(left: unknown, right: unknown) {
  return typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase();
}

/**
 * Pure parser/validator for a block-scoped log response. It performs no RPC,
 * database, cache, or API work.
 */
export function parseErc20TransferLogs(params: {
  blockHash: string;
  blockHeight: number;
  transactionHashes: string[];
  logs: unknown;
}): ParsedErc20BlockLogs {
  const expectedBlockHash = normalizeHash(params.blockHash, 'prepared block hash');
  if (!Number.isSafeInteger(params.blockHeight) || params.blockHeight < 0) {
    throw new Error('Invalid prepared block height');
  }
  if (!Array.isArray(params.logs)) {
    throw new Error('Malformed eth_getLogs response');
  }

  const orderedTransactionHashes = params.transactionHashes.map((txid, index) =>
    normalizeHash(txid, `transaction hash at index ${index}`)
  );
  const transactionHashes = new Set(orderedTransactionHashes);
  if (transactionHashes.size !== params.transactionHashes.length) {
    throw new Error('Duplicate transaction hash in prepared block');
  }

  const seenLogIdentities = new Set<string>();
  const itemsByTransaction = new Map<string, CanonicalErc20Effect[]>();
  let unsupportedTransferLogs = 0;

  for (let i = 0; i < params.logs.length; i++) {
    const log = params.logs[i] as RpcEvmLog;
    if (!log || typeof log !== 'object') {
      throw new Error(`Malformed log at response index ${i}`);
    }
    if (log.removed !== undefined && typeof log.removed !== 'boolean') {
      throw new Error(`Invalid removed flag at response index ${i}`);
    }
    if (log.removed === true) {
      throw new Error(`Removed log returned for prepared block at response index ${i}`);
    }

    const blockHash = normalizeHash(log.blockHash, `log blockHash at response index ${i}`);
    if (blockHash !== expectedBlockHash) {
      throw new Error(`Log block hash mismatch at response index ${i}`);
    }
    const blockNumber = parseRpcQuantity(log.blockNumber, `log blockNumber at response index ${i}`);
    if (blockNumber !== params.blockHeight) {
      throw new Error(`Log block height mismatch at response index ${i}`);
    }

    const transactionHash = normalizeHash(log.transactionHash, `log transactionHash at response index ${i}`);
    if (!transactionHashes.has(transactionHash)) {
      throw new Error(`Log transaction is not a member of the prepared block at response index ${i}`);
    }
    const logIndex = parseRpcQuantity(log.logIndex, `logIndex at response index ${i}`);
    if (log.transactionIndex !== undefined) {
      const transactionIndex = parseRpcQuantity(log.transactionIndex, `transactionIndex at response index ${i}`);
      if (orderedTransactionHashes[transactionIndex] !== transactionHash) {
        throw new Error(`Log transactionIndex does not match transactionHash at response index ${i}`);
      }
    }

    const identity = `${expectedBlockHash}:${logIndex}`;
    if (seenLogIdentities.has(identity)) {
      throw new Error(`Duplicate log identity ${identity}`);
    }
    seenLogIdentities.add(identity);

    const contractAddress = normalizeAddress(log.address, `log address at response index ${i}`);
    if (typeof log.data !== 'string' || !HEX_BYTES.test(log.data)) {
      throw new Error(`Malformed log data at response index ${i}`);
    }
    if (!Array.isArray(log.topics) || log.topics.some(topic => typeof topic !== 'string' || !HEX_WORD.test(topic))) {
      throw new Error(`Malformed topics at response index ${i}`);
    }
    const topics = log.topics as string[];
    if (topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) {
      continue;
    }

    // Four indexed topics are ERC-721-shaped. Other non-standard Transfer
    // signatures are counted and ignored rather than reinterpreted as ERC-20.
    if (topics.length !== 3) {
      unsupportedTransferLogs++;
      continue;
    }

    if (!HEX_WORD.test(log.data)) {
      unsupportedTransferLogs++;
      continue;
    }

    // Standard ABI encoding left-pads indexed addresses with 12 zero bytes.
    if (!/^0x0{24}[0-9a-fA-F]{40}$/.test(topics[1]) || !/^0x0{24}[0-9a-fA-F]{40}$/.test(topics[2])) {
      unsupportedTransferLogs++;
      continue;
    }

    const item: CanonicalErc20Effect = {
      type: 'ERC20:transfer',
      from: Web3.utils.toChecksumAddress(`0x${topics[1].slice(-40)}`),
      to: Web3.utils.toChecksumAddress(`0x${topics[2].slice(-40)}`),
      amount: BigInt(log.data).toString(),
      contractAddress,
      logIndex,
      callStack: `log:${logIndex}`
    };

    const items = itemsByTransaction.get(transactionHash) || [];
    items.push(item);
    itemsByTransaction.set(transactionHash, items);
  }

  for (const items of itemsByTransaction.values()) {
    items.sort((left, right) => left.logIndex - right.logIndex);
  }

  return { itemsByTransaction, unsupportedTransferLogs };
}

export function attachErc20EffectsToTransactions(params: {
  block: Pick<IEVMBlock, 'hash' | 'height' | 'transactionCount'>;
  transactions: Array<IEVMTransaction>;
  logs: unknown;
}) {
  if (!Number.isSafeInteger(params.block.transactionCount) || params.block.transactionCount < 0) {
    throw new Error('Invalid prepared block transaction count');
  }
  if (params.transactions.length !== params.block.transactionCount) {
    throw new Error(
      `Prepared transaction count ${params.transactions.length} does not match block transaction count ${params.block.transactionCount}`
    );
  }
  const transactionHashes = params.transactions.map(tx => tx.txid);
  for (let transactionIndex = 0; transactionIndex < params.transactions.length; transactionIndex++) {
    const tx = params.transactions[transactionIndex];
    if (tx.blockHeight !== params.block.height || !semanticHashEquals(tx.blockHash, params.block.hash)) {
      throw new Error(`Transaction ${tx.txid} does not match prepared block inclusion`);
    }
    const storedTransactionIndex = parseRpcQuantity(
      tx.transactionIndex,
      `prepared transactionIndex for ${tx.txid}`
    );
    if (storedTransactionIndex !== transactionIndex) {
      throw new Error(`Transaction ${tx.txid} is out of order in the prepared block`);
    }
  }

  const parsed = parseErc20TransferLogs({
    blockHash: params.block.hash,
    blockHeight: params.block.height,
    transactionHashes,
    logs: params.logs
  });

  let supportedTransferLogs = 0;
  for (const tx of params.transactions) {
    const items = parsed.itemsByTransaction.get(tx.txid.toLowerCase()) || [];
    supportedTransferLogs += items.length;
    tx.erc20Effects = {
      blockHash: params.block.hash,
      version: ERC20_EFFECTS_VERSION,
      items: items.map(item => ({ ...item }))
    };
  }

  return {
    supportedTransferLogs,
    unsupportedTransferLogs: parsed.unsupportedTransferLogs
  };
}

export async function fetchTransferLogsForBlock(rpc: IRpc, block: Pick<IEVMBlock, 'hash' | 'height'>) {
  const requestBase = {
    method: 'eth_getLogs',
    jsonrpc: '2.0',
    id: Date.now() + Math.round(Math.random() * 1000)
  };

  try {
    const logs = await sendRpc<unknown>(rpc, {
      ...requestBase,
      params: [{ blockHash: block.hash, topics: [ERC20_TRANSFER_TOPIC] }]
    });
    if (logs !== undefined) {
      return { logs, usedHeightFallback: false };
    }
    // Some existing RPC adapters discard a JSON-RPC error object and resolve
    // undefined. eth_getLogs never has a successful undefined result, so retry
    // through the strictly validated exact-height path.
  } catch (err) {
    if (!isUnsupportedBlockHashFilterError(err)) {
      throw err;
    }
  }

  const blockQuantity = `0x${block.height.toString(16)}`;
  const logs = await sendRpc<unknown>(rpc, {
    ...requestBase,
    id: requestBase.id + 1,
    params: [{ fromBlock: blockQuantity, toBlock: blockQuantity, topics: [ERC20_TRANSFER_TOPIC] }]
  });
  return { logs, usedHeightFallback: true };
}

export async function assertRpcBlockIdentity(rpc: IRpc, block: Pick<IEVMBlock, 'hash' | 'height'>) {
  const currentBlock = await rpc.getBlock(block.height);
  if (!currentBlock || !semanticHashEquals(currentBlock.hash, block.hash)) {
    throw new Error(`RPC block identity changed before persistence at height ${block.height}`);
  }
}

export function isErc20MaterializationEnabled(config?: IEVMNetworkConfig) {
  return config?.erc20Effects?.materializationEnabled === true;
}

/**
 * Runs after master conversion/tracing/effect derivation and immediately before
 * the existing persistence call. The only mutation is transaction.erc20Effects.
 */
export async function prepareErc20EffectsForPersistence(params: {
  rpc: IRpc;
  config?: IEVMNetworkConfig;
  block: IEVMBlock;
  transactions: Array<IEVMTransaction>;
}): Promise<Erc20MaterializationResult> {
  if (!isErc20MaterializationEnabled(params.config)) {
    return {
      enabled: false,
      logCount: 0,
      supportedTransferLogs: 0,
      unsupportedTransferLogs: 0,
      usedHeightFallback: false
    };
  }

  const fetched = await fetchTransferLogsForBlock(params.rpc, params.block);
  const attached = attachErc20EffectsToTransactions({
    block: params.block,
    transactions: params.transactions,
    logs: fetched.logs
  });

  if (attached.unsupportedTransferLogs > 0) {
    logger.warn('Ignored unsupported Transfer-shaped logs while materializing ERC-20 effects: %o', {
      chain: params.block.chain,
      network: params.block.network,
      height: params.block.height,
      blockHash: params.block.hash,
      count: attached.unsupportedTransferLogs
    });
  }

  // Height-range fallback is safe only if the exact local block identity is
  // revalidated after all enrichment and immediately before persistence.
  if (fetched.usedHeightFallback) {
    await assertRpcBlockIdentity(params.rpc, params.block);
  }

  return {
    enabled: true,
    logCount: Array.isArray(fetched.logs) ? fetched.logs.length : 0,
    supportedTransferLogs: attached.supportedTransferLogs,
    unsupportedTransferLogs: attached.unsupportedTransferLogs,
    usedHeightFallback: fetched.usedHeightFallback
  };
}

function isUint256Decimal(value: unknown) {
  if (typeof value !== 'string' || !DECIMAL_UINT.test(value)) {
    return false;
  }
  try {
    return BigInt(value) <= MAX_UINT256;
  } catch {
    return false;
  }
}

function isCanonicalItem(value: unknown): value is CanonicalErc20Effect {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as CanonicalErc20Effect;
  return (
    item.type === 'ERC20:transfer' &&
    typeof item.from === 'string' && HEX_ADDRESS.test(item.from) &&
    typeof item.to === 'string' && HEX_ADDRESS.test(item.to) &&
    typeof item.contractAddress === 'string' && HEX_ADDRESS.test(item.contractAddress) &&
    isUint256Decimal(item.amount) &&
    Number.isSafeInteger(item.logIndex) && item.logIndex >= 0 &&
    item.callStack === `log:${item.logIndex}`
  );
}

export function isValidErc20EffectsForTransaction(tx: Partial<IEVMTransaction>, value: unknown = tx.erc20Effects): value is Erc20Effects {
  if (!value || typeof value !== 'object' || !Array.isArray((value as Erc20Effects).items)) {
    return false;
  }
  const erc20Effects = value as Erc20Effects;
  if (
    erc20Effects.version !== ERC20_EFFECTS_VERSION ||
    typeof erc20Effects.blockHash !== 'string' ||
    !HEX_HASH.test(erc20Effects.blockHash) ||
    !semanticHashEquals(erc20Effects.blockHash, tx.blockHash) ||
    !Number.isSafeInteger(tx.blockHeight) ||
    (tx.blockHeight as number) < 0
  ) {
    return false;
  }

  let previousLogIndex = -1;
  for (const item of erc20Effects.items) {
    if (!isCanonicalItem(item) || item.logIndex <= previousLogIndex) {
      return false;
    }
    previousLogIndex = item.logIndex;
  }
  return true;
}

export function strictReadActivationHeight(config?: IEVMNetworkConfig) {
  const height = config?.erc20Effects?.strictReadActivationHeight;
  if (height === undefined) {
    return undefined;
  }
  if (!Number.isSafeInteger(height) || height < 0) {
    throw new Error('erc20Effects.strictReadActivationHeight must be a non-negative safe integer');
  }
  return height;
}

export function getEffectiveEvmEffects(
  tx: Partial<IEVMTransaction>,
  config?: IEVMNetworkConfig,
  legacyEffects: Effect[] = Array.isArray(tx.effects) ? tx.effects : []
): Effect[] {
  const confirmed = Number.isSafeInteger(tx.blockHeight) && (tx.blockHeight as number) >= 0;
  if (!confirmed) {
    return legacyEffects;
  }

  const nonErc20 = legacyEffects.filter(effect => effect?.type !== 'ERC20:transfer');
  const canonical = tx.erc20Effects;
  if (isValidErc20EffectsForTransaction(tx, canonical)) {
    return nonErc20.concat(canonical.items.map(item => ({ ...item })));
  }

  const activationHeight = strictReadActivationHeight(config);
  if (activationHeight !== undefined && (tx.blockHeight as number) >= activationHeight) {
    return nonErc20;
  }
  return legacyEffects;
}

export interface TransactionAddressRelevanceOptions {
  includeInternalRecipients?: boolean;
}

export function isTransactionRelevantToAddresses(
  tx: Partial<IEVMTransaction>,
  addresses: string[],
  options: TransactionAddressRelevanceOptions = {}
) {
  const addressSet = new Set(addresses.map(address => address.toLowerCase()));
  const isRelevant = (address?: unknown) => typeof address === 'string' && addressSet.has(address.toLowerCase());
  if (isRelevant(tx.from) || isRelevant(tx.to)) {
    return true;
  }
  if (
    options.includeInternalRecipients &&
    Array.isArray((tx as any).internal) &&
    (tx as any).internal.some(internalTx => isRelevant(internalTx?.action?.to))
  ) {
    return true;
  }
  return (tx.effects || []).some(effect => isRelevant(effect.from) || isRelevant(effect.to));
}

export function getCanonicalErc20ParticipantAddresses(tx: Partial<IEVMTransaction>) {
  const canonical = tx.erc20Effects;
  if (!isValidErc20EffectsForTransaction(tx, canonical)) {
    return [];
  }
  const addresses = new Set<string>();
  for (const item of canonical.items) {
    addresses.add(item.from);
    addresses.add(item.to);
  }
  return Array.from(addresses);
}

export function erc20EffectsEqual(left: Erc20Effects | undefined, right: Erc20Effects | undefined) {
  if (!left || !right) {
    return left === right;
  }
  if (
    left.version !== right.version ||
    !semanticHashEquals(left.blockHash, right.blockHash) ||
    left.items.length !== right.items.length
  ) {
    return false;
  }
  return left.items.every((item, index) => {
    const other = right.items[index];
    return !!other &&
      item.type === other.type &&
      item.from === other.from &&
      item.to === other.to &&
      item.amount === other.amount &&
      item.contractAddress === other.contractAddress &&
      item.logIndex === other.logIndex &&
      item.callStack === other.callStack;
  });
}
