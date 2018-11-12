import SocketIO = require('socket.io');
import { LoggifyClass } from '../decorators/Loggify';
import { EventModel, IEvent } from '../models/events';

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
    this.io = io;
    this.io.sockets.on('connection', socket => {
      socket.on('room', room => {
        socket.join(room);
      });
    });
    this.wireupCursors();
  }

  async wireupCursors() {
    let lastBlockUpdate = new Date();
    let lastTxUpdate = new Date();
    let lastAddressTxUpdate = new Date();

    const retryTxCursor = async () => {
      const txCursor = EventModel.getTxTail(lastTxUpdate);
      while (await txCursor.hasNext()) {
        const txEvent = await txCursor.next();
        if (this.io && txEvent) {
          const tx = <IEvent.TxEvent>txEvent.payload;
          const { chain, network } = tx;
          this.io.sockets.in(`/${chain}/${network}/inv`).emit('tx', tx);
          lastTxUpdate = new Date();
        }
      }
      setTimeout(retryTxCursor, 5000);
    };
    retryTxCursor();

    const retryBlockCursor = async () => {
      const blockCursor = EventModel.getBlockTail(lastBlockUpdate);
      while (await blockCursor.hasNext()) {
        const blockEvent = await blockCursor.next();
        if (this.io && blockEvent) {
          const block = <IEvent.BlockEvent>blockEvent.payload;
          const { chain, network } = block;
          this.io.sockets.in(`/${chain}/${network}/inv`).emit('block', block);
          lastBlockUpdate = new Date();
        }
      }
      setTimeout(retryBlockCursor, 5000);
    };
    retryBlockCursor();

    const retryAddressTxCursor = async () => {
      const addressTxCursor = EventModel.getAddressTxTail(lastAddressTxUpdate);
      while (await addressTxCursor.hasNext()) {
        const addressTx = await addressTxCursor.next();
        if (this.io && addressTx) {
          const { address, tx } = <IEvent.AddressTxEvent>addressTx.payload;
          const { chain, network } = tx;
          this.io.sockets.in(`/${chain}/${network}/${address}`).emit(address, tx);
          lastAddressTxUpdate = new Date();
        }
      }
      setTimeout(retryAddressTxCursor, 5000);
    };
    retryAddressTxCursor();
  }

  async signalBlock(block: IEvent.BlockEvent) {
    await EventModel.signalBlock(block);
  }

  async signalTx(tx: IEvent.TxEvent) {
    await EventModel.signalTx(tx);
  }

  async signalAddressTx(address: string, tx: IEvent.TxEvent) {
    await EventModel.signalAddressTx(address, tx);
  }
}

export const Socket = new SocketService();
