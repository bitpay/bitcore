import { EventEmitter } from 'events';
import 'source-map-support/register';

let log = require('npmlog');
log.debug = log.verbose;
log.disableColor();

export class MessageBroker extends EventEmitter {
  remote: boolean;
  mq: SocketIO.Socket;
  constructor(opts) {
    super();

    opts = opts || {};
    if (opts.messageBrokerServer) {
      const url = opts.messageBrokerServer.url;

      this.remote = true;
      this.mq = require('socket.io-client').connect(url);
      this.mq.on('connect', () => {});
      this.mq.on('connect_error', () => {
        log.warn('Error connecting to message broker server @ ' + url);
      });

      this.mq.on('msg', data => {
        this.emit('msg', data);
      });

      log.info('Using message broker server at ' + url);
    }
  }

  send(data) {
    if (this.remote) {
      this.mq.emit('msg', data);
    } else {
      this.emit('msg', data);
    }
  }

  onMessage(handler) {
    this.on('msg', handler);
  }
}
