import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { ApiProvider } from '../../providers/api/api';
import { Observable } from 'rxjs/Observable';
import { CurrencyProvider } from '../../providers/currency/currency';
import { DefaultProvider } from '../../providers/default/default';

/*
  Generated class for the TxsProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
*/

type CoinsApiResponse = { inputs: ApiInput[]; outputs: ApiInput[] };
export type ApiTx = {
  address: string;
  chain: string;
  network: string;
  txid: string;
  blockHeight: number;
  blockHash: string;
  blockTime: Date;
  blockTimeNormalized: Date;
  coinbase: boolean;
  size: number;
  locktime: number;
  inputs: Array<ApiInput>;
  outputs: Array<ApiInput>;
  mintTxid: string;
  mintHeight: number;
  spentTxid: string;
  spentHeight: number;
  value: number;
  version: number;
};

export type ApiInput = {
  txid: string;
  coinbase: boolean;
  vout: number;
  address: string;
  script: string;
  value: number;
};

export type AppInput = {
  coinbase: boolean;
  sequence: number;
  n: number;
  txid: string;
  vout: number;
  scriptSig: {
    hex: string;
    asm: string;
    addresses: Array<string>;
    type: string;
  };
  addr: string;
  valueSat: number;
  value: number;
  doubleSpentTxID: string;
  isConfirmed: boolean;
  confirmations: number;
  unconfirmedInput: string;
};

export type AppOutput = {
  value: number;
  n: number;
  scriptPubKey: {
    hex: string;
    asm: string;
    addresses: Array<string>;
    type: string;
  };
  spentTxId: null;
  spentIndex: null;
  spentHeight: null;
};

export type AppTx = {
  txid: string;
  blockhash: string;
  version: number;
  locktime: number;
  isCoinBase: boolean;
  vin: Array<any>;
  vout: Array<any>;
  confirmations: number;
  time: number;
  valueOut: number;
  size: number;
  fees: number;
  blockheight: number;
  blocktime: number;
};

@Injectable()
export class TxsProvider {
  constructor(
    public http: Http,
    private api: ApiProvider,
    public currency: CurrencyProvider,
    private defaults: DefaultProvider
  ) {}

  private toAppTx(tx: ApiTx): AppTx {
    let sumSatoshis: any = (arr: any): number => arr.reduce((prev, cur) => prev + cur.value, 0);
    let inputs: number = sumSatoshis(tx.inputs);
    let outputs: number = sumSatoshis(tx.outputs);
    let fee: number = tx.coinbase ? 0 : inputs - outputs;

    return {
      txid: tx.txid,
      fees: fee / 10 ** 8,
      blockheight: tx.blockHeight,
      confirmations: 0,
      blockhash: tx.blockHash,
      blocktime: new Date(tx.blockTime).getTime() / 1000,
      time: new Date(tx.blockTime).getTime() / 1000,
      isCoinBase: tx.coinbase,
      size: tx.size,
      locktime: tx.locktime,
      vin: tx.inputs,
      vout: tx.outputs,
      valueOut: tx.value,
      version: tx.version
    };
  }

  private toAppInput(input: ApiInput): AppInput {
    return {
      coinbase: input.coinbase.valueOf(),
      sequence: -1,
      n: -1,
      txid: input.txid,
      vout: input.vout,
      scriptSig: {
        hex: '',
        asm: '',
        addresses: [],
        type: ''
      },
      addr: input.address,
      valueSat: input.value,
      value: input.value,
      doubleSpentTxID: '',
      isConfirmed: true,
      confirmations: 1,
      unconfirmedInput: ''
    };
  }

  private toAppOutput(output: ApiInput): AppOutput {
    return {};
  }

  public getTxs(args?: { blockHash?: string }): Observable<{ txs: Array<AppTx> }> {
    let queryString: string = '';
    if (args.blockHash) {
      queryString += `?blockHash=${args.blockHash}`;
    }
    let url: string =
      this.api.apiPrefix +
      '/' +
      this.currency.selectedCurrency.toUpperCase() +
      '/' +
      this.defaults.getDefault('%NETWORK%') +
      '/' +
      'tx' +
      queryString;
    return this.http.get(url).map(data => {
      let txs: Array<ApiTx> = data.json();
      let appTxs: Array<AppTx> = txs.map(this.toAppTx);
      return { txs: appTxs };
    });
  }

  public getTx(hash: string): Observable<{ tx: AppTx }> {
    let url: string =
      this.api.apiPrefix +
      '/' +
      this.currency.selectedCurrency.toUpperCase() +
      '/' +
      this.defaults.getDefault('%NETWORK%') +
      '/' +
      'tx/' +
      hash;
    const coinsReq: Promise<CoinsApiResponse> = this.getCoins(hash).toPromise();
    return this.http.get(url).flatMap(async data => {
      let apiTx: ApiTx = data.json()[0];
      const coins: CoinsApiResponse = await coinsReq;
      apiTx.inputs = coins.inputs;
      apiTx.outputs = coins.outputs;
      let appTx: AppTx = this.toAppTx(apiTx);
      return { tx: appTx };
    });
  }

  public getCoins(txId: string): Observable<CoinsApiResponse> {
    let url: string =
      this.api.apiPrefix +
      '/' +
      this.currency.selectedCurrency.toUpperCase() +
      '/' +
      this.defaults.getDefault('%NETWORK%') +
      '/' +
      'tx/' +
      txId +
      '/coins';
    return this.http.get(url).map(data => {
      return data.json() as CoinsApiResponse;
    });
  }
}
