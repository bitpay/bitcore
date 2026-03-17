import 'source-map-support/register';
import * as CryptoWalletCore from '@bitpay-labs/crypto-wallet-core';
import { Client } from './client';
import { Encryption } from './encryption';
import { Storage } from './storage';
import { ParseApiStream, StreamUtil } from './stream-util';
import { Wallet } from './wallet';

export * from './wallet';
export {
  Wallet,
  Client,
  Storage,
  ParseApiStream,
  Encryption,
  StreamUtil,
  CryptoWalletCore
};

// Types
export type * as Types from './types';
