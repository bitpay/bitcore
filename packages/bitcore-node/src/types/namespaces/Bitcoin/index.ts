import { BitcoinBlockType, BlockHeader, BlockHeaderObj } from './Block';
import {
  BitcoinTransactionType,
  BitcoinOutput,
  BitcoinInput,
  BitcoinScript,
  BitcoinAddress,
  BitcoinInputObj
} from './Transaction';

export declare namespace Bitcoin {
  export type Block = BitcoinBlockType;
  export type Transaction = BitcoinTransactionType;
  export type Script = BitcoinScript;
  export type Address = BitcoinAddress;
}

export declare namespace Bitcoin.Transaction {
  export type Output = BitcoinOutput;
  export type Input = BitcoinInput;
  export type InputObj = BitcoinInputObj;
}

export declare namespace Bitcoin.Block {
  export type Header = BlockHeader;
  export type HeaderObj = BlockHeaderObj
}
