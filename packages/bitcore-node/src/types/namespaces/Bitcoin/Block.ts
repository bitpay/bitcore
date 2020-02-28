import { BitcoinTransactionType } from './Transaction';
export interface BlockHeaderObj {
  prevHash: string;
  hash: string;
  time: number;
  version: number;
  merkleRoot: string;
  bits: number;
  nonce: number;
}
export interface BlockHeader {
  toObject: () => BlockHeaderObj;
}
export interface BitcoinBlockType {
  hash: string;
  transactions: BitcoinTransactionType[];
  header: BlockHeader;
  toBuffer: () => Buffer;
}
