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
    '%CHAIN%': string;
    '%API_PREFIX%': string;
    '%NETWORK%': string;
    '%NUM_BLOCKS%': string;
  } = {
    '%CHAIN%': process.env.CHAIN || 'BTC',
    '%API_PREFIX%': process.env.API_PREFIX || '/api',
    '%NETWORK%': process.env.NETWORK || 'regtest',
    '%NUM_BLOCKS%': process.env.NUM_BLOCKS || '15'
  };

  constructor(public http: Http) {}

  public getDefault(str: string): string {
    let theDefault: string = this.defaults[str] !== undefined ? this.defaults[str] : str;
    return theDefault;
  }

  public setDefault(str: string, value: any): void {
    this.defaults[str] = value;
  }
}
