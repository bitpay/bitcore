import 'source-map-support/register';
import { PassThrough } from 'stream';
import { BitcoreLib } from 'crypto-wallet-core';
import { Encryption } from './encryption';
import { Level } from './storage/level';
import { Mongo } from './storage/mongo';
import { TextFile } from './storage/textFile';
import { StorageType } from './types/storage';
import { IWallet, KeyImport } from './types/wallet';

export class Storage {
  path: string;
  db: Array<Mongo | Level | TextFile>;
  url?: string;
  errorIfExists?: boolean;
  createIfMissing: boolean;
  storageType: Mongo | Level | TextFile;

  constructor(params: { path?: string; createIfMissing: boolean; errorIfExists: boolean; storageType?: StorageType }) {
    const { path, createIfMissing, errorIfExists, storageType } = params;
    if (storageType && !['Mongo', 'Level', 'TextFile'].includes(storageType)) {
      throw new Error('Storage Type passed in must be Mongo, Level, or TextFile');
    }
    this.path = path;
    this.createIfMissing = createIfMissing;
    this.errorIfExists = errorIfExists;
    const dbMap = {
      Mongo,
      Level,
      TextFile
    };
    this.db = [];
    if (dbMap[storageType]) {
      this.db.push(new dbMap[storageType]({ createIfMissing, errorIfExists, path }));
      this.storageType = this.db[0];
    } else {
      for (const DbType of Object.values(dbMap)) {
        this.db.push(new DbType({ createIfMissing, errorIfExists, path }));
      }
    }
  }

  async verifyDbs(dbs: Storage['db']) {
    for await (const db of dbs) {
      if (typeof (db as any).testConnection === 'function') {
        // test mongo connection
        if (!(await (db as any).testConnection())) {
          // remove from dbs
          dbs.splice(dbs.indexOf(db), 1);
        }
      }
    }
    return dbs;
  }

  async close() {
    (this.storageType as Mongo)?.close?.();
  }

  async loadWallet(params: { name: string }): Promise<void | IWallet>
  async loadWallet(params: { name: string; raw: true }): Promise<void | string>
  async loadWallet(params: { name: string; raw: false }): Promise<void | IWallet>
  async loadWallet(params: { name: string; raw?: boolean }): Promise<void | IWallet | string> {
    const { name, raw } = params;
    let wallet: string | void;
    for (const db of await this.verifyDbs(this.db)) {
      try {
        wallet = await db.loadWallet({ name });
        if (wallet) {
          this.storageType = db;
          break;
        }
      } catch { /* ignore */ }
    }
    if (!wallet) {
      return;
    }
    return raw ? wallet : JSON.parse(wallet) as IWallet;
  }

  async deleteWallet(params: { name: string }) {
    const { name } = params;
    for (const db of await this.verifyDbs(this.db)) {
      try {
        await db.deleteWallet({ name });
      } catch (e) {
        console.log(e);
      }
    }
  }

  async listWallets() {
    let passThrough = new PassThrough();
    const dbs = await this.verifyDbs(this.db);
    for (const db of dbs) {
      const listWalletStream = await db.listWallets();
      passThrough = listWalletStream.pipe(passThrough, { end: false });
      listWalletStream.once('end', () => --dbs.length === 0 && passThrough.end());
    }
    return passThrough;
  }

  async listKeys() {
    let passThrough = new PassThrough();
    const dbs = await this.verifyDbs(this.db);
    for (const db of dbs) {
      const listWalletStream = await db.listKeys();
      passThrough = listWalletStream.pipe(passThrough, { end: false });
      listWalletStream.once('end', () => --dbs.length === 0 && passThrough.end());
    }
    return passThrough;
  }

  async saveWallet(params) {
    const { wallet } = params;
    return this.storageType.saveWallet({ wallet });
  }

