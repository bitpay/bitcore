interface ExchangeConfig {
  disabled?: boolean;
  removed?: boolean;
  disabledTitle?: string;
  disabledMessage?: string;
}

export interface BuyCryptoConfig {
  disabled?: boolean;
  disabledTitle?: string;
  disabledMessage?: string;
  moonpay?: ExchangeConfig;
  ramp?: ExchangeConfig;
  simplex?: ExchangeConfig;
  wyre?: ExchangeConfig;
}

export interface SwapCryptoConfig {
  disabled?: boolean;
  disabledTitle?: string;
  disabledMessage?: string;
  changelly?: ExchangeConfig;
}

export interface ExternalServicesConfig {
  buyCrypto?: BuyCryptoConfig;
  swapCrypto?: SwapCryptoConfig;
}