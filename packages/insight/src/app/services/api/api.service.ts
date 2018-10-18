import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { retryBackoff } from 'backoff-rxjs';
import { NGXLogger } from 'ngx-logger';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { finalize, map, shareReplay, switchMap } from 'rxjs/operators';
import { IBlock, StreamingFindOptions } from '../../types/bitcore-node';
import { Chain, Chains } from '../../types/chains';
import { RateListing } from '../../types/units';
import { ConfigService } from '../config/config.service';

// TODO: expose this setting as a BehaviorSubject, tone it down when the window isn't active?
const streamPollingPeriod = () => timer(0, 5 * 1000);
const ratesStreamPollingPeriod = () => timer(0, 60 * 1000);

/**
 * Convert any object into an object with only elements of type `string`.
 * Useful for providing Angular's HttpClient with a set of query parameters.
 *
 * @param object an object which may contain non-string elements
 */
const stringifyForQuery = (object: any) =>
  Object.entries(object).reduce(
    (newObject, pair) => ({ ...newObject, [pair[0]]: pair[1].toString() }),
    {}
  );

const temporaryChainBase = (chain: Chain) =>
  chain.code === 'BCH'
    ? 'BCH/mainnet'
    : chain.code === 'tBCH'
      ? 'BCH/testnet'
      : chain.code === 'BTC'
        ? 'BTC/mainnet'
        : chain.code === 'tBTC'
          ? 'BTC/testnet'
          : 'unknownTemporaryChainBase';

const temporaryChainNetworkToCode = (chainNetwork: {
  chain: string;
  network: string;
}) =>
  Chains[
    `${chainNetwork.network === 'testnet' ? 't' : ''}${chainNetwork.chain}`
  ];

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(
    private config: ConfigService,
    private http: HttpClient,
    private logger: NGXLogger
  ) {}

  private _bitcoreAvailable = new BehaviorSubject(true);
  // TODO: service down notification (if NetworkService is up but the service is unreachable)

  /**
   * Emits when availability of the service appears to change, e.g. when an API
   * call doesn't return, or when a retry is successful.
   */
  public bitcoreAvailable = this._bitcoreAvailable.asObservable();

  streamRates = ratesStreamPollingPeriod().pipe(
    switchMap(() =>
      this.http.get<RateListing>(this.config.ratesApi$.getValue()).pipe(
        retryBackoff({
          initialInterval: 1 * 1000
        })
      )
    ),
    shareReplay(1)
  );

  /**
   * Everything before the API route itself, without the trailing `/`.
   *
   * Usage example: `${apiBase}/route`
   */
  apiBase = (chain: Chain) =>
    // TODO: pull Chain type into Bitcore
    // `${this.config.apiPrefix$.getValue()}/${chain.code}/${chain.network}`;
    `${this.config.apiPrefix$.getValue()}/${temporaryChainBase(chain)}`;

  streamFromBitcore = <T>(call: () => Observable<T>) =>
    streamPollingPeriod().pipe(
      switchMap(() => call()),
      retryBackoff({
        initialInterval: 5 * 1000,
        shouldRetry: error => {
          this.logger.error(error);
          this._bitcoreAvailable.next(false);
          return true;
        }
      }),
      finalize(() => {
        if (this._bitcoreAvailable.getValue() !== true) {
          this._bitcoreAvailable.next(true);
        }
      })
    );

  streamChains = () =>
    this.streamFromBitcore(() =>
      this.http
        .get<Array<{ chain: string; network: string }>>(
          `${this.config.apiPrefix$.getValue()}/status/enabled-chains`
        )
        .pipe(map(response => response.map<Chain>(temporaryChainNetworkToCode)))
    );

  streamBlocks = (chain: Chain, params: StreamingFindOptions<IBlock>) =>
    this.streamFromBitcore(() =>
      this.http.get<IBlock>(`${this.apiBase(chain)}/block`, {
        params: stringifyForQuery(params)
      })
    );

  streamBlock = (chain: Chain, hash: string) =>
    this.streamFromBitcore(() =>
      // TODO: `confirmations` should be in a proper type (e.g. IBlockExtended)
      this.http.get<IBlock & { confirmations: number }>(
        `${this.apiBase(chain)}/block/${hash}`
      )
    );
}
