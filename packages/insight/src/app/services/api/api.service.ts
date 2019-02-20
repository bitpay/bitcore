import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { retryBackoff } from 'backoff-rxjs';
import { NGXLogger } from 'ngx-logger';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { finalize, map, shareReplay, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AuthheadJSON,
  CoinListingJSON,
  DailyTransactionsJSON,
  IBlock,
  StreamingFindOptions,
  TransactionJSON
} from '../../types/bitcore-node';
import { Chain, Chains } from '../../types/chains';
import { RateListing } from '../../types/units';
import { ConfigService } from '../config/config.service';

const streamPollingPeriod = () => timer(0, environment.pollingRateMilliseconds);
const ratesStreamPollingPeriod = () =>
  timer(0, environment.pollingRateMilliseconds);
const oneHour = 1000 * 60 * 60;

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

const consolidatedChainBase = (chain: Chain) =>
  chain.code === 'BCH'
    ? 'BCH/mainnet'
    : chain.code === 'tBCH'
      ? 'BCH/testnet'
      : chain.code === 'BTC'
        ? 'BTC/mainnet'
        : chain.code === 'tBTC'
          ? 'BTC/testnet'
          : 'unknownTemporaryChainBase';

const chainNetworkToCode = (chainNetwork: { chain: string; network: string }) =>
  Chains[
    `${chainNetwork.network === 'testnet' ? 't' : ''}${chainNetwork.chain}`
  ];

@Injectable({
  providedIn: 'root'
})
/**
 * Some implementation notes: you'll notice we're doing a huge amount of
 * repetitive polling in this service and around the app – this is intentional.
 *
 * To provide live-updating information, we could connect to a websocket API
 * provided by Bitcore. While much more data-efficient, the scaling story for
 * that on the server-side is quite complicated (including DOS resistance). In
 * the future, when the Bitcore stack has stabilize a bit, that could be a great
 * improvement.
 *
 * In the immediate term, the scaling story is much better when serving
 * highly-cacheable API responses to a huge number of clients. Even with client
 * polling rates and caching times configured to be very short (seconds), it's
 * still very simple to use a service like Cloudflare to reduce load on the
 * server itself while presenting a fast, live-updating experience to all the
 * clients.
 *
 * So we're polling a lot right now, but we can afford it; and the alternative
 * requires more server-side complexity to scale to many thousands of clients.
 */
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
    `${this.config.apiPrefix$.getValue()}/${consolidatedChainBase(chain)}`;

  streamFromBitcore = <T>(
    call: () => Observable<T>,
    pollingPeriod = streamPollingPeriod()
  ) =>
    pollingPeriod.pipe(
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
        .pipe(map(response => response.map<Chain>(chainNetworkToCode)))
    );

  streamBlocks = (chain: Chain, params: StreamingFindOptions<IBlock>) =>
    this.streamFromBitcore(() =>
      this.http.get<IBlock[]>(`${this.apiBase(chain)}/block`, {
        params: stringifyForQuery(params)
      })
    );

  streamBlock = (chain: Chain, hash: string) =>
    this.streamFromBitcore(() =>
      this.http.get<IBlock & { confirmations: number }>(
        `${this.apiBase(chain)}/block/${hash}`
      )
    );

  streamTransactions = (
    chain: Chain,
    params: StreamingFindOptions<TransactionJSON>
  ) =>
    this.streamFromBitcore(() =>
      this.http.get<TransactionJSON[]>(`${this.apiBase(chain)}/tx/`, {
        params: stringifyForQuery(params)
      })
    );

  streamTransaction = (chain: Chain, hash: string) =>
    this.streamFromBitcore(() =>
      this.http.get<TransactionJSON>(`${this.apiBase(chain)}/tx/${hash}`)
    );

  streamTransactionAuthhead = (chain: Chain, authbase: string) =>
    this.streamFromBitcore(() =>
      this.http.get<AuthheadJSON>(
        `${this.apiBase(chain)}/tx/${authbase}/authhead`
      )
    );

  streamTransactionCoins = (chain: Chain, txHash: string) =>
    this.streamFromBitcore(() =>
      this.http.get<CoinListingJSON>(
        `${this.apiBase(chain)}/tx/${txHash}/coins`
      )
    );
  streamStatsDailyTransactions = (chain: Chain) =>
    this.streamFromBitcore(
      () =>
        this.http.get<DailyTransactionsJSON>(
          `${this.apiBase(chain)}/stats/daily-transactions`
        ),
      timer(0, oneHour)
    );
}
