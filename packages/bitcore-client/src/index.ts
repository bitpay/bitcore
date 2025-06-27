import * as CryptoWalletCore from 'crypto-wallet-core';
import 'source-map-support/register';
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
import * as StorageTypes from './types/storage';
import * as WalletTypes from './types/wallet';
export const Types = {
  ...WalletTypes,
  ...StorageTypes
};
