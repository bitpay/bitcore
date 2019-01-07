import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { BehaviorSubject } from 'rxjs';
import 'rxjs/add/operator/map';
import { DefaultProvider } from '../../providers/default/default';

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
    this.getAvailableNetworks().subscribe(data => {
      const availableNetworks = data.json() as ChainNetwork[];
      this.networkSettings.next({
        availableNetworks,
        selectedNetwork: availableNetworks[0]
      });
    });
  }

  public getAvailableNetworks() {
    return this.http.get(this.getUrlPrefix() + '/status/enabled-chains');
  }

  public getUrlPrefix(): string {
    const prefix: string = this.defaults.getDefault('%API_PREFIX%');
    return prefix;
  }
  public getUrl(): string {
    const prefix: string = this.defaults.getDefault('%API_PREFIX%');
    const chain: string = this.networkSettings.value.selectedNetwork.chain;
    const network: string = this.networkSettings.value.selectedNetwork.network;
    const apiPrefix = `${prefix}/${chain}/${network}`;
    return apiPrefix;
  }

  public getConfig(): ChainNetwork {
    const config = {
      chain: this.networkSettings.value.selectedNetwork.chain,
      network: this.networkSettings.value.selectedNetwork.network
    }
    return config;
  }

  public changeNetwork(network: ChainNetwork): void {
    this.networkSettings.next({
      availableNetworks: this.networkSettings.value.availableNetworks,
      selectedNetwork: network
    });
  }
}
