import { BitcoinBlockType as BBT, BlockHeader, BlockHeaderObj } from './Block';
import {
  BitcoinAddress as BA,
  BitcoinInput,
  BitcoinInputObj,
  BitcoinOutput,
  BitcoinScript as BS,
  BitcoinTransactionType
} from './Transaction';

export type BitcoinBlockType = BBT;
export type BitcoinTransaction = BitcoinTransactionType;
export type BitcoinScript = BS;
export type BitcoinAddress = BA;

export type TransactionOutput = BitcoinOutput;
export type TransactionInput = BitcoinInput;
export type TransactionInputObj = BitcoinInputObj;

export type BitcoinHeader = BlockHeader;
export type BitcoinHeaderObj = BlockHeaderObj;
