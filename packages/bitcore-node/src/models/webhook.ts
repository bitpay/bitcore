import { ObjectId } from 'mongodb';
import { StorageService } from '../services/storage';
import { BaseModel } from './base';

export interface IWebhook {
  _id?: ObjectId;
  chain: string;
  network: string;
  source: string;
  sourceId: string;
  tag?: string;
  body: any;
  timestamp: Date;
  processed: boolean;
}

export class WebhookModel extends BaseModel<IWebhook> {
  constructor(storage?: StorageService) {
    super('webhook', storage);
  }
  allowedPaging = [];

  onConnect() {
    // capped at 100 MiB
    this.db?.createCollection(this.collectionName, { capped: true, size: (2 ** 20) * 100 })
      .catch((err) => { if (err.codeName !== 'NamespaceExists' && err.code !== 48) throw err; });
    this.collection.createIndex({ chain: 1, network: 1, source: 1 }, { background: true });
  }

  getTail(params: { chain: string; network: string; }) {
    const { chain, network } = params;

    const MINUTE = 1000 * 60;
    const HOUR = MINUTE * 60;
    const DAY = HOUR * 24;
  
    return this.collection.find({ chain, network, processed: false })
      .addCursorFlag('tailable', true)
      .addCursorFlag('awaitData', true)
      .maxAwaitTimeMS(DAY * 24 + HOUR * 20 + MINUTE * 31)
      .stream();
  }

  setProcessed(params: { webhook?: IWebhook; webhookId?: ObjectId | string }) {
    const { webhook, webhookId } = params;
    const id = webhook?._id || webhookId;
    if (!id) {
      throw new Error('No webhook id given to clear');
    }
    return this.collection.updateOne({ _id: id }, { $set: { processed: true } });
  }
}

export const WebhookStorage = new WebhookModel();
