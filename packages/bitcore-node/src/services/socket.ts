import SocketIO = require('socket.io');
import { IBlock } from '../models/block';
import { ITransaction } from '../models/transaction';
import { LoggifyClass } from '../decorators/Loggify';

@LoggifyClass
export class SocketService {
  io?: SocketIO.Server;
  id: number = Math.random();

  constructor() {
    this.setServer = this.setServer.bind(this);
    this.signalTx = this.signalTx.bind(this);
    this.signalBlock = this.signalBlock.bind(this);
    this.signalAddressTx = this.signalAddressTx.bind(this);
  }

  setServer(io: SocketIO.Server) {
    console.log('setting socket server');
    this.io = io;
    console.log('ID', this.id);
  }

  signalBlock(block: IBlock) {
    console.log('ID', this.id);
    if (this.io) {
      const { chain, network } = block;
      console.log(`Attempting signal block ${chain}/${network}/inv`);
      this.io.of(`/${chain}/${network}/inv`).on('connection', socket => {
        console.log(`Signaling ${chain}/${network}/inv`);
        socket.emit('block', block);
      });
    } else {
      console.error('No IO connection', this.io);
    }
  }

  signalTx(tx: ITransaction) {
    if (this.io) {
      const { chain, network } = tx;
      this.io.of(`/${chain}/${network}/inv`).emit('tx', tx);
    }
  }

  signalAddressTx(address: string, tx: ITransaction) {
    if (this.io) {
      const { chain, network } = tx;
      this.io.of(`/${chain}/${network}/${address}`).emit(address, tx);
    }
  }
}

export const Socket = new SocketService();
