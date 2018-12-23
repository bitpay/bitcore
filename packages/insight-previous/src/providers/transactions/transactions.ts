import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { Observable } from 'rxjs/Observable';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { BlocksProvider } from '../blocks/blocks';

interface CoinsApiResponse {
  inputs: ApiCoin[];
  outputs: ApiCoin[];
}
export interface ApiTx {
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
  confirmations: number;
  locktime: number;
  inputs: ApiCoin[];
  outputs: ApiCoin[];
  mintTxid: string;
  mintHeight: number;
  spentTxid: string;
  spentHeight: number;
  value: number;
  version: number;
}

export interface ApiCoin {
  txid: string;
  mintTxid: string;
  coinbase: boolean;
  vout: number;
  address: string;
  script: {
    asm: string;
    type: string;
  };
  spentTxid: string;
  mintHeight: number;
  spentHeight: number;
  value: number;
}

export interface AppCoin {
  txid: string;
  valueOut: number;
  value: number;
  spentTxid: string;
  mintTxid: string;
  mintHeight: number;
  spentHeight: number;
}

export interface AppInput {
  coinbase: boolean;
  sequence: number;
  n: number;
  txid: string;
  vout: number;
  scriptSig: {
    hex: string;
    asm: string;
    addresses: string[];
    type: string;
  };
  addr: string;
  valueSat: number;
  value: number;
  doubleSpentTxID: string;
  isConfirmed: boolean;
  confirmations: number;
  unconfirmedInput: string;
}

export interface AppOutput {
  value: number;
  n: number;
  scriptPubKey: {
    hex: string;
    asm: string;
    addresses: string[];
    type: string;
  };
  spentTxId: null;
  spentIndex: null;
  spentHeight: null;
}

export interface AppTx {
  txid: string;
  blockhash: string;
  version: number;
  locktime: number;
  isCoinBase: boolean;
  vin: any[];
  vout: any[];
  confirmations: number;
  time: number;
  valueOut: number;
  size: number;
  fee: number;
  blockheight: number;
  blocktime: number;
}

@Injectable()
export class TxsProvider {
  constructor(
    public http: Http,
    private api: ApiProvider,
    public currency: CurrencyProvider,
    public blocks: BlocksProvider
  ) {}

  public getFee(tx: AppTx): number {
    const sumSatoshis: any = (arr: any): number =>
      arr.reduce((prev, cur) => prev + cur.value, 0);
    const inputs: number = sumSatoshis(tx.vin);
    const outputs: number = sumSatoshis(tx.vout);
    const fee: number = tx.isCoinBase ? 0 : inputs - outputs;
    return fee;
  }

  public toAppTx(tx: ApiTx): AppTx {
    return {
      txid: tx.txid,
      fee: null, // calculated later, when coins are retrieved
      blockheight: tx.blockHeight,
      confirmations: tx.confirmations,
      blockhash: tx.blockHash,
      blocktime: new Date(tx.blockTime).getTime() / 1000,
      time: new Date(tx.blockTime).getTime() / 1000,
      isCoinBase: tx.coinbase,
      size: tx.size,
      locktime: tx.locktime,
      vin: [], // populated when coins are retrieved
      vout: [], // populated when coins are retrieved
      valueOut: tx.value,
      version: tx.version
    };
  }

  public toAppCoin(coin: ApiCoin): AppCoin {
    return {
      txid: coin.txid,
      mintTxid: coin.mintTxid,
      mintHeight: coin.mintHeight,
      spentHeight: coin.spentHeight,
      valueOut: coin.value,
      value: coin.value,
      spentTxid: coin.spentTxid
    };
  }

  public getTxs(args?: { blockHash?: string }): Observable<{ txs: AppTx[] }> {
    let queryString = '';
    if (args.blockHash) {
      queryString += `?blockHash=${args.blockHash}`;
    }
    const url: string = this.api.getUrl() + '/tx' + queryString;
    return this.http.get(url).map(data => {
      const txs: ApiTx[] = data.json();
      const appTxs: AppTx[] = txs.map(tx => this.toAppTx(tx));
      return { txs: appTxs };
    });
  }

  public getTx(hash: string): Observable<{ tx: AppTx }> {
    const url: string = this.api.getUrl() + '/tx/' + hash;
    return this.http.get(url).flatMap(async data => {
      const apiTx: ApiTx = data.json();
      const appTx: AppTx = this.toAppTx(apiTx);
      return { tx: appTx };
    });
  }

  public getCoins(txId: string): Observable<CoinsApiResponse> {
    const url: string = this.api.getUrl() + '/tx/' + txId + '/coins';
    return this.http.get(url).map(data => {
      return data.json() as CoinsApiResponse;
    });
  }
}
