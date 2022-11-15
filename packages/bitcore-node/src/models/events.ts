import { StorageService } from '../services/storage';
import { IBlock } from '../types/Block';
import { BaseModel } from './base';
import { ICoin } from './coin';
import { ITransaction } from './transaction';

export type BlockEvent = IBlock;
export type TxEvent = ITransaction;
export interface CoinEvent {
  coin: Partial<ICoin>;
  address: string;
}
interface IEvent {
  payload: BlockEvent | TxEvent | CoinEvent;
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

  public signalBlock(block: BlockEvent) {
    return this.collection.insertOne({ payload: block, emitTime: new Date(), type: 'block' });
  }

  public signalTx(tx: TxEvent) {
    return this.collection.insertOne({ payload: tx, emitTime: new Date(), type: 'tx' });
  }

  public signalTxs(txs: TxEvent[]) {
    this.collection.insertMany(txs.map(tx => ({ payload: tx, emitTime: new Date(), type: 'tx' as 'tx' })));
  }

  public signalAddressCoin(payload: CoinEvent) {
    return this.collection.insertOne({ payload, emitTime: new Date(), type: 'coin' });
  }

  public signalAddressCoins(coins: CoinEvent[]) {
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
