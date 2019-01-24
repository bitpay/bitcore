import logger from '../logger';
import { StorageService } from './storage';
import { LoggifyClass } from '../decorators/Loggify';
import { EventStorage, IEvent, EventModel } from '../models/events';
import { PassThrough } from 'stream';
import { Storage } from './storage';
import { Config, ConfigService } from './config';

@LoggifyClass
export class EventService {
  txStream = new PassThrough({ objectMode: true });
  blockStream = new PassThrough({ objectMode: true });
  addressCoinStream = new PassThrough({ objectMode: true });
  storageService: StorageService;
  configService: ConfigService;
  eventModel: EventModel;
  stopped = false;

  constructor({ storageService = Storage, eventModel = EventStorage, configService = Config } = {}) {
    this.storageService = storageService;
    this.configService = configService;
    this.eventModel = eventModel;
    this.signalTx = this.signalTx.bind(this);
    this.signalBlock = this.signalBlock.bind(this);
    this.signalAddressCoin = this.signalAddressCoin.bind(this);
  }

  start() {
    if (this.configService.isDisabled('event')) {
      logger.info('Disabled Event Service');
      return;
    }
    logger.info('Starting Event Service');
    this.stopped = false;
    if (this.storageService.connected) {
      this.wireup();
    } else {
      this.storageService.connection.on('CONNECTED', () => {
        this.wireup();
      });
    }
  }

  stop() {
    logger.info('Stopping Event Service');
    this.stopped = true;
  }

  async wireup() {
    let lastBlockUpdate = new Date();
    let lastTxUpdate = new Date();
    let lastAddressTxUpdate = new Date();

    const retryTxCursor = async () => {
      const txCursor = this.eventModel.getTxTail(lastTxUpdate);
      while (await txCursor.hasNext()) {
        const txEvent = await txCursor.next();
        if (txEvent) {
          const tx = <IEvent.TxEvent>txEvent.payload;
          this.txStream.write(tx);
          lastTxUpdate = new Date();
        }
      }
      if (!this.stopped) {
        setTimeout(retryTxCursor, 100);
      }
    };
    retryTxCursor();

    const retryBlockCursor = async () => {
      const blockCursor = this.eventModel.getBlockTail(lastBlockUpdate);
      while (await blockCursor.hasNext()) {
        const blockEvent = await blockCursor.next();
        if (blockEvent) {
          const block = <IEvent.BlockEvent>blockEvent.payload;
          this.blockStream.write(block);
          lastBlockUpdate = new Date();
        }
      }
      if (!this.stopped) {
        setTimeout(retryBlockCursor, 100);
      }
    };
    retryBlockCursor();

    const retryAddressTxCursor = async () => {
      const addressTxCursor = this.eventModel.getCoinTail(lastAddressTxUpdate);
      while (await addressTxCursor.hasNext()) {
        const addressTx = await addressTxCursor.next();
        if (addressTx) {
          const addressCoin = <IEvent.CoinEvent>addressTx.payload;
          this.addressCoinStream.write(addressCoin);
          lastAddressTxUpdate = new Date();
        }
      }
      if (!this.stopped) {
        setTimeout(retryAddressTxCursor, 100);
      }
    };
    retryAddressTxCursor();
  }

  async signalBlock(block: IEvent.BlockEvent) {
    await this.eventModel.signalBlock(block);
  }

  async signalTx(tx: IEvent.TxEvent) {
    await this.eventModel.signalTx(tx);
  }

  async signalAddressCoin(payload: IEvent.CoinEvent) {
    await this.eventModel.signalAddressCoin(payload);
  }
}

export const Event = new EventService();
