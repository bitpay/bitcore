import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiProvider, ChainNetwork } from '../api/api';

@Injectable()
export class SearchProvider {
  private apiURL: string;

  constructor(
    private apiProvider: ApiProvider,
    private httpClient: HttpClient
  ) {}

  public search(
    input: string,
    type: string,
    chainNetwork: ChainNetwork
  ): Observable<any> {
    if (chainNetwork.chain !== 'ALL') {
      this.apiURL = `${this.apiProvider.getUrl(chainNetwork)}`;
      switch (type) {
        case 'blockOrTx':
          return Observable.forkJoin(
            this.searchBlock(input).catch(err => Observable.of(err)),
            this.searchTx(input).catch(err => Observable.of(err))
          );
        case 'addr':
          return this.searchAddr(input);
      }
    } else {
      const searchArray: Array<Observable<any>> = [];
      this.apiProvider.networkSettings.availableNetworks.forEach(network => {
        if (network.chain !== 'ALL') {
          this.apiURL = `${this.apiProvider.getUrl(network)}`;
          searchArray.push(
            this.searchBlock(input).catch(err => Observable.of(err))
          );
          searchArray.push(
            this.searchTx(input).catch(err => Observable.of(err))
          );
          searchArray.push(
            this.searchAddr(input).catch(err => Observable.of(err))
          );
        }
      });
      return Observable.forkJoin(searchArray);
    }
  }

  public isInputValid(inputValue, chainNetwork): Observable<any> {
    if (chainNetwork.chain !== 'ALL') {
      return this.httpClient
        .get<{ isValid: boolean; type: string }>(
          `${this.apiProvider.getUrl(chainNetwork)}/valid/${inputValue}`
        )
        .pipe(map(res => ({ isValid: res.isValid, type: res.type })));
    } else {
      return Observable.of({ isValid: true, type: 'all' });
    }
  }

  private searchBlock(block: string): Observable<{ block: any }> {
    return this.httpClient
      .get<{ block: any }>(`${this.apiURL}/block/${block}`)
      .pipe(map(res => ({ block: res })));
  }
  private searchTx(txid: string): Observable<{ tx: any }> {
    return this.httpClient
      .get<{ tx: any }>(`${this.apiURL}/tx/${txid}`)
      .pipe(map(res => ({ tx: res })));
  }
  private searchAddr(addr: string): Observable<{ addr: any }> {
    const address = this.extractAddress(addr);
    const apiURL = _.includes(this.apiURL, 'ETH')
      ? `${this.apiURL}/address/${address}/txs?limit=1`
      : `${this.apiURL}/address/${address}`;
    return this.httpClient
      .get<{ addr: any }>(apiURL)
      .pipe(map(res => ({ addr: res })));
  }
  private extractAddress(address: string): string {
    const extractedAddress = address
      .replace(/^(bitcoincash:|bchtest:|bitcoin:)/i, '')
      .replace(/\?.*/, '');
    return extractedAddress || address;
  }
}
