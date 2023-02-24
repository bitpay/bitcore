import { TokenInfo } from './tokenInfo';

export class ConfigSwap {
  coinSwap: CoinConfig[];
  coinReceive: CoinConfig[];
  constructor() {
    this.coinSwap = [];
    this.coinReceive = [];
  }
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
}

export class CoinConfig {
  _id: string;
  code: string;
  network: string;
  isToken: boolean;
  settleFee?: number;
  networkFee?: number;
  serviceFee?: number;
  rate?: any;
  min: number;
  minConvertToSat?: number;
  max: number;
  maxConvertToSat?: number;
  fund: number;
  fundConvertToSat?: number;
  decimals?: number;
  tokenInfo?: TokenInfo;
  isEnable?: boolean;
  isEnableSwap?: boolean;
  isEnableReceive?: boolean;
  isSwap: boolean;
  isReceive: boolean;
  isSupport: boolean;
  dailyLimit?: number;
  dailyLimitUsage?: number;

  static create(opts) {
    const x = new CoinConfig();
    x._id = opts._id;
    x.code = opts.code;
    x.isToken = opts.isToken;
    x.network = opts.network;
    x.networkFee = opts.networkFee || 0;
    x.rate = null;
    x.min = opts.min || 0;
    x.minConvertToSat = opts.minConvertToSat || 0;
    x.max = opts.max || 0;
    x.maxConvertToSat = opts.maxConvertToSat || 0;
    x.fund = opts.fund || 0;
    x.fundConvertToSat = opts.fundConvertToSat || 0;
    x.decimals = opts.decimals || 0;
    x.tokenInfo = opts.tokenInfo || null;
    x.isEnable = opts.isEnable || true;
    x.isEnableSwap = opts.isEnableSwap || true;
    x.isEnableReceive = opts.isEnableReceive || true;
    x.isSwap = opts.isSwap || false;
    x.isReceive = opts.isReceive || false;
    x.isSupport = opts.isSupport || true;
    x.settleFee = opts.settleFee || 0;
    x.serviceFee = opts.serviceFee || 0;
    x.dailyLimit = 0;
    x.dailyLimitUsage = 0;
    return x;
  }

  static fromObj(opts) {
    const x = new CoinConfig();
    x._id = opts._id;
    x.code = opts.code;
    x.network = opts.network;
    x.isToken = opts.isToken;
    x.networkFee = opts.networkFee;
    x.rate = opts.rate;
    x.min = opts.min;
    x.minConvertToSat = opts.minConvertToSat;
    x.max = opts.max;
    x.maxConvertToSat = opts.maxConvertToSat;
    x.tokenInfo = opts.tokenInfo;
    x.fund = opts.fund;
    x.fundConvertToSat = opts.fundConvertToSat;
    x.decimals = opts.decimals;
    x.isEnable = opts.isEnable;
    x.isSwap = opts.isSwap;
    x.isReceive = opts.isReceive;
    x.isSupport = opts.isSupport;
    x.settleFee = opts.settleFee;
    x.serviceFee = opts.serviceFee;
    x.dailyLimit = opts.dailyLimit;
    x.dailyLimitUsage = opts.dailyLimitUsage;
    return x;
  }
}

export class FeeType {
  code: string;
  settleFee?: number;
  networkFee?: number;
  serviceFee?: number;

  static create(opts) {
    const x = new FeeType();
    x.code = opts.code;
    x.networkFee = opts.networkFee || 0;
    x.serviceFee = opts.serviceFee || 0;
    x.settleFee = opts.settleFee || 0;
  }

  static fromObj(opts) {
    const x = new FeeType();
    x.code = opts.code;
    x.networkFee = opts.networkFee;
    x.serviceFee = opts.serviceFee;
    x.settleFee = opts.settleFee;
  }
}
