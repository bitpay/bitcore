import { ObjectId } from 'mongodb';
import logger from '../logger';
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
  private refreshing = new Map<string, Promise<any>>();

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

  async setGlobal<T = any>(key: string, value: T, cacheTime: number, created = Date.now()) {
    await this.collection.updateOne(
      { key },
      { $set: { value, created, expireTime: cacheTime } },
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
      // cache miss - only delete the version seen expiring; a refresh reuses the _id
      await this.collection.deleteOne({ _id: found._id, created: found.created });
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
      // cache miss - only delete the version seen expiring; a refresh reuses the _id
      await this.collection.deleteOne({ _id: found._id, created: found.created });
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

  /**
   * Returns the cached value, and refreshes it in the background once it is older than maxAge or was cached before
   * staleAfter. The value is only replaced, never removed, and a failed refresh keeps it, so only the first call for a
   * key waits for a value. Concurrent refreshes of a key in this process share one call to refresh.
   */
  async getGlobalAndRefresh<T = any>(key: string, refresh: () => Promise<any>, maxAge: number, staleAfter?: number): Promise<T> {
    const found = await this.collection.findOne({ key, wallet: undefined });
    if (!found) {
      return this.refreshGlobal(key, refresh, maxAge);
    }
    const stale = found.created + maxAge < Date.now() || (staleAfter !== undefined && found.created < staleAfter);
    if (stale && !this.refreshing.has(key)) {
      this.refreshGlobal(key, refresh, maxAge).catch(err => logger.warn('Could not refresh %s: %o', key, err));
    }
    return found.value as T;
  }

  private refreshGlobal<T>(key: string, refresh: () => Promise<T>, cacheTime: number): Promise<T> {
    let pending = this.refreshing.get(key);
    if (!pending) {
      pending = (async () => {
        let timer: NodeJS.Timeout | undefined;
        try {
          // date the value from when it was computed, so a refresh that straddles a block is stale after it
          const started = Date.now();
          // give up on a refresh that takes longer than the cache time, so a call that never returns can't block the next
          const timedOut = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Refreshing ${key} timed out`)), cacheTime);
          });
          const value = await Promise.race([refresh(), timedOut]);
          await this.setGlobal(key, value, cacheTime, started);
          return value;
        } finally {
          clearTimeout(timer);
          this.refreshing.delete(key);
        }
      })();
      this.refreshing.set(key, pending);
    }
    return pending;
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
