import logger from '../logger';
import SocketIO = require('socket.io');
import * as http from 'http';
import { LoggifyClass } from '../decorators/Loggify';
import { EventStorage, EventModel, IEvent } from '../models/events';
import { Event, EventService } from './event';
import { ObjectID } from 'mongodb';
import { Config, ConfigService } from './config';
import { ConfigType } from '../types/Config';

function SanitizeWallet(x: { wallets: ObjectID[] }) {
  const sanitized = Object.assign({}, x, { wallets: undefined });
  if (sanitized.wallets && sanitized.wallets.length > 0) {
    delete sanitized.wallets;
  }
  return sanitized;
}

@LoggifyClass
export class SocketService {
  httpServer?: http.Server;
  io?: SocketIO.Server;
  id: number = Math.random();
  configService: ConfigService;
  serviceConfig: ConfigType['services']['socket'];
  eventService: EventService;
  eventModel: EventModel;

  constructor({ eventService = Event, eventModel = EventStorage, configService = Config } = {}) {
    this.eventService = eventService;
    this.configService = configService;
    this.serviceConfig = this.configService.for('socket');
    this.eventModel = eventModel;
    this.start = this.start.bind(this);
    this.signalTx = this.signalTx.bind(this);
    this.signalBlock = this.signalBlock.bind(this);
    this.signalAddressCoin = this.signalAddressCoin.bind(this);
  }

  start({ server }: { server: http.Server }) {
    if (this.configService.isDisabled('socket')) {
      logger.info('Disabled Socket Service');
      return;
    }
    logger.info('Starting Socket Service');
    this.httpServer = server;
    this.io = SocketIO(server);
    this.io.sockets.on('connection', socket => {
      socket.on('room', room => {
        socket.join(room);
      });
    });
    this.wireup();
  }

  stop() {
    logger.info('Stopping Socket Service');
    return new Promise(resolve => {
      if (this.io) {
        this.io.close(resolve);
      } else {
        resolve();
      }
    });
  }

  async wireup() {
    this.eventService.txStream.on('data', (tx: IEvent.TxEvent) => {
      if (this.io) {
        const { chain, network } = tx;
        const sanitizedTx = SanitizeWallet(tx);
        this.io.sockets.in(`/${chain}/${network}/inv`).emit('tx', sanitizedTx);
      }
    });

    this.eventService.blockStream.on('data', (block: IEvent.BlockEvent) => {
      if (this.io) {
        const { chain, network } = block;
        this.io.sockets.in(`/${chain}/${network}/inv`).emit('block', block);
      }
    });

    this.eventService.addressCoinStream.on('data', (addressCoin: IEvent.CoinEvent) => {
      if (this.io) {
        const { coin, address } = addressCoin;
        const { chain, network } = coin;
        const sanitizedCoin = SanitizeWallet(coin);
        this.io.sockets.in(`/${chain}/${network}/address`).emit(address, sanitizedCoin);
        this.io.sockets.in(`/${chain}/${network}/inv`).emit('coin', sanitizedCoin);
      }
    });
  }

  async signalBlock(block: IEvent.BlockEvent) {
    await EventStorage.signalBlock(block);
  }

  async signalTx(tx: IEvent.TxEvent) {
    await EventStorage.signalTx(tx);
  }

  async signalAddressCoin(payload: IEvent.CoinEvent) {
    await EventStorage.signalAddressCoin(payload);
  }
}

export const Socket = new SocketService();
