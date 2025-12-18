import { AccountTxResponse, Transaction, TransactionMetadata } from 'xrpl';
import { ITransaction } from '../../models/baseTransaction';
import { ICoin } from '../../models/coin';
import { IBlock } from '../../types/Block';

export type IXrpBlock = IBlock & {};
export type IXrpTransaction = ITransaction & {
  from: string;
  to?: string;
  nonce: number;
  currency?: string;
  invoiceID?: string;
};

export interface XrpTransactionJSON {
  txid: string;
  chain: string;
  network: string;
  blockHeight: number;
  blockHash: string;
  blockTime: string;
  blockTimeNormalized: string;
  fee: number;
  value: number;
  from: string;
  to: string;
  nonce: number;
  currency?: string;
  invoiceID?: string;
}

export type IXrpCoin = ICoin & {};

export type AccountTransaction = AccountTxResponse['result']['transactions'][0]

export type BlockTransaction = Transaction & { hash: string; metaData?: TransactionMetadata };

export type RpcTransaction = Transaction & {
  DeliverMax: string;
  ctid: string;
  date: number;
  hash: string;
  inLedger: number;
  ledger_index: number;
  meta: TransactionMetadata;
  validated: boolean;
};
