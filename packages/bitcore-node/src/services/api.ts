import * as http from 'http';
import app from '../routes';
import logger from '../logger';
import config from '../config';
import { LoggifyClass } from '../decorators/Loggify';
import { Storage, StorageService } from './storage';
import { Socket, SocketService } from './socket';
import { ConfigService, Config } from './config';

@LoggifyClass
export class ApiService {
  port: number;
  timeout: number;
  configService: ConfigService;
  storageService: StorageService;
  socketService: SocketService;
  httpServer: http.Server;

  constructor({
    port = 3000,
    timeout = 600000,
    configService = Config,
    storageService = Storage,
    socketService = Socket
  } = {}) {
    this.port = port;
    this.timeout = timeout;
    this.configService = configService;
    this.storageService = storageService;
    this.socketService = socketService;
    this.httpServer = new http.Server(app);
  }

  async start() {
    if (this.configService.isDisabled('api')) {
      logger.info(`Disabled API Service`);
      return;
    }
    if (!this.storageService.connected) {
      await this.storageService.start({});
    }
    this.httpServer.timeout = this.timeout;
    this.httpServer.listen(this.port, () => {
      logger.info(`Starting API Service on port ${this.port}`);
      this.socketService.start({ server: this.httpServer });
    });
    return this.httpServer;
  }

  stop() {
    return new Promise(resolve => {
      this.httpServer.close(resolve);
    });
  }
}

// TOOO: choose a place in the config for the API timeout and include it here
export const Api = new ApiService({
  port: config.port
});
