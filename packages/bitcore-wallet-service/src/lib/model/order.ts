import _ from 'lodash';
const Uuid = require('uuid');

interface IOrder {
  orderCode: number;
  fromCoinCode: string;
  amountFrom: number;
  isFromToken: boolean;
  toCoinCode: boolean;
  amountSentToUser: number;
  isToToken: boolean;
  addressUserReceive: string;
  status: string;
  attempts: number;
  lastAttemptOn?: number;
  createdOn?: number;
}

export class Order {
  id: string | number;
  version: number;
  priority: number;
  fromCoinCode: string;
  fromTokenId?: string;
  amountFrom: number;
  isFromToken: boolean;
  toCoinCode: string;
  isToToken: boolean;
  amountSentToUser: number;
  amountUserDeposit: number;
  createdRate: number;
  updatedRate: number;
  addressUserReceive: string;
  adddressUserDeposit: string;
  toTokenId?: string;
  txId?: string;
  status?: string;
  isSentToFund?: boolean;
  isSentToUser?: boolean;
  endedOn?: number;
  createdOn?: number;
  error?: string;

  static create(opts) {
    opts = opts || {};

    const x = new Order();

    const now = Date.now();
    x.version = 2;
    x.priority = opts.priority;
    x.createdOn = Math.floor(now / 1000);
    x.id = _.padStart(now.toString(), 14, '0') + Uuid.v4();
    x.fromCoinCode = opts.fromCoinCode;
    x.amountFrom = opts.amountFrom;
    x.isFromToken = opts.isFromToken;
    x.toCoinCode = opts.toCoinCode;
    x.amountSentToUser = opts.amountSentToUser;
    x.amountUserDeposit = 0;
    x.isToToken = opts.isToToken;
    x.addressUserReceive = opts.addressUserReceive;
    x.adddressUserDeposit = null;
    x.createdRate = opts.createdRate;
    x.status = 'waiting';
    x.toTokenId = opts.toTokenId || null;
    x.fromTokenId = opts.fromTokenId || null;
    x.txId = null;
    x.isSentToFund = false;
    x.isSentToUser = false;
    x.endedOn = null;
    x.error = null;
    return x;
  }

  static fromObj(obj) {
    const x = new Order();

    x.version = obj.version;
    x.createdOn = obj.createdOn;
    x.id = obj.id;
    x.priority = obj.priority;
    x.fromCoinCode = obj.fromCoinCode;
    x.amountFrom = obj.amountFrom;
    x.isFromToken = obj.isFromToken;
    x.toCoinCode = obj.toCoinCode;
    x.isToToken = obj.isToToken;
    x.addressUserReceive = obj.addressUserReceive;
    x.adddressUserDeposit = obj.adddressUserDeposit;
    x.amountUserDeposit = obj.amountUserDeposit;
    x.status = obj.status;
    x.isSentToFund = obj.isSentToFund;
    x.isSentToUser = obj.isSentToUser;
    x.createdRate = obj.createdRate;
    x.toTokenId = obj.toTokenId;
    x.fromTokenId = obj.fromTokenId;
    x.txId = obj.txId;
    x.createdOn = obj.createOn;
    x.error = obj.error;

    return x;
  }
}
