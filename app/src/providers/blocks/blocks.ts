import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { ApiProvider } from '../../providers/api/api';
import { CurrencyProvider } from '../../providers/currency/currency';
import { DefaultProvider } from '../../providers/default/default';

/*
  Generated class for the BlocksProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
*/
@Injectable()
export class BlocksProvider {

  constructor(
    public http: Http,
    private api: ApiProvider,
    public currency: CurrencyProvider,
    private defaults: DefaultProvider
  ) {
  }

  public getBlocks(): any {
    let url: string = this.api.apiPrefix + '/' +
      this.currency.selectedCurrency.toUpperCase() + '/' +
      this.defaults.getDefault('%NETWORK%') + '/' +
      '/block';
    return this.http.get(url);
  }

}
