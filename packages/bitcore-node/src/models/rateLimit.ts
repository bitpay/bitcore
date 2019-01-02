import { BaseModel } from './base';
import { ObjectID } from 'mongodb';
import { StorageService } from '../services/storage';

export type IRateLimit = {
  _id?: ObjectID;
  identifier: string;
  method: string;
  period: string;
  count: number;
  time?: Date;
  expireAt?: Date;
};

export class RateLimitModel extends BaseModel<IRateLimit> {
  constructor(storage?: StorageService) {
    super('ratelimits', storage);
  }
  allowedPaging = [];

  onConnect() {
    this.collection.createIndex({ identifier: 1, time: 1, method: 1, count: 1 }, { background: true });
    this.collection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0, background: true });
  }

  incrementAndCheck(identifier: string, method: string) {
    return Promise.all([
      this.collection.findOneAndUpdate(
        { identifier, method, period: 'second', time: { $gt: new Date(Date.now() - 1000) } },
        {
          $setOnInsert: { time: new Date(), expireAt: new Date(Date.now() + 10 * 1000) },
          $inc: { count: 1 }
        },
        { upsert: true, returnOriginal: false }
      ),
      this.collection.findOneAndUpdate(
        { identifier, method, period: 'minute', time: { $gt: new Date(Date.now() - 60 * 1000) } },
        {
          $setOnInsert: { time: new Date(), expireAt: new Date(Date.now() + 2 * 60 * 1000) },
          $inc: { count: 1 }
        },
        { upsert: true, returnOriginal: false }
      ),
      this.collection.findOneAndUpdate(
        { identifier, method, period: 'hour', time: { $gt: new Date(Date.now() - 60 * 60 * 1000) } },
        {
          $setOnInsert: { time: new Date(), expireAt: new Date(Date.now() + 62 * 60 * 1000) },
          $inc: { count: 1 }
        },
        { upsert: true, returnOriginal: false }
      )
    ]);
  }
}

export let RateLimitStorage = new RateLimitModel();
