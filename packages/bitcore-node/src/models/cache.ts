import { ObjectId } from 'mongodb';
import { CacheTimes } from '../routes/middleware';
import { StorageService } from '../services/storage';
import { BaseModel } from './base';

interface ICache<T> {
  key: string;
  wallet?: ObjectId;
  value: T;
  created: number;
  expireTime: number;
}
export class CacheModel extends BaseModel<ICache<any>> {
  public Times = {
    None: 0,
    Second: 1 * 1000,
    Minute: 60 * 1000,
    Hour: CacheTimes.Minute * 60 * 1000,
    Day: CacheTimes.Hour * 24 * 1000,
    Month: CacheTimes.Day * 30 * 1000,
    Year: CacheTimes.Day * 365 * 1000
  };
  constructor(storage?: StorageService) {
    super('cache', storage);
  }

  allowedPaging = [];

  async onConnect() {
    await this.collection.createIndex({ key: 1, wallet: 1 }, { background: true, unique: true });
  }

  async expire(key: string, wallet?: ObjectId) {
    await this.collection.updateOne({ key, wallet }, { $set: { expireTime: 0 } });
  }

  async setGlobal<T = any>(key: string, value: T, cacheTime: number) {
    await this.collection.updateOne(
      { key },
      { $set: { value, created: Date.now(), expireTime: cacheTime } },
      { upsert: true }
    );
  }

  async setForWallet<T = any>(wallet: ObjectId, key: string, value: T, cacheTime: number) {
    await this.collection.updateOne(
      { wallet, key },
      { $set: { value, created: Date.now(), expireTime: cacheTime } },
      { upsert: true }
    );
  }

  async getGlobal<T = any>(key: string) {
    const found = await this.collection.findOne({ key, wallet: undefined });
    if (!found) {
      return null;
    }
    if (found.created + found.expireTime >= Date.now()) {
      // cache hit
      return found.value as T;
    } else {
      // cache miss
      this.collection.remove({ _id: found._id });
      return null;
    }
  }

  async getForWallet<T = any>(wallet: ObjectId, key: string) {
    const found = await this.collection.findOne({ wallet, key });
    if (!found) {
      return null;
    }
    if (found.created + found.expireTime >= Date.now()) {
      // cache hit
      return found.value as T;
    } else {
      // cache miss
      this.collection.remove({ _id: found._id });
      return null;
    }
  }

  async getGlobalOrRefresh<T = any>(key: string, onMiss: () => Promise<T>, cacheTime: number) {
    const data = await this.getGlobal(key);
    if (data !== null) {
      return data;
    } else {
      const fetched = await onMiss();
      await this.setGlobal(key, fetched, cacheTime);
      return fetched;
    }
  }

  async getForWalletOrRefresh<T = any>(wallet: ObjectId, key: string, onMiss: () => Promise<T>, cacheTime: number) {
    const data = await this.getForWallet(wallet, key);
    if (data !== null) {
      return data;
    } else {
      const fetched = await onMiss();
      await this.setForWallet(wallet, key, fetched, cacheTime);
      return fetched;
    }
  }
}

export const CacheStorage = new CacheModel();
