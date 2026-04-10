import { Web3 } from '@bitpay-labs/crypto-wallet-core';
import { EVMTransactionStorage } from '../../evm/models/transaction';
import type { IEVMTransactionTransformed } from '../../evm/types';

/**
 * Shared Moralis transformation and query-building utilities.
 * Used by both MoralisAdapter (multi-provider) and MoralisStateProvider (standalone CSP).
 */

export function transformMoralisTransaction(tx: any): IEVMTransactionTransformed {
  const txid = tx.hash || tx.transaction_hash;
  const transformed = {
    chain: tx.chain,
    network: tx.network,
    txid,
    blockHeight: Number(tx.block_number ?? tx.blockNumber),
    blockHash: tx.block_hash ?? tx.blockHash,
    blockTime: new Date(tx.block_timestamp ?? tx.blockTimestamp),
    blockTimeNormalized: new Date(tx.block_timestamp ?? tx.blockTimestamp),
    value: tx.value,
    gasLimit: tx.gas ?? 0,
    gasPrice: tx.gas_price ?? tx.gasPrice ?? 0,
    fee: Number(tx.receipt_gas_used ?? tx.receiptGasUsed ?? 0) * Number(tx.gas_price ?? tx.gasPrice ?? 0),
    nonce: tx.nonce,
    to: (tx.to_address ?? tx.toAddress)
      ? Web3.utils.toChecksumAddress(tx.to_address ?? tx.toAddress)
      : '',
    from: Web3.utils.toChecksumAddress(tx.from_address ?? tx.fromAddress),
    data: tx.input,
    internal: [],
    calls: tx?.internal_transactions?.map((t: any) => transformMoralisInternalTx(t)) || [],
    effects: [],
    category: tx.category,
    wallets: [],
    transactionIndex: tx.transaction_index ?? tx.transactionIndex
  } as IEVMTransactionTransformed;
  EVMTransactionStorage.addEffectsToTxs([transformed]);
  return transformed;
}

export function transformMoralisInternalTx(tx: any) {
  return {
    from: Web3.utils.toChecksumAddress(tx.from),
    to: Web3.utils.toChecksumAddress(tx.to),
    gas: tx.gas,
    gasUsed: tx.gas_used,
    input: tx.input,
    output: tx.output,
    type: tx.type,
    value: tx.value,
    abiType: EVMTransactionStorage.abiDecode(tx.input)
  };
}

export function transformMoralisTokenTransfer(transfer: any) {
  const base = transformMoralisTransaction(transfer);
  return {
    ...base,
    transactionHash: transfer.transaction_hash,
    transactionIndex: transfer.transaction_index,
    contractAddress: transfer.contract_address ?? transfer.address,
    name: transfer.token_name
  };
}

export function transformMoralisQueryParams(params: { chainId: string | bigint; args: any }) {
  const { chainId, args } = params;
  const query: any = { chain: formatMoralisChainId(chainId) };
  if (args) {
    if (args.startBlock || args.endBlock) {
      if (args.startBlock) query.from_block = Number(args.startBlock);
      if (args.endBlock) query.to_block = Number(args.endBlock);
    } else {
      if (args.startDate) query.from_date = args.startDate;
      if (args.endDate) query.to_date = args.endDate;
    }
    if (args.direction) {
      query.order = Number(args.direction) > 0 ? 'ASC' : 'DESC';
    }
    if (args.date) {
      query.date = new Date(args.date).getTime();
    }
  }
  return query;
}

export function buildMoralisQueryString(params: Record<string, any>): string {
  const query: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] != null) query.push(`${key}%5B${i}%5D=${value[i]}`);
      }
    } else if (value != null) {
      query.push(`${key}=${value}`);
    }
  }
  return query.length ? `?${query.join('&')}` : '';
}

export function formatMoralisChainId(chainId: string | bigint): string {
  const str = String(chainId);
  if (str.startsWith('0x')) return str;
  return '0x' + BigInt(str).toString(16);
}
