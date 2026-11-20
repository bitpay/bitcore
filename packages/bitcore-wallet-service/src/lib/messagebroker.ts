import { EventEmitter } from 'events';
import * as io from 'socket.io-client';
import 'source-map-support/register';
import logger from './logger';
import type { Notification } from './model/notification';

export class MessageBroker extends EventEmitter {
  remote: boolean = false;
  mq: io.Socket;

  constructor(opts) {
    super();

    opts = opts || {};
    if (opts.messageBrokerServer) {
      const url = opts.messageBrokerServer.url;

      this.remote = true;
      this.mq = io.connect(url);
      this.mq.on('connect', () => {});
      this.mq.on('connect_error', () => {
        logger.warn('Error connecting to message broker server @ ' + url);
      });

      this.mq.on('msg', data => {
        this.emit('msg', data);
      });

      logger.info('Using message broker server at ' + url);
    }
  }

  send(data: Notification) {
    if (this.remote) {
      this.mq.emit('msg', data);
    } else {
      this.emit('msg', data);
    }
  }

  onMessage(handler: (data: Notification) => void) {
    this.on('msg', handler);
  }

  offMessage(handler: (data: Notification) => void) {
    this.off('msg', handler);
  }
}
