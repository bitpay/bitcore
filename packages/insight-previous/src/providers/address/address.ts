import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { BlocksProvider } from '../blocks/blocks';
import { ApiCoin, TxsProvider } from '../transactions/transactions';

export interface ApiAddr {
  confirmed: number;
  unconfirmed: number;
  balance: number;
}

@Injectable()
export class AddressProvider {
  constructor(
    public httpClient: HttpClient,
    public currency: CurrencyProvider,
    public blocks: BlocksProvider,
    public txsProvider: TxsProvider,
    private apiProvider: ApiProvider
  ) {}

  public getAddressBalance(
    addrStr?: string,
    chainNetwork?: ChainNetwork
  ): Observable<ApiAddr> {
    return this.httpClient.get<ApiAddr>(
      `${this.apiProvider.getUrlPrefix()}/${chainNetwork.chain}/${
        chainNetwork.network
      }/address/${addrStr}/balance`
    );
  }

  public getAddressActivity(addrStr?: string): Observable<ApiCoin[]> {
    return this.httpClient.get<ApiCoin[]>(
      `${this.apiProvider.getUrl()}/address/${addrStr}/txs?limit=1000`
    );
  }
}
