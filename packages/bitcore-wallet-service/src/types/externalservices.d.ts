interface ExchangeConfig {
  disabled?: boolean;
  removed?: boolean;
  disabledTitle?: string;
  disabledMessage?: string;
  config?: {
    paymentMethods?: PaymentMethodsConfig;
    [key: string]: any; // Other partner-specific configuration properties can be added here
  };
}

export interface BuyCryptoConfig {
  disabled?: boolean;
  disabledTitle?: string;
  disabledMessage?: string;
  paymentMethods?: PaymentMethodsConfig;
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
  paymentMethods?: PaymentMethodsConfig;
  moonpay?: ExchangeConfig;
}

export interface SwapCryptoConfig {
  disabled?: boolean;
  disabledTitle?: string;
  disabledMessage?: string;
  changelly?: ExchangeConfig;
  thorswap?: ExchangeConfig;
}

export type PaymentMethodKey =
  | 'ach'
  | 'applePay'
  | 'cashApp'
  | 'creditCard'
  | 'debitCard'
  | 'googlePay'
  | 'sepaBankTransfer'
  | 'gbpBankTransfer'
  | 'other'
  | 'paypal'
  | 'pisp'
  | 'pix'
  | 'venmo';

export interface PaymentMethodConfig {
  disabled?: boolean;
}

export type PaymentMethodsConfig = {
  [key in PaymentMethodKey]?: PaymentMethodConfig;
};

export interface ExternalServicesConfig {
  buyCrypto?: BuyCryptoConfig;
  sellCrypto?: SellCryptoConfig;
  swapCrypto?: SwapCryptoConfig;
}