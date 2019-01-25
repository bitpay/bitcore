import { BitcoinTransactionType } from "./Transaction";
export type BlockHeaderObj = {
  prevHash: string;
  hash: string;
  time: number;
  version: number;
  merkleRoot: string;
  bits: number;
  nonce: number;
}
export type BlockHeader = {
  toObject: () => BlockHeaderObj;
};
export type BitcoinBlockType = {
  hash: string;
  transactions: BitcoinTransactionType[];
  header: BlockHeader;
  toBuffer: () => Buffer;
};
