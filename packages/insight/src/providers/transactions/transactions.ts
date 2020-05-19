import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
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
  mintTxid: string;
  mintHeight: number;
  spentTxid: string;
  spentHeight: number;
  value: number;
  coins?: any;
}

export interface ApiUtxoCoinTx extends ApiTx {
  coins: any;
  inputs: ApiCoin[];
  outputs: ApiCoin[];
  version: number;
}

export interface ApiEthTx extends ApiTx {
  gasLimit: number;
  gasPrice: number;
  internal: any[];
  nonce: number;
  to: string;
  from: string;
  fee: number;
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
  sequenceNumber: number;
}

export interface ApiEthCoin {
  blockHash: string;
  blockHeight: string;
  blockTime: string;
  blockTimeNormalized: string;
  chain: string;
  fee: number;
  from: string;
  gasLimit: number;
  gasPrice: number;
  network: string;
  nonce: string;
  to: string;
  txid: string;
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

export interface AppEthCoin {
  to: string;
  from: string;
  txid: string;
  fee: number;
  valueOut: number;
  height: number;
  blockheight: number;
  time: any;
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
  locktime: number;
  isCoinBase: boolean;
  confirmations: number;
  time: number;
  valueOut: number;
  size: number;
  fee: number;
  blockheight: number;
  blocktime: number;
  coins?: any;
}

export interface AppUtxoCoinsTx extends AppTx {
  coins?: any;
  vin: any[];
  vout: any[];
  version: number;
}

export interface AppEthTx extends AppTx {
  gasLimit: number;
  gasPrice: number;
  to: string;
  from: string;
}

@Injectable()
export class TxsProvider {
  constructor(
    public httpClient: HttpClient,
    public currency: CurrencyProvider,
    public blocksProvider: BlocksProvider,
    private apiProvider: ApiProvider
  ) {}

  public getFee(tx: AppUtxoCoinsTx): number {
    const sumSatoshis: any = (arr: any): number =>
      arr.reduce((prev, cur) => prev + cur.value, 0);
    const inputs: number = sumSatoshis(tx.vin);
    const outputs: number = sumSatoshis(tx.vout);
    const fee: number = tx.isCoinBase ? 0 : inputs - outputs;
    return fee;
  }

  public toEthAppTx(tx: ApiEthTx): AppEthTx {
    return {
      ...this.toAppTx(tx),
      to: tx.to,
      from: tx.from,
      gasLimit: tx.gasLimit,
      gasPrice: tx.gasPrice
    };
  }

  public toUtxoCoinsAppTx(tx: ApiUtxoCoinTx): AppUtxoCoinsTx {
    return {
      ...this.toAppTx(tx),
      vin: [],
      vout: [],
      version: tx.version
    };
  }

  public toAppTx(tx: ApiUtxoCoinTx | ApiEthTx): AppTx {
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
      valueOut: tx.value
    };
  }

  public toAppEthCoin(coin: ApiEthCoin): AppEthCoin {
    return {
      to: coin.to,
      from: coin.from,
      txid: coin.txid,
      fee: coin.fee,
      valueOut: coin.value,
      height: parseInt(coin.blockHeight, 10),
      blockheight: parseInt(coin.blockHeight, 10),
      time: new Date(coin.blockTime).getTime() / 1000
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

  public getTxs(
    chainNetwork: ChainNetwork,
    args?: { blockHash?: string }
  ): Observable<ApiEthTx[] & ApiUtxoCoinTx[]> {
    let queryString = '';
    if (args.blockHash) {
      queryString += `?blockHash=${args.blockHash}`;
    }
    const url = `${this.apiProvider.getUrl(chainNetwork)}/tx/${queryString}`;
    return this.httpClient.get<ApiEthTx[] & ApiUtxoCoinTx[]>(url);
  }

  public getTx(
    hash: string,
    chainNetwork: ChainNetwork
  ): Observable<ApiEthTx & ApiUtxoCoinTx> {
    const url = `${this.apiProvider.getUrl(chainNetwork)}/tx/${hash}`;
    return this.httpClient.get<ApiEthTx & ApiUtxoCoinTx>(url);
  }

  public getDailyTransactionHistory(chainNetwork: ChainNetwork) {
    const url = `${this.apiProvider.getUrl(
      chainNetwork
    )}/stats/daily-transactions`;
    return this.httpClient.get(url);
  }

  public getCoins(
    txId: string,
    chainNetwork: ChainNetwork
  ): Observable<CoinsApiResponse> {
    const url = `${this.apiProvider.getUrl(chainNetwork)}/tx/${txId}/coins`;
    return this.httpClient.get<CoinsApiResponse>(url);
  }

  public getConfirmations(
    blockheight: number,
    chainNetwork: ChainNetwork
  ): Observable<number> {
    return this.blocksProvider.getCurrentHeight(chainNetwork).map(data => {
      return blockheight > 0 ? data.height - blockheight + 1 : blockheight;
    });
  }
}
