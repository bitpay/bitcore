import SocketIO = require('socket.io');
import { LoggifyClass } from '../decorators/Loggify';
import { EventModel, IEvent } from '../models/events';
import { Event } from './event';
import { ObjectID } from 'mongodb';

function SanitizeWallet(x: { wallets: ObjectID[] }) {
  const sanitized = Object.assign({}, x, { wallets: undefined });
  if (sanitized.wallets && sanitized.wallets.length > 0) {
    delete sanitized.wallets;
  }
  return sanitized;
}

@LoggifyClass
export class SocketService {
  io?: SocketIO.Server;
  id: number = Math.random();

  constructor() {
    this.setServer = this.setServer.bind(this);
    this.signalTx = this.signalTx.bind(this);
    this.signalBlock = this.signalBlock.bind(this);
    this.signalAddressCoin = this.signalAddressCoin.bind(this);
  }

  setServer(io: SocketIO.Server) {
    this.io = io;
    this.io.sockets.on('connection', socket => {
      socket.on('room', room => {
        socket.join(room);
      });
    });
    this.wireup();
  }

  async wireup() {
    Event.txStream.on('data', (tx: IEvent.TxEvent) => {
      if (this.io) {
        const { chain, network } = tx;
        const sanitizedTx = SanitizeWallet(tx);
        this.io.sockets.in(`/${chain}/${network}/inv`).emit('tx', sanitizedTx);
      }
    });

    Event.blockStream.on('data', (block: IEvent.BlockEvent) => {
      if (this.io) {
        const { chain, network } = block;
        this.io.sockets.in(`/${chain}/${network}/inv`).emit('block', block);
      }
    });

    Event.addressCoinStream.on('data', (addressCoin: IEvent.CoinEvent) => {
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
    await EventModel.signalBlock(block);
  }

  async signalTx(tx: IEvent.TxEvent) {
    await EventModel.signalTx(tx);
  }

  async signalAddressCoin(payload: IEvent.CoinEvent) {
    await EventModel.signalAddressCoin(payload);
  }
}

export const Socket = new SocketService();
