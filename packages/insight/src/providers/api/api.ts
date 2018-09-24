import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { DefaultProvider } from '../../providers/default/default';
import { BehaviorSubject } from 'rxjs';

/*
  Generated class for the ApiProvider provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular DI.
*/

export interface ChainNetwork {
  chain: string;
  network: string;
}
export interface NetworkSettings {
  availableNetworks: ChainNetwork[];
  selectedNetwork: ChainNetwork;
}

@Injectable()
export class ApiProvider {
  public networkSettings = new BehaviorSubject<NetworkSettings>({
    availableNetworks: undefined,
    // FIXME: a lot of code still depends on this value being available instantly – needs to be rewritten to accommodate `undefined`
    selectedNetwork: { chain: 'BTC', network: 'mainnet' }
  });

  constructor(public http: Http, private defaults: DefaultProvider) {
    this.http.get(this.getUrlPrefix() + '/status/enabled-chains').subscribe(data => {
      const availableNetworks = data.json() as Array<ChainNetwork>;
      this.networkSettings.next({
        availableNetworks,
        selectedNetwork: availableNetworks[0]
      });
    });
  }

  public getUrlPrefix(): string {
    const prefix: string = this.defaults.getDefault('%API_PREFIX%');
    return prefix;
  }
  public getUrl(): string {
    const prefix: string = this.defaults.getDefault('%API_PREFIX%');
    const chain: string = this.networkSettings.value.selectedNetwork.chain;
    const network: string = this.networkSettings.value.selectedNetwork.network;
    const apiPrefix: string = `${prefix}/${chain}/${network}`;
    return apiPrefix;
  }

  public changeNetwork(network: ChainNetwork): void {
    this.networkSettings.next({
      availableNetworks: this.networkSettings.value.availableNetworks,
      selectedNetwork: network
    });
  }
}
