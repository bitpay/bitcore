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
  public apiPrefix: string;

  constructor(public http: Http, private defaults: DefaultProvider, public currency: CurrencyProvider) {
    const prefix: string = defaults.getDefault('%API_PREFIX%');
    const chain: string = this.currency.selectedCurrency.toUpperCase();
    const network: string = this.defaults.getDefault('%NETWORK%');
    this.apiPrefix = `${prefix}/${chain}/${network}`;
  }
}
