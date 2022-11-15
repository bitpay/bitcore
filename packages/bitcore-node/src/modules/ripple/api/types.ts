export interface SubmitResponse {
  resultCode: string;
  resultMessage: string;
  engine_result: string;
  engine_result_code: number;
  engine_result_message: string;
  tx_blob: string;
  tx_json: {
    Account: string;
    Amount: {
      currency: string;
      issuer: string;
      value: string;
    };
    Destination: string;
    InvoiceID?: string;
    Fee: string;
    Flags: number;
    Sequence: number;
    SigningPubKey: string;
    TransactionType: string;
    TxnSignature: string;
    hash: string;
  };
}

export interface SingleOutputTx {
  engine_result: string;
  engine_result_code: number;
  engine_result_message: string;
  ledger_current_index: number;
  ledger_index?: number;
  status: string;
  transaction: {
    Account: string;
    Amount: string;
    Destination: string;
    DestinationTag: number;
    Fee: string;
    Flags: number;
    LastLedgerSequence: number;
    Sequence: number;
    SigningPubKey: string;
    TransactionType: string;
    TxnSignature: string;
    hash: string;
    InvoiceID?: string;
  };
  type: 'transaction';
  validated: false;
}
