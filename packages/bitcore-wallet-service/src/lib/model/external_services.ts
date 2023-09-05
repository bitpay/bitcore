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
  banxa?: ExchangeConfig;
  moonpay?: ExchangeConfig;
  ramp?: ExchangeConfig;
  sardine?: ExchangeConfig;
  simplex?: ExchangeConfig;
  transak?: ExchangeConfig;
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