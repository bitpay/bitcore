export enum PaymentType {
  SEND,
  BURN
}

export interface IQpayInfoForEmail {
  payee: string;
  paymentReason: string;
  paymentReasonValue: number;
  paymentDescription: string;
  accountNumber?: string;
  street?: string;
  unitNumber?: string;
  formattedAmount: string;
  amountPay: number;
  amountToken: number;
  dateFormatted: string;
  date: Date;
}

export interface IMerchantOrder {
  status: string;
  coin: string;
  tokenId?: string;
  txIdFromUser: string;
  txMerchantPayment?: string;
  merchantCode: string;
  userAddress: string;
  amount: number;
  listEmailContent: string[];
  listSubject: string[];
  error?: string;
  pendingReason?: string;
  createdOn: Date;
  lastModified: Date;
  signature?: string;
  isPaidByUser: boolean;
  paymentType: number;
  userEmailAddress: string;
  qpayInfoForEmail: IQpayInfoForEmail;
}

export class MerchantOrder implements IMerchantOrder {
  txMerchantPayment?: string;
  qpayInfoForEmail: IQpayInfoForEmail;
  status: string;
  coin: string;
  tokenId?: string;
  userAddress: string;
  txIdFromUser: string;
  txIdMerchantPayment?: string;
  merchantCode: string;
  amount: number;
  paymentType: number;
  listEmailContent: string[];
  listSubject: string[];
  error?: string;
  pendingReason?: string;
  createdOn: Date;
  lastModified: Date;
  signature?: string;
  isPaidByUser: boolean;
  userEmailAddress: string;
  static create(opts) {
    opts = opts || {};
    const x = new MerchantOrder();
    const now = new Date();
    x.status = 'waiting';
    x.coin = opts.coin;
    x.tokenId = opts.tokenId || null;
    x.userAddress = opts.userAddress;
    x.txIdFromUser = opts.txIdFromUser;
    x.txIdMerchantPayment = opts.txIdMerchantPayment || null;
    x.merchantCode = opts.merchantCode;
    x.amount = opts.amount;
    x.listEmailContent = opts.listEmailContent;
    x.listSubject = opts.listSubject;
    x.createdOn = now;
    x.lastModified = now;
    x.error = opts.error || null;
    x.pendingReason = opts.pendingReason || null;
    x.signature = opts.signature || null;
    x.isPaidByUser = opts.isPaidByUser;
    x.paymentType = opts.paymentType;
    x.userEmailAddress = opts.userEmailAddress;
    x.qpayInfoForEmail = opts.qpayInfoForEmail;
    return x;
  }

  static fromObj(obj) {
    const x = new MerchantOrder();
    x.status = obj.status;
    x.coin = obj.coin;
    x.tokenId = obj.tokenId || null;
    x.userAddress = obj.userAddress;
    x.txIdFromUser = obj.txIdFromUser;
    x.txIdMerchantPayment = obj.txIdMerchantPayment || null;
    x.merchantCode = obj.merchantCode;
    x.amount = obj.amount;
    x.listEmailContent = obj.listEmailContent;
    x.listSubject = obj.listSubject;
    x.createdOn = obj.createdOn;
    x.lastModified = obj.lastModified;
    x.error = obj.error || null;
    x.pendingReason = obj.pendingReason || null;
    x.signature = obj.signature || null;
    x.isPaidByUser = obj.isPaidByUser;
    x.paymentType = obj.paymentType;
    x.userEmailAddress = obj.userEmailAddress;
    x.qpayInfoForEmail = obj.qpayInfoForEmail;
    return x;
  }
}
