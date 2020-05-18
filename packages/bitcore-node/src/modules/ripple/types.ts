import { IBlock } from '../../models/baseBlock';
import { ITransaction } from '../../models/baseTransaction';
import { ICoin } from '../../models/coin';

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
