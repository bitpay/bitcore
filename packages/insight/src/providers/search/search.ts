import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiProvider, ChainNetwork } from '../api/api';

interface CryptoSearchInput {
  input: string,
  chainNetwork: ChainNetwork,
  type: string
}

interface InputType {
  regexes: RegExp[],
  dataIndex?: number,
  type: string
  chainNetworks: ChainNetwork[],
}

@Injectable()
export class SearchProvider {
  private apiURL: string;

  // Some of these could be combined into more complex regexes, but have been intentionally kept relatively separate to
  // make it clear which address types are checked for so that we know in the future which address types are present/missing
  private inputTypes: InputType[] = [
    // Standard BTC / Legacy BCH address
    {
      regexes: [/^(bitcoin:)?([13][a-km-zA-HJ-NP-Z1-9]{25,34})/],
      dataIndex: 2,
      type: 'address',
      chainNetworks: [
        { chain: 'BTC', network: 'mainnet' }
      ],
    },
    // Standard BTC / Legacy BCH address
    {
      regexes: [/^(bitcoincash:)?([13][a-km-zA-HJ-NP-Z1-9]{25,34})/],
      dataIndex: 2,
      type: 'address',
      chainNetworks: [
        { chain: 'BCH', network: 'mainnet' }
      ],
    },
    // bech32 BTC Address
    {
      regexes: [/^(bitcoin:)?(bc1[ac-hj-np-zAC-HJ-NP-Z02-9]{11,71})/],
      dataIndex: 2,
      type: 'address',
      chainNetworks: [
        { chain: 'BTC', network: 'mainnet' }
      ],
    },
    // Standard BCH Address
    {
      regexes: [/^(bitcoincash:)?([qp][a-z0-9]{41})$/, /^(BITCOINCASH:)?([QP][A-Z0-9]{41})/],
      dataIndex: 2,
      type: 'address',
      chainNetworks: [
        { chain: 'BCH', network: 'mainnet' }
      ],
    },
    // Testnet BTC / BCH / Doge / LTC Address
    {
      regexes: [/^(bitcoin:|bchtest:|dogecoin:|litecoin:)?([2mn][1-9A-HJ-NP-Za-km-z]{26,35})/],
      dataIndex: 2,
      type: 'address',
      chainNetworks: [
        { chain: 'BTC', network: 'testnet' },
        { chain: 'BCH', network: 'testnet' },
        { chain: 'DOGE', network: 'testnet' }
      ],
    },
    // Testnet BCH Address
    {
      regexes: [/^(bchtest:)?([qp][a-z0-9]{41})$/, /^(BCHTEST:)?([QP][A-Z0-9]{41})/],
      dataIndex: 2,
      type: 'address',
      chainNetworks: [
        { chain: 'BCH', network: 'testnet' }
      ],
    },
    // ETH Address
    {
      regexes: [/^0x[a-fA-F0-9]{40}$/],
      type: 'address',
      chainNetworks: [
        { chain: 'ETH', network: 'mainnet' },
        { chain: 'ETH', network: 'testnet' }
      ],
    },
    // Doge Address
    {
      regexes: [/^(dogecoin:)?(D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32})/],
      dataIndex: 2,
      type: 'address',
      chainNetworks: [
        { chain: 'DOGE', network: 'mainnet' }
      ],
    },
    // LTC Address
    {
      regexes: [/^(litecoin:)?([LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$)/],
      dataIndex: 2,
      type: 'address',
      chainNetworks: [
        { chain: 'LTC', network: 'mainnet' }
      ],
    },
    // BTC / BCH / DOGE / LTC block or tx
    {
      regexes: [/^[A-Fa-f0-9]{64}$/],
      type: 'blockOrTx',
      chainNetworks: [
        { chain: 'BTC', network: 'mainnet' },
        { chain: 'BCH', network: 'mainnet' },
        { chain: 'DOGE', network: 'mainnet' },
        { chain: 'LTC', network: 'mainnet' },
        { chain: 'BTC', network: 'testnet' },
        { chain: 'BCH', network: 'testnet' },
        { chain: 'DOGE', network: 'testnet' },
        { chain: 'LTC', network: 'testnet' }
      ],
    },
    // ETH block or tx
    {
      regexes: [/^0x[A-Fa-f0-9]{64}$/],
      type: 'blockOrTx',
      chainNetworks: [
        { chain: 'ETH', network: 'mainnet' },
        { chain: 'ETH', network: 'testnet' }
      ],
    },
    // BTC / BCH / DOGE / ETH / LTC block height
    {
      regexes: [/^[0-9]{1,9}$/],
      type: 'block',
      chainNetworks: [
        { chain: 'BTC', network: 'mainnet' },
        { chain: 'BCH', network: 'mainnet' },
        { chain: 'DOGE', network: 'mainnet' },
        { chain: 'ETH', network: 'mainnet' },
        { chain: 'LTC', network: 'mainnet' },
        { chain: 'BTC', network: 'testnet' },
        { chain: 'BCH', network: 'testnet' },
        { chain: 'DOGE', network: 'testnet' },
        { chain: 'ETH', network: 'testnet' },
        { chain: 'LTC', network: 'testnet' }
      ],
    },
  ]

  constructor(
    private apiProvider: ApiProvider,
    private httpClient: HttpClient
  ) {}

  public search( searchInputs: CryptoSearchInput[], chainNetwork): Observable<any> {
    const searchArray: Array<Observable<any>> = [];
    if (chainNetwork.chain !== 'ALL') {
      // If user has selected a specific network, we only search that network for results
      searchInputs = searchInputs
        .filter(input => input.chainNetwork.chain === chainNetwork.chain)
        .filter(input => input.chainNetwork.network === chainNetwork.network)
    }
    searchInputs.forEach(search => {
      this.apiURL = `${this.apiProvider.getUrl(search.chainNetwork)}`;
      if (search.type === 'block') {
        searchArray.push(
          this.searchBlock(search.input).catch(err => Observable.of(err))
        );
      } else if (search.type === 'blockOrTx') {
        searchArray.push(
          this.searchBlock(search.input).catch(err => Observable.of(err))
        );
        searchArray.push(
          this.searchTx(search.input).catch(err => Observable.of(err))
        );
      } else if (search.type === 'address') {
        searchArray.push(
          this.searchAddr(search.input).catch(err => Observable.of(err))
        );
      }
    });
    return Observable.forkJoin(searchArray);
  }

  public determineInputType(input:string): Observable<CryptoSearchInput[]> {
    const searchInputs:CryptoSearchInput[] = [];
    for (const { regexes, chainNetworks, type, dataIndex } of this.inputTypes) {
      const index = regexes.findIndex(regex => regex.test(input));
      if (index > -1) {
        let localInput = input;
        // If defined then the data we care about is a subset of the actual user input (ie has prefix to discard)
        if (dataIndex !== undefined) {
          localInput = input.match(regexes[index])[dataIndex];
        }
        for (const chainNetwork of chainNetworks) {
          searchInputs.push({
            input: localInput,
            chainNetwork,
            type
          });
        }
      }
    }
    return Observable.of(searchInputs);
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
  private searchAddr(address: string): Observable<{ addr: any }> {
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
