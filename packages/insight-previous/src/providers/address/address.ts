import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { Observable } from 'rxjs';
import { ApiProvider } from '../../providers/api/api';
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
    public http: Http,
    private api: ApiProvider,
    public currency: CurrencyProvider,
    public blocks: BlocksProvider,
    public txsProvider: TxsProvider
  ) {}

  public getAddressBalance(addrStr?: string): Observable<ApiAddr> {
    return this.http
      .get(this.api.getUrl() + `/address/${addrStr}/balance`)
      .map(data => {
        const addr: ApiAddr = data.json();
        return addr;
      });
  }

  public getAddressActivity(addrStr?: string): Observable<ApiCoin[]> {
    return this.http
      .get(this.api.getUrl() + `/address/${addrStr}/txs?limit=1000`)
      .map(data => {
        const txs = data.json() as ApiCoin[];
        return txs;
      });
  }
}
