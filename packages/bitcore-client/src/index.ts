import 'source-map-support/register';
import * as CryptoWalletCore from 'crypto-wallet-core';
import { ParseApiStream, StreamUtil } from './stream-util';
import { Client } from './client';
import { Encryption } from './encryption';
import { Storage } from './storage';
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
