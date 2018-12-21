import { LoggifyClass } from '../decorators/Loggify';
import { EventModel, IEvent } from '../models/events';
import { PassThrough } from 'stream';
import { Storage } from './storage';

@LoggifyClass
export class EventService {
  txStream = new PassThrough({ objectMode: true });
  blockStream = new PassThrough({ objectMode: true });
  addressCoinStream = new PassThrough({ objectMode: true });

  constructor() {
    this.signalTx = this.signalTx.bind(this);
    this.signalBlock = this.signalBlock.bind(this);
    this.signalAddressCoin = this.signalAddressCoin.bind(this);
    Storage.connection.on('CONNECTED', () => {
      this.wireup();
    });
  }

  async wireup() {
    let lastBlockUpdate = new Date();
    let lastTxUpdate = new Date();
    let lastAddressTxUpdate = new Date();

    const retryTxCursor = async () => {
      const txCursor = EventModel.getTxTail(lastTxUpdate);
      while (await txCursor.hasNext()) {
        const txEvent = await txCursor.next();
        if (txEvent) {
          const tx = <IEvent.TxEvent>txEvent.payload;
          this.txStream.write(tx);
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
        if (blockEvent) {
          const block = <IEvent.BlockEvent>blockEvent.payload;
          this.blockStream.write(block);
          lastBlockUpdate = new Date();
        }
      }
      setTimeout(retryBlockCursor, 5000);
    };
    retryBlockCursor();

    const retryAddressTxCursor = async () => {
      const addressTxCursor = EventModel.getCoinTail(lastAddressTxUpdate);
      while (await addressTxCursor.hasNext()) {
        const addressTx = await addressTxCursor.next();
        if (addressTx) {
          const addressCoin = <IEvent.CoinEvent>addressTx.payload;
          this.addressCoinStream.write(addressCoin);
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

  async signalAddressCoin(payload: IEvent.CoinEvent) {
    await EventModel.signalAddressCoin(payload);
  }
}

export const Event = new EventService();
