import { EventEmitter } from 'events';
let _instance;

export class NotificationBroadcaster extends EventEmitter {
  broadcast(eventName, notification, walletService) {
    this.emit(eventName, notification, walletService);
  }
  static singleton() {
    if (!_instance) {
      _instance = new NotificationBroadcaster();
    }
    return _instance;
  }
}

module.exports = NotificationBroadcaster.singleton();
