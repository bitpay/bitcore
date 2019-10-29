import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiProvider, ChainNetwork } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { BlocksProvider } from '../blocks/blocks';
import { ApiCoin, ApiEthCoin, TxsProvider } from '../transactions/transactions';

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
      `${this.apiProvider.getUrl(chainNetwork)}/address/${addrStr}/balance`
    );
  }

  public getAddressActivity(
    addrStr?: string,
    chainNetwork?: ChainNetwork
  ): Observable<ApiCoin[] & ApiEthCoin[]> {
    return this.httpClient.get<ApiCoin[] & ApiEthCoin[]>(
      `${this.apiProvider.getUrl(
        chainNetwork
      )}/address/${addrStr}/txs?limit=1000`
    );
  }

  public getAddressActivityCoins(
    addrStr?: string,
    chainNetwork?: ChainNetwork
  ): Observable<any> {
    return this.httpClient.get<any>(
      `${this.apiProvider.getUrl(chainNetwork)}/address/${addrStr}/coins`
    );
  }
}
