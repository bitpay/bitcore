import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { DefaultProvider } from '../../providers/default/default';

/*
  Generated class for the ApiProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
*/
@Injectable()
export class ApiProvider {
  public selectedChain: string = 'BTC';
  public selectedNetwork: string = 'mainnet';
  constructor(public http: Http, private defaults: DefaultProvider) {}

  public getUrlPrefix(): string {
    const prefix: string = this.defaults.getDefault('%API_PREFIX%');
    return prefix;
  }
  public getUrl(): string {
    const prefix: string = this.defaults.getDefault('%API_PREFIX%');
    const chain: string = this.selectedChain;
    const network: string = this.selectedNetwork;
    const apiPrefix: string = `${prefix}/${chain}/${network}`;
    return apiPrefix;
  }

  public changeChain(chain: string, network?: string): void {
    this.selectedChain = chain;
    this.selectedNetwork = network;
  }
}
