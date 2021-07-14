import * as http from 'http';
import { ObjectID } from 'mongodb';
import SocketIO = require('socket.io');
import { LoggifyClass } from '../decorators/Loggify';
import logger from '../logger';
import { CoinEvent, EventModel, EventStorage, TxEvent } from '../models/events';
import { BlockEvent } from '../models/events';
import { WalletStorage } from '../models/wallet';
import { ConfigType } from '../types/Config';
import { Auth, VerificationPayload } from '../utils/auth';
import { Config, ConfigService } from './config';
import { Event, EventService } from './event';

function SanitizeWallet(x: { wallets?: ObjectID[] }) {
  const sanitized = Object.assign({}, x, { wallets: new Array<ObjectID>() });
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
  stopped = true;

  constructor({ eventService = Event, eventModel = EventStorage, configService = Config } = {}) {
    this.eventService = eventService;
    this.configService = configService;
    this.serviceConfig = this.configService.for('socket');
    this.eventModel = eventModel;
    this.wireup = this.wireup.bind(this);
    this.start = this.start.bind(this);
    this.signalTx = this.signalTx.bind(this);
    this.signalBlock = this.signalBlock.bind(this);
    this.signalAddressCoin = this.signalAddressCoin.bind(this);
  }

  validateRequest(payload: VerificationPayload) {
    try {
      const valid = Auth.verifyRequestSignature(payload);
      return valid;
    } catch (e) {
      return false;
    }
  }

  start({ server }: { server: http.Server }) {
    const bwsKeys = this.serviceConfig.bwsKeys;
    if (this.configService.isDisabled('socket')) {
      logger.info('Disabled Socket Service');
      return;
    }
    if (this.stopped) {
      this.stopped = false;
      logger.info('Starting Socket Service');
      this.httpServer = server;
      this.io = SocketIO(server);
      this.io.sockets.on('connection', socket => {
        socket.on('room', (room: string, payload: VerificationPayload) => {
          const chainNetwork = room.slice(0, room.lastIndexOf('/') + 1);
          const roomName = room.slice(room.lastIndexOf('/') + 1);
          switch (roomName) {
            case 'wallets':
              if (bwsKeys.includes(payload.pubKey) && this.validateRequest(payload)) {
                socket.join(room);
              } else {
                socket.emit('failure', { message: 'Authentication failed' });
              }
              break;
            case 'wallet':
              if (this.validateRequest(payload)) {
                socket.join(chainNetwork + payload.pubKey);
              } else {
                socket.emit('failure', { message: 'Authentication failed' });
              }
              break;
            case 'inv':
            case 'address':
              socket.join(room);
              break;
          }
        });
      });
    }
    this.wireup();
    logger.info('Started Socket Service');
  }

  async stop() {
    logger.info('Stopping Socket Service');
    this.stopped = true;
  }

  async wireup() {
    this.eventService.txEvent.on('tx', async (tx: TxEvent) => {
      if (!this.stopped && this.io) {
        const { chain, network } = tx;
        const sanitizedTx = SanitizeWallet(tx);
        this.io.sockets.in(`/${chain}/${network}/inv`).emit('tx', sanitizedTx);

        if (tx.wallets && tx.wallets.length) {
          const objectIds = tx.wallets.map(w => new ObjectID(w));
          const wallets = await WalletStorage.collection.find({ _id: { $in: objectIds } }).toArray();
          for (let wallet of wallets) {
            this.io.sockets.in(`/${chain}/${network}/wallets`).emit('tx', { pubKey: wallet.pubKey, tx });
            this.io.sockets
              .in(`/${chain}/${network}/${wallet.pubKey}`)
              .emit('tx', { pubKey: wallet.pubKey, tx: sanitizedTx });
          }
        }
      }
    });

    this.eventService.blockEvent.on('block', (block: BlockEvent) => {
      if (!this.stopped && this.io) {
        const { chain, network } = block;
        this.io.sockets.in(`/${chain}/${network}/inv`).emit('block', block);
      }
    });

    this.eventService.addressCoinEvent.on('coin', async (addressCoin: CoinEvent) => {
      if (!this.stopped && this.io) {
        const { coin, address } = addressCoin;
        const { chain, network } = coin;
        const sanitizedCoin = SanitizeWallet(coin);
        this.io.sockets.in(`/${chain}/${network}/address`).emit(address, sanitizedCoin);
        this.io.sockets.in(`/${chain}/${network}/inv`).emit('coin', sanitizedCoin);
        if (coin.wallets && coin.wallets.length) {
          const objectIds = coin.wallets.map(w => new ObjectID(w));
          const wallets = await WalletStorage.collection.find({ _id: { $in: objectIds } }).toArray();
          for (let wallet of wallets) {
            this.io.sockets.in(`/${chain}/${network}/wallets`).emit('coin', { pubKey: wallet.pubKey, coin });
            this.io.sockets
              .in(`/${chain}/${network}/${wallet.pubKey}`)
              .emit('coin', { pubKey: wallet.pubKey, coin: sanitizedCoin });
          }
        }
      }
    });
  }

  async signalBlock(block: BlockEvent) {
    await EventStorage.signalBlock(block);
  }

  async signalTx(tx: TxEvent) {
    await EventStorage.signalTx(tx);
  }

  async signalAddressCoin(payload: CoinEvent) {
    await EventStorage.signalAddressCoin(payload);
  }
}

export const Socket = new SocketService();
