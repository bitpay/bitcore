import 'source-map-support/register';
import { IWallet, KeyImport } from './types/wallet';
import { BitcoreLib } from 'crypto-wallet-core';
import { Encryption } from './encryption';
import { Level } from './storage/level';
import { Mongo } from './storage/mongo';
import { PassThrough } from 'stream';
import { StorageType } from './types/storage';
import { TextFile } from './storage/textFile';

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

  async loadWallet(params: { name: string }): Promise<void | IWallet> {
    const { name } = params;
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
    return JSON.parse(wallet) as IWallet;
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

  async addKeys(params: { name: string; keys: KeyImport[]; encryptionKey: string }) {
    const { name, keys, encryptionKey } = params;
    let open = true;
    for (const key of keys) {
      const { path } = key;
      let { pubKey } = key;
      pubKey = pubKey || new BitcoreLib.PrivateKey(key.privKey).publicKey.toString();
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

  async getAddresses(params: { name: string, limit?: number, skip?: number }) {
    const { name, limit, skip } = params;
    return this.storageType.getAddresses({ name, limit, skip });
  }
}
