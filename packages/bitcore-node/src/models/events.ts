import { BaseModel } from './base';
import { ITransaction } from './transaction';
import { IBlock } from '../types/Block';
import { ICoin } from './coin';
import { StorageService } from '../services/storage';

export namespace IEvent {
  export type BlockEvent = IBlock;
  export type TxEvent = ITransaction;
  export type CoinEvent = { coin: Partial<ICoin>; address: string };
}
interface IEvent {
  payload: IEvent.BlockEvent | IEvent.TxEvent | IEvent.CoinEvent;
  type: 'block' | 'tx' | 'coin';
  emitTime: Date;
}
export class EventModel extends BaseModel<IEvent> {
  constructor(storage?: StorageService) {
    super('events', storage);
  }

  allowedPaging = [];

  async onConnect() {
    await this.collection.createIndex({ type: 1, emitTime: 1 }, { background: true });
    await this.collection.createIndex({ emitTime: 1 }, { background: true, expireAfterSeconds: 60 * 5 });
  }

  public signalBlock(block: IEvent.BlockEvent) {
    return this.collection.insertOne({ payload: block, emitTime: new Date(), type: 'block' });
  }

  public signalTx(tx: IEvent.TxEvent) {
    return this.collection.insertOne({ payload: tx, emitTime: new Date(), type: 'tx' });
  }

  public signalTxs(txs: IEvent.TxEvent[]) {
    this.collection.insertMany(txs.map(tx => ({ payload: tx, emitTime: new Date(), type: 'tx' as 'tx' })));
  }

  public signalAddressCoin(payload: IEvent.CoinEvent) {
    return this.collection.insertOne({ payload, emitTime: new Date(), type: 'coin' });
  }

  public signalAddressCoins(coins: IEvent.CoinEvent[]) {
    return this.collection.insertMany(
      coins.map(coin => ({ payload: coin, emitTime: new Date(), type: 'coin' as 'coin' }))
    );
  }

  public getBlockTail(lastSeen: Date) {
    return this.collection.find({ type: 'block', emitTime: { $gte: lastSeen } }).addCursorFlag('noCursorTimeout', true);
  }

  public getTxTail(lastSeen: Date) {
    return this.collection.find({ type: 'tx', emitTime: { $gte: lastSeen } }).addCursorFlag('noCursorTimeout', true);
  }

  getCoinTail(lastSeen: Date) {
    return this.collection.find({ type: 'coin', emitTime: { $gte: lastSeen } }).addCursorFlag('noCursorTimeout', true);
  }
}
export const EventStorage = new EventModel();
