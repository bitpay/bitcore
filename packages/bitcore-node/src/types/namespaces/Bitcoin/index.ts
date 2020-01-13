import { BitcoinBlockType, BlockHeader, BlockHeaderObj } from './Block';
import {
  BitcoinAddress,
  BitcoinInput,
  BitcoinInputObj,
  BitcoinOutput,
  BitcoinScript,
  BitcoinTransactionType
} from './Transaction';

export type BitcoinBlock = BitcoinBlockType;
export type BitcoinTransaction = BitcoinTransactionType;
export type BitcoinScript = BitcoinScript;
export type BitcoinAddress = BitcoinAddress;

export type BitcoinTransactionOutput = BitcoinOutput;
export type BitcoinTransactionInput = BitcoinInput;
export type BitcoinTransactionInputObj = BitcoinInputObj;

export type BitcoinBlockHeader = BlockHeader;
export type BitcoinBlockHeaderObj = BlockHeaderObj;
