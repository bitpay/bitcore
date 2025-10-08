import { ITxProposal, IWallet, TxProposal } from 'src/lib/model';
import { WalletService } from 'src/lib/server';

export interface INotificationData {
  out: {
    address: any;
    amount: any;
    tokenAddress?: any;
  };
  txid: any;
}

export interface IChain {
  getWalletBalance(server: WalletService, wallet: IWallet, opts: { coin: string; addresses: string[] } & any, cb);
  getWalletSendMaxInfo(
    server: WalletService,
    wallet: IWallet,
    opts: {
      excludeUnconfirmedUtxos: string;
      returnInputs: string;
      from: string;
      feePerKb: number;
      useProUrl: boolean;
    } & any,
    cb
  );
  getInputSizeSafetyMargin(opts: any): number;
  getSizeSafetyMargin(opts: any): number;
  getDustAmountValue();
  getTransactionCount(server: WalletService, wallet: IWallet, from: string);
  getChangeAddress(server: WalletService, wallet: IWallet, opts: { changeAddress: string } & any);
  checkDust(output: { amount: number; toAddress: string; valid: boolean }, opts: { outputs: any[] } & any);
  checkScriptOutput(output: { script: string; amount: number; });
  getFee(server: WalletService, wallet: IWallet, opts: { fee: number; feePerKb: number; signatures?: number } & any);
  getBitcoreTx(txp: TxProposal, opts: { signed: boolean });
  convertFeePerKb(p: number, feePerKb: number);
  checkTx(server: WalletService, txp: ITxProposal);
  checkTxUTXOs(server: WalletService, txp: ITxProposal, opts: { noCashAddr: boolean } & any, cb);
  selectTxInputs(server: WalletService, txp: ITxProposal, wallet: IWallet, opts: { utxosToExclude: any[] } & any, cb);
  checkUtxos(opts: { fee: number; inputs: any[] });
  checkValidTxAmount(output): boolean;
  isUTXOChain(): boolean;
  isSingleAddress(): boolean;
  supportsMultisig(): boolean;
  supportsThresholdsig(): boolean;
  notifyConfirmations(network: string): boolean;
  addSignaturesToBitcoreTx(
    tx: string,
    inputs: any[],
    inputPaths: any[],
    signatures: any[],
    xpub: string,
    signingMethod?: string
  );
  addressToStorageTransform(network: string, address: {}): void;
  addressFromStorageTransform(network: string, address: {}): void;
  validateAddress(wallet: IWallet, inaddr: string, opts: { noCashAddr: boolean } & any);
  onCoin(coin: any): INotificationData | null;
  onTx(tx: any): INotificationData | null;
  getReserve(server: WalletService, wallet: IWallet, cb: (err?, reserve?: number) => void);
  refreshTxData(server: WalletService, txp: TxProposal, opts: any, cb);
}