import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';

/** Transaction data that can be converted into a Transaction via Transaction(tx) */
export type TransactionType = BitcoreLib.Transaction | string | Buffer | object;

/**
 * Standard utxo type use for internal processing.
 * Property names are from bitcore-lib's UnspentOutput.
 * Note, UnspentOutput addresses and scripts are Address and Script classes respectively,
 * here they are both strings.
 */
export type UtxoType = {
  txId: string;
  outputIndex: number;
  satoshis: number;
  script: string;
  address?: string;
};

/** 
 * Utxo type for functions were the received utxo type is unknown.
 * Could either be in the format of UnspentOutput, UnspentOutput.toObject, or from bitcore-node.
 */
export type EveryUtxoType = Partial<UtxoType & {
  // bitcore-node specific properties
  mintTxid: string;
  mintIndex: number;
  mintHeight: number;
  value: number;
  // UnspentOutput.toObject specific properties
  txid: string;
  amount: number;
  vout: number;
  scriptPubKey: string;
  // UnspentOutput specific, allow for Script and Address objects
  script: string | BitcoreLib.Script;
  address: string | BitcoreLib.Address;
}>;
