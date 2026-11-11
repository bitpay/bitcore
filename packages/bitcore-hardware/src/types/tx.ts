import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';

/** Transaction data that can be converted into a Transaction via Transaction(tx) */
export type TransactionType = BitcoreLib.Transaction | string | Buffer | object;
