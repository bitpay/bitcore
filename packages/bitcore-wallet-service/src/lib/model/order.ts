import _ from 'lodash';
const Uuid = require('uuid');

interface IOrder {
  orderCode: number;
  fromCoinCode: string;
  amountFrom: number;
  isFromToken: boolean;
  toCoinCode: boolean;
  amountTo: string;
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
  amountFrom: number;
  isFromToken: boolean;
  toCoinCode: boolean;
  amountTo: string;
  isToToken: boolean;
  addressUserReceive: string;
  adddressUserDeposit: string;
  status: string;
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
    x.amountTo = opts.amountTo;
    x.isToToken = opts.isToToken;
    x.addressUserReceive = opts.addressUserReceive;
    x.adddressUserDeposit = null;
    x.status = 'pending';
    x.isSentToFund = false;
    x.isSentToUser = false;
    x.endedOn = null;
    x.error = null;
    return x;
  }
}
