import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent } from 'rxjs';

/**
 * TODO: This currently only checks network connectivity. It should also notify
 * the app if the connected bitcore-node starts failing (using
 * `ApiService.bitcoreAvailable`).
 */
@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private _isOnline = new BehaviorSubject(navigator.onLine);
  public isOnline = this._isOnline.asObservable();

  constructor() {
    const connect = fromEvent(window, 'online');
    const disconnect = fromEvent(window, 'offline');

    // TODO: also check for connectivity on window focus (when macOS sleeps with the app open, this sometimes gets stuck in an offline state, even when navigator.onLine is `true`)

    connect.subscribe(() => this._isOnline.next(true));
    disconnect.subscribe(() => this._isOnline.next(false));
  }
}
