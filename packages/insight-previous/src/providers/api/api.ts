import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DefaultProvider } from '../../providers/default/default';
import { Logger } from '../../providers/logger/logger';

import * as _ from 'lodash';

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
  public defaultNetwork = {
    chain: this.defaults.getDefault('%CHAIN%'),
    network: this.defaults.getDefault('%NETWORK%')
  };
  public networkSettings = new BehaviorSubject<NetworkSettings>({
    availableNetworks: [this.defaultNetwork],
    selectedNetwork: this.defaultNetwork
  });
  public ratesAPI = {
    btc: 'https://bitpay.com/api/rates',
    bch: 'https://bitpay.com/api/rates/bch'
  };

  constructor(
    public httpClient: HttpClient,
    private defaults: DefaultProvider,
    private logger: Logger
  ) {
    this.getAvailableNetworks().subscribe(data => {
      const availableNetworks = data;
      this.networkSettings.next({
        availableNetworks,
        selectedNetwork: this.networkSettings.value.selectedNetwork
      });
    });
  }

  public getAvailableNetworks(): Observable<ChainNetwork[]> {
    return this.httpClient.get<ChainNetwork[]>(
      this.getUrlPrefix() + '/status/enabled-chains'
    );
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
    };
    return config;
  }

  public changeNetwork(network: ChainNetwork): void {
    const availableNetworks = this.networkSettings.value.availableNetworks;
    const isValid = _.some(availableNetworks, network);
    if (!isValid) {
      this.logger.error(
        'Invalid URL: missing or invalid COIN or NETWORK param'
      );
      return;
    }
    this.networkSettings.next({
      availableNetworks,
      selectedNetwork: network
    });
  }
}