  // @deprecated
  async getKey(params: {
    address: string;
    name: string;
    encryptionKey: string;
    keepAlive: boolean;
    open: boolean;
  }): Promise<KeyImport> {
    const { address, name, encryptionKey, keepAlive, open } = params;
    const payload = await this.storageType.getKey({ name, address, keepAlive, open });
    const json = JSON.parse(payload) || payload;
    const { encKey, pubKey } = json;
    if (encryptionKey && pubKey) {
      const decrypted = Encryption.decryptPrivateKey(encKey, pubKey, encryptionKey);
      return JSON.parse(decrypted);
    } else {
      return json;
    }
  }

  // @deprecated
  async getKeys(params: { addresses: string[]; name: string; encryptionKey: string }): Promise<Array<KeyImport>> {
    const { addresses, name, encryptionKey } = params;
    const keys = new Array<KeyImport>();
    let keepAlive = true;
    let open = true;
    for (const address of addresses) {
      if (address === addresses[addresses.length - 1]) {
        keepAlive = false;
      }
      try {
        const key = await this.getKey({
          name,
          address,
          encryptionKey,
          keepAlive,
          open
        });
        keys.push(key);
      } catch (err) {
        console.error(err);
      }
      open = false;
    }
    return keys;
  }

  // @deprecated
  async addKeys(params: { name: string; keys: KeyImport[]; encryptionKey: string }) {
    const { name, keys, encryptionKey } = params;
    let open = true;
    for (const key of keys) {
      const { path } = key;
      const pubKey = key.pubKey || new BitcoreLib.PrivateKey(key.privKey).publicKey.toString();
      let payload = {};
      if (pubKey && key.privKey && encryptionKey) {
        const toEncrypt = JSON.stringify(key);
        const encKey = Encryption.encryptPrivateKey(toEncrypt, pubKey, encryptionKey);
        payload = { encKey, pubKey, path };
      }
      const toStore = JSON.stringify(payload);
      let keepAlive = true;
      if (key === keys[keys.length - 1]) {
        keepAlive = false;
      }
      await this.storageType.addKeys({ name, key, toStore, keepAlive, open });
      open = false;
    }
  }

  async getAddress(params: { name: string; address: string }) {
    const { name, address } = params;
    return this.storageType.getAddress({ name, address, keepAlive: true, open: true });
  }

  async getAddresses(params: { name: string; limit?: number; skip?: number }) {
    const { name, limit, skip } = params;
    return this.storageType.getAddresses({ name, limit, skip });
  }

  async addKeysSafe(params: { name: string; keys: KeyImport[] }) {
    const { name, keys } = params;
    let i = 0;
    for (const key of keys) {
      const { path } = key;
      const pubKey = key.pubKey;
      // key.privKey is encrypted - cannot be directly used to retrieve pubKey if required
      if (!pubKey) {
        throw new Error(`pubKey is undefined for ${name}. Keys not added to storage`);
      }
      let payload = {};
      if (pubKey) {
        payload = { key: JSON.stringify(key), pubKey, path };
      }
      const toStore = JSON.stringify(payload);
      // open on first, close on last
      await this.storageType.addKeys({ name, key, toStore, open: i === 0, keepAlive: i < keys.length - 1 });
      ++i;
    }
  }

  async getStoredKeys(params: { addresses: string[]; name: string }): Promise<Array<any>> {
    const { addresses, name } = params;
    const keys = new Array<any>();
    let i = 0;
    for (const address of addresses) {
      try {
        const key = await this.getStoredKey({
          name,
          address,
          open: i === 0, // open on first
          keepAlive: i < addresses.length - 1, // close on last
        });
        keys.push(key);
      } catch (err) {
        // don't continue from catch - i must be incremented
        console.error(err);
      }
      ++i;
    }
    return keys;
  }

  private async getStoredKey(params: {
    address: string;
    name: string;
    keepAlive: boolean;
    open: boolean;
  }): Promise<any> {
    const { address, name, keepAlive, open } = params;
    const payload = await this.storageType.getKey({ name, address, keepAlive, open });
    const json = JSON.parse(payload) || payload;
    const { key } = json; // pubKey available - not needed
    if (key) {
      return JSON.parse(key);
    } else {
      return json;
    }
  }
}
