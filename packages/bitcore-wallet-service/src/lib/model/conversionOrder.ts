export interface IConversionOrder {
  txIdFromUser: string;
  txIdSentToUser?: string;
  status: string;
  createdOn: Date;
  lastModified: Date;
  error?: string;
  pendingReason?: string;
  addressFrom?: string;
  amountConverted?: number;
}

export class ConversionOrder implements IConversionOrder {
  txIdFromUser: string;
  txIdSentToUser?: string;
  status: string;
  createdOn: Date;
  lastModified: Date;
  error?: string;
  pendingReason?: string;
  addressFrom?: string;
  amountConverted?: number;
  coin?: string;

  static create(opts) {
    opts = opts || {};
    const x = new ConversionOrder();
    const now = new Date();
    x.txIdFromUser = opts.txIdFromUser;
    x.coin = opts.coin || null;
    x.txIdSentToUser = opts.txIdSentToUser || null;
    x.status = 'waiting';
    x.createdOn = now;
    x.lastModified = now;
    x.error = opts.error || null;
    x.pendingReason = opts.pendingReason || null;
    x.addressFrom = opts.addressFrom || '';
    x.amountConverted = opts.amountConverted || '';
    return x;
  }

  static fromObj(obj) {
    const x = new ConversionOrder();
    x.txIdFromUser = obj.txIdFromUser;
    x.txIdSentToUser = obj.txIdSentToUser;
    x.status = obj.status;
    x.createdOn = obj.createdOn;
    x.lastModified = obj.lastModified;
    x.error = obj.error;
    x.pendingReason = obj.pendingReason;
    x.addressFrom = obj.addressFrom;
    x.amountConverted = obj.amountConverted;
    return x;
  }
}

export interface PrevOut {
  txid: string;
  outIdx: number;
}

export interface Value {
  low: number;
  high: number;
  unsigned: boolean;
}

export interface Amount {
  low: number;
  high: number;
  unsigned: boolean;
}

export interface Token {
  amount: Amount;
  isMintBaton: boolean;
}

export interface SlpBurn {
  token: Token;
  tokenId: string;
}

export interface SlpToken {
  amount: Amount;
  isMintBaton: boolean;
}

export interface Input {
  prevOut: PrevOut;
  inputScript: string;
  outputScript: string;
  value: Value;
  sequenceNo: any;
  slpBurn: SlpBurn;
  slpToken: SlpToken;
}

export interface Output {
  value: Value;
  outputScript: string;
  slpToken: SlpToken;
}

export interface SlpMeta {
  tokenType: string;
  txType: string;
  tokenId: string;
}

export interface SlpTxData {
  slpMeta: SlpMeta;
}

export interface Timestamp {
  low: number;
  high: number;
  unsigned: boolean;
}

export interface Block {
  height: number;
  hash: string;
  timestamp: Timestamp;
}

export interface TimeFirstSeen {
  low: number;
  high: number;
  unsigned: boolean;
}

export interface TxDetail {
  txid: string;
  version: number;
  inputs: Input[];
  outputs: Output[];
  lockTime: number;
  slpTxData: SlpTxData;
  block: Block;
  timeFirstSeen: TimeFirstSeen;
  network: string;
  inputAddresses: string[];
  outputAddresses: string[];
}
