import { BitcoinBlockType, BlockHeader, BlockHeaderObj } from './Block';
import {
  BitcoinAddress,
  BitcoinInput,
  BitcoinInputObj,
  BitcoinOutput,
  BitcoinScript,
  BitcoinTransactionType
} from './Transaction';

export type BitcoinBlockType = BitcoinBlockType;
export type BitcoinTransaction = BitcoinTransactionType;
export type BitcoinScript = BitcoinScript;
export type BitcoinAddress = BitcoinAddress;

export type TransactionOutput = BitcoinOutput;
export type TransactionInput = BitcoinInput;
export type TransactionInputObj = BitcoinInputObj;

export type BitcoinHeader = BlockHeader;
export type BitcoinHeaderObj = BlockHeaderObj;
