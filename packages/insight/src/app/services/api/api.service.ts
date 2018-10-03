import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { retryBackoff } from 'backoff-rxjs';
import { BehaviorSubject, timer } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { IBlock, StreamingFindOptions } from '../../types/bitcore-node';
import { Chain } from '../../types/configuration';
import { ConfigService } from '../config/config.service';

// TODO: expose this setting as a BehaviorSubject, tone it down when the window isn't active?
const streamPollingPeriod = timer(0, 15 * 1000);

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

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private config: ConfigService, private http: HttpClient) {}

  private _bitcoreAvailable = new BehaviorSubject(true);
  // TODO: service down notification (if NetworkService is up but the service is unreachable)
  /**
   * Emits when availability of the service appears to change, e.g. when an API
   * call doesn't return, or when a retry is successful.
   */
  public bitcoreAvailable = this._bitcoreAvailable.asObservable();

  /**
   * Everything before the API route itself, without the trailing `/`.
   *
   * Usage example: `${apiBase}/route`
   */
  apiBase = (chain: Chain) =>
    `${this.config.apiPrefix.getValue()}/${chain.ticker}/${chain.network}`;

  private getBlocks = (chain: Chain, params: StreamingFindOptions<IBlock>) =>
    this.http.get<IBlock>(`${this.apiBase(chain)}/block`, {
      params: stringifyForQuery(params)
    });

  streamBlocks = (chain: Chain, params: StreamingFindOptions<IBlock>) =>
    streamPollingPeriod.pipe(
      switchMap(() => this.getBlocks(chain, params)),
      retryBackoff({
        initialInterval: 5 * 1000,
        shouldRetry: error => {
          // TODO: retry only if ERR_CONNECTION_REFUSED or 5xx error code
          if (!!error) {
            this._bitcoreAvailable.next(false);
            return true;
          }
        }
      }),
      finalize(() => {
        if (this._bitcoreAvailable.getValue() !== true) {
          this._bitcoreAvailable.next(true);
        }
      })
    );

  // TODO: rates API:
  // consumers subscribe to an observable – only if a consumer is listening, poll this.config.ratesApi for the rates object. If everyone unsubscribes, polling should stop, and the last rates object thrown away (we don't want to use old rates on a resubscription). If someone subscribes again, start from scratch.
}
