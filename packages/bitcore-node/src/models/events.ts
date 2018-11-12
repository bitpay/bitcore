import { BaseModel } from './base';
import { ITransaction } from './transaction';
import { IBlock } from '../types/Block';

export namespace IEvent {
  export type BlockEvent = Partial<IBlock>;
  export type TxEvent = Partial<ITransaction>;
  export type AddressTxEvent = { tx: IEvent.TxEvent; address: string };
}
interface IEvent {
  payload: IEvent.BlockEvent | IEvent.TxEvent | IEvent.AddressTxEvent;
  type: 'block' | 'tx' | 'addresstx';
  emitTime: Date;
}
class Event extends BaseModel<IEvent> {
  constructor() {
    super('events');
  }

  allowedPaging = [];

  async onConnect() {
    this.collection.createIndex({ type: 1, emitTime: 1 }, { background: true });

    const capped = await this.collection.isCapped();
    if (!capped) {
      this.db!.createCollection('events', { capped: true, size: 10000 });
    }
  }

  public signalBlock(block: IEvent.BlockEvent) {
    this.collection.insertOne({ payload: block, emitTime: new Date(), type: 'block' });
  }

  public signalTx(tx: IEvent.TxEvent) {
    this.collection.insertOne({ payload: tx, emitTime: new Date(), type: 'tx' });
  }

  public signalAddressTx(address: string, tx: IEvent.TxEvent) {
    this.collection.insertOne({ payload: { tx, address }, emitTime: new Date(), type: 'addresstx' });
  }

  public getBlockTail(lastSeen: Date) {
    return this.collection.find({ type: 'block', emitTime: { $gte: lastSeen } });
  }

  public getTxTail(lastSeen: Date) {
    return this.collection.find({ type: 'tx', emitTime: { $gte: lastSeen } });
  }

  getAddressTxTail(lastSeen: Date) {
    return this.collection.find({ type: 'tx', emitTime: { $gte: lastSeen } });
  }
}
export const EventModel = new Event();
