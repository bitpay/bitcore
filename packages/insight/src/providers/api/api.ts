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
  public networkSettings = {
    availableNetworks: [this.defaultNetwork],
    selectedNetwork: this.defaultNetwork
  };

  public ratesAPI = {
    btc: 'https://bitpay.com/api/rates',
    bch: 'https://bitpay.com/api/rates/bch',
    eth: 'https://bitpay.com/api/rates/eth'
  };

  constructor(
    public httpClient: HttpClient,
    private defaults: DefaultProvider,
    private logger: Logger
  ) {
    Observable.forkJoin(
      this.getAvailableNetworks('BTC').catch(err => Observable.of(undefined)),
      this.getAvailableNetworks('ETH').catch(err => Observable.of(undefined))
    ).subscribe(data => {
      const availableNetworks = _.compact(_.flatten(data));
      this.networkSettings = {
        availableNetworks,
        selectedNetwork: this.networkSettings.selectedNetwork
      };
    });
  }

  public getAvailableNetworks(chain): Observable<ChainNetwork[]> {
    return this.httpClient.get<ChainNetwork[]>(
      this.getUrlPrefix(chain) + '/status/enabled-chains'
    );
  }

  public getUrlPrefix(chain?): string {
    const c = chain ? chain : this.networkSettings.selectedNetwork.chain;
    const prefix: string =
      c === 'ETH'
        ? this.defaults.getDefault('%API_PREFIX_ETH%')
        : this.defaults.getDefault('%API_PREFIX%');
    return prefix;
  }

  public getUrl(): string {
    const chain: string = this.networkSettings.selectedNetwork.chain;
    const prefix: string =
      chain === 'ETH'
        ? this.defaults.getDefault('%API_PREFIX_ETH%')
        : this.defaults.getDefault('%API_PREFIX%');
    const network: string = this.networkSettings.selectedNetwork.network;
    const apiPrefix = `${prefix}/${chain}/${network}`;
    return apiPrefix;
  }

  public getConfig(): ChainNetwork {
    const config = {
      chain: this.networkSettings.selectedNetwork.chain,
      network: this.networkSettings.selectedNetwork.network
    };
    return config;
  }

  public changeNetwork(network: ChainNetwork): void {
    const availableNetworks = this.networkSettings.availableNetworks;
    const isValid = _.some(availableNetworks, network);
    if (!isValid) {
      this.logger.error(
        'Invalid URL: missing or invalid COIN or NETWORK param'
      );
      return;
    }
    this.networkSettings = {
      availableNetworks,
      selectedNetwork: network
    };
  }
}
