import { EventEmitter } from 'events';
import { LoggifyClass } from '../decorators/Loggify';
import logger from '../logger';
import { BlockEvent, CoinEvent, EventModel, EventStorage, TxEvent } from '../models/events';
import { Config, ConfigService } from './config';
import { StorageService } from './storage';
import { Storage } from './storage';

@LoggifyClass
export class EventService {
  txEvent = new EventEmitter();
  blockEvent = new EventEmitter();
  addressCoinEvent = new EventEmitter();
  events = new EventEmitter();
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
    this.events.emit('start');
    if (this.storageService.connected) {
      this.wireup();
    } else {
      this.storageService.connection.on('CONNECTED', () => {
        this.wireup();
      });
    }
  }

  async stop() {
    logger.info('Stopping Event Service');
    this.stopped = true;
    this.events.emit('stop');
    this.events.removeAllListeners();
    this.txEvent.removeAllListeners();
    this.blockEvent.removeAllListeners();
    this.addressCoinEvent.removeAllListeners();
  }

  async wireup() {
    let lastBlockUpdate = new Date();
    let lastTxUpdate = new Date();
    let lastAddressTxUpdate = new Date();

    const retryTxCursor = async () => {
      try {
        const txCursor = this.eventModel.getTxTail(lastTxUpdate);
        while (!this.stopped && (await txCursor.hasNext())) {
          const txEvent = await txCursor.next();
          if (txEvent) {
            const tx = txEvent.payload as TxEvent;
            this.txEvent.emit('tx', tx);
            lastTxUpdate = new Date();
          }
        }
      } catch (err) {
        logger.error('Error in retryTxCursor:', err);
      } finally {
        if (!this.stopped) {
          setTimeout(retryTxCursor, 100);
        }
      }
    };
    retryTxCursor().catch(err => logger.error('Failed to start retryTxCursor:', err));

    const retryBlockCursor = async () => {
      try {
        const blockCursor = this.eventModel.getBlockTail(lastBlockUpdate);
        while (!this.stopped && (await blockCursor.hasNext())) {
          const blockEvent = await blockCursor.next();
          if (blockEvent) {
            const block = blockEvent.payload as BlockEvent;
            this.blockEvent.emit('block', block);
            lastBlockUpdate = new Date();
          }
        }
      } catch (err) {
        logger.error('Error in retryBlockCursor:', err);
      } finally {
        if (!this.stopped) {
          setTimeout(retryBlockCursor, 100);
        }
      }
    };
    retryBlockCursor().catch(err => logger.error('Failed to start retryBlockCursor:', err));

    const retryAddressTxCursor = async () => {
      try {
        const addressTxCursor = this.eventModel.getCoinTail(lastAddressTxUpdate);
        while (!this.stopped && (await addressTxCursor.hasNext())) {
          const addressTx = await addressTxCursor.next();
          if (addressTx) {
            const addressCoin = addressTx.payload as CoinEvent;
            this.addressCoinEvent.emit('coin', addressCoin);
            lastAddressTxUpdate = new Date();
          }
        }
      } catch (err) {
        logger.error('Error in retryAddressTxCursor:', err);
      } finally {
        if (!this.stopped) {
          setTimeout(retryAddressTxCursor, 100);
        }
      }
    };
    retryAddressTxCursor().catch(err => logger.error('Failed to start retryAddressTxCursor:', err));
  }

  async signalBlock(block: BlockEvent) {
    await this.eventModel.signalBlock(block);
  }

  async signalTx(tx: TxEvent) {
    await this.eventModel.signalTx(tx);
  }

  async signalAddressCoin(payload: CoinEvent) {
    await this.eventModel.signalAddressCoin(payload);
  }
}

export const Event = new EventService();
