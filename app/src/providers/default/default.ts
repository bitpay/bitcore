import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';

/*
  Generated class for the DefaultProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
*/
@Injectable()
export class DefaultProvider {
  private defaults: {
    '%DEFAULT_CURRENCY%': string,
    '%API_PREFIX%': string
  }= {
    '%DEFAULT_CURRENCY%': 'BTC',
    '%API_PREFIX%': '/api'
  };

  constructor(public http: Http) {
  }

  public getDefault(str: string): string {
    return (this.defaults[str] !== undefined) ? this.defaults[str] : str;
  }
}
