import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { DefaultProvider } from '../../providers/default/default';
import { CurrencyProvider } from '../../providers/currency/currency';

/*
  Generated class for the ApiProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
*/
@Injectable()
export class ApiProvider {
  constructor(public http: Http, private defaults: DefaultProvider, public currency: CurrencyProvider) {}

  public getUrl(): string {
    const prefix: string = this.defaults.getDefault('%API_PREFIX%');
    const chain: string = this.currency.selectedCurrency.toUpperCase();
    const network: string = this.defaults.getDefault('%NETWORK%');
    const apiPrefix: string = `${prefix}/${chain}/${network}`;
    return apiPrefix;
  }
}
