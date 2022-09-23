import { TokenInfo } from './tokenInfo';

export class ConfigSwap {
  coinSwap: CoinConfig[];
  coinReceive: CoinConfig[];
  weightedMaximumFund: number;

  static create(opts) {
    const x = new ConfigSwap();
    x.coinReceive = opts.coinReceive;
    x.coinSwap = opts.coinSwap;
    return x;
  }
  static fromObj(opts) {
    const x = new ConfigSwap();
    x.coinReceive = opts.coinReceive;
    x.coinSwap = opts.coinSwap;

    return x;
  }
  // static fromJson(opts){
  //   const x = new ConfigSwap();
  //   x.coinReceive = CoinConfig.create(opts.coinReceive);
  //   x.coinSwap = CoinConfig.create(opts.coinswap);

  //   return x
  // }

  static from;
  // static create(opts) {
  //   opts = opts || {};

  //   const x = new Order();

  //   const now = Date.now();
  //   x.version = 2;
  //   x.priority = opts.priority;
  //   x.createdOn = Math.floor(now / 1000);
  //   x.id = _.padStart(now.toString(), 14, '0') + Uuid.v4();
  //   x.fromCoinCode = opts.fromCoinCode;
  //   x.amountFrom = opts.amountFrom;
  //   x.fromSatUnit = opts.fromSatUnit;
  //   x.toSatUnit = opts.toSatUnit;
  //   x.isFromToken = opts.isFromToken;
  //   x.toCoinCode = opts.toCoinCode;
  //   x.amountSentToUser = opts.amountSentToUser;
  //   x.amountUserDeposit = 0;
  //   x.isToToken = opts.isToToken;
  //   x.addressUserReceive = opts.addressUserReceive;
  //   x.adddressUserDeposit = null;
  //   x.createdRate = opts.createdRate;
  //   x.status = 'waiting';
  //   x.toTokenId = opts.toTokenId || null;
  //   x.fromTokenId = opts.fromTokenId || null;
  //   x.txId = null;
  //   x.isSentToFund = false;
  //   x.isSentToUser = false;
  //   x.endedOn = null;
  //   x.error = null;
  //   return x;
  // }

  // static fromObj(obj) {
  //   const x = new Order();

  //   x.version = obj.version;
  //   x.createdOn = obj.createdOn;
  //   x.id = obj.id;
  //   x.priority = obj.priority;
  //   x.fromCoinCode = obj.fromCoinCode;
  //   x.amountFrom = obj.amountFrom;
  //   x.isFromToken = obj.isFromToken;
  //   x.toCoinCode = obj.toCoinCode;
  //   x.isToToken = obj.isToToken;
  //   x.addressUserReceive = obj.addressUserReceive;
  //   x.adddressUserDeposit = obj.adddressUserDeposit;
  //   x.amountUserDeposit = obj.amountUserDeposit;
  //   x.status = obj.status;
  //   x.isSentToFund = obj.isSentToFund;
  //   x.isSentToUser = obj.isSentToUser;
  //   x.createdRate = obj.createdRate;
  //   x.toTokenId = obj.toTokenId;
  //   x.fromTokenId = obj.fromTokenId;
  //   x.txId = obj.txId;
  //   x.createdOn = obj.createOn;
  //   x.error = obj.error;
  //   x.amountFrom = obj.amountFrom;
  //   x.fromSatUnit = obj.fromSatUnit;
  //   x.toSatUnit = obj.toSatUnit;
  //   return x;
  // }
}

export class CoinConfig {
  code: string;
  isToken: boolean;
  networkFee?: number;
  rate?: any;
  min?: number;
  minConvertToSat?: number;
  max?: number;
  maxConvertToSat?: number;
  tokenInfo?: TokenInfo;
  isEnable?: boolean;

  static create(opts) {
    const x = new CoinConfig();
    x.code = opts.code;
    x.isToken = opts.isToken;
    x.networkFee = opts.networkFee || 0;
    x.rate = null;
    x.min = opts.min || 0;
    x.minConvertToSat = opts.minConvertToSat || 0;
    x.max = opts.max || 0;
    x.maxConvertToSat = opts.maxConvertToSat || 0;
    x.tokenInfo = opts.tokenInfo || null;
    x.isEnable = opts.isEnable || true;

    return x;
  }

  static fromObj(opts) {
    const x = new CoinConfig();
    x.code = opts.code;
    x.isToken = opts.isToken;
    x.networkFee = opts.networkFee;
    x.rate = opts.rate;
    x.min = opts.min;
    x.minConvertToSat = opts.minConvertToSat;
    x.max = opts.max;
    x.maxConvertToSat = opts.maxConvertToSat;
    x.tokenInfo = opts.tokenInfo;
    x.isEnable = opts.isEnable;

    return x;
  }
}
