import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent } from 'rxjs';

// TODO: network connected/disconnected notification
@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private _isOnline = new BehaviorSubject(navigator.onLine);
  public isOnline = this._isOnline.asObservable();

  constructor() {
    const connect = fromEvent(window, 'online');
    const disconnect = fromEvent(window, 'offline');

    connect.subscribe(() => this._isOnline.next(true));
    disconnect.subscribe(() => this._isOnline.next(false));
  }
}
