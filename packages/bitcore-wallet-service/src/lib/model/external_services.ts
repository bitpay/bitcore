interface ExchangeConfig {
  disabled?: boolean;
  removed?: boolean;
  disabledTitle?: string;
  disabledMessage?: string;
  config?: any;
}

export interface BuyCryptoConfig {
  disabled?: boolean;
  disabledTitle?: string;
  disabledMessage?: string;
  banxa?: ExchangeConfig;
  moonpay?: ExchangeConfig;
  ramp?: ExchangeConfig;
  sardine?: ExchangeConfig;
  simplex?: ExchangeConfig;
  transak?: ExchangeConfig;
  wyre?: ExchangeConfig;
}

export interface SellCryptoConfig {
  disabled?: boolean;
  disabledTitle?: string;
  disabledMessage?: string;
  moonpay?: ExchangeConfig;
}

export interface SwapCryptoConfig {
  disabled?: boolean;
  disabledTitle?: string;
  disabledMessage?: string;
  changelly?: ExchangeConfig;
  thorswap?: ExchangeConfig;
}

export interface ExternalServicesConfig {
  buyCrypto?: BuyCryptoConfig;
  sellCrypto?: SellCryptoConfig;
  swapCrypto?: SwapCryptoConfig;
}