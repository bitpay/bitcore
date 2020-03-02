import 'source-map-support/register';
import { PassThrough } from 'stream';
import { Encryption } from './encryption';
import { Level } from './storage/level';
import { Mongo } from './storage/mongo';
import { KeyImport } from './wallet';

const bitcoreLib = require('crypto-wallet-core').BitcoreLib;

export class Storage {
  path: string;
  db: Array<Mongo | Level>;
  collection: 'bitcoreWallets';
  url?: string;
  errorIfExists?: boolean;
  createIfMissing: boolean;
  storageType: string;
  constructor(params: { path?: string; createIfMissing: boolean; errorIfExists: boolean; storageType?: string }) {
    const { path, createIfMissing, errorIfExists } = params;
    let { storageType } = params;
    this.path = path;
    this.createIfMissing = createIfMissing;
    this.errorIfExists = errorIfExists;
    this.storageType = storageType;
    const dbMap = {
      Mongo,
      Level
    };
    this.db = [];
    if (dbMap[storageType]) {
      this.db.push(new dbMap[storageType]({ createIfMissing, errorIfExists, path }));
    } else {
      for (let dbMapKey in dbMap) {
        this.db.push(new dbMap[dbMapKey]({ createIfMissing, errorIfExists, path }));
      }
    }
  }

  async loadWallet(params: { name: string, storageType: string }) {
    const { name, storageType } = params;
    const wallet = await this.db[storageType].loadWallet({ name });
    if (!wallet) {
      return;
    }
    return JSON.parse(wallet);
  }

  async listWallets() {
    let passThrough = new PassThrough();
    for (let db of this.db) {
      const listWalletStream = await db.listWallets();
      passThrough = listWalletStream.pipe(passThrough, { end: false });
      listWalletStream.once('end', () => --this.db.length === 0 && passThrough.end());
    }
    return passThrough;
  }

  async listKeys() {
    let passThrough = new PassThrough();
    for (let db of this.db) {
      const listWalletStream = await db.listKeys();
      passThrough = listWalletStream.pipe(passThrough, { end: false });
      listWalletStream.once('end', () => --this.db.length === 0 && passThrough.end());
    }
    return passThrough;
  }

  async saveWallet(params) {
    const { wallet } = params;
    return this.db[wallet.storageType].saveWallet({ wallet });
  }

  async getKey(params: {
    address: string;
    name: string;
    storageType: string;
    encryptionKey: string;
    keepAlive: boolean;
    open: boolean;
  }): Promise<KeyImport> {
    const { address, name, encryptionKey, keepAlive, open, storageType } = params;
    const payload = await this.db[storageType].getKey({ name, address, keepAlive, open });
    const json = JSON.parse(payload) || payload;
    const { encKey, pubKey } = json;
    if (encryptionKey && pubKey) {
      const decrypted = Encryption.decryptPrivateKey(encKey, pubKey, encryptionKey);
      return JSON.parse(decrypted);
    } else {
      return json;
    }
  }

  async getKeys(params: { addresses: string[]; name: string; encryptionKey: string, storageType: string }): Promise<Array<KeyImport>> {
    const { addresses, name, encryptionKey, storageType } = params;
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
          open,
          storageType
        });
        keys.push(key);
      } catch (err) {
        console.error(err);
      }
      open = false;
    }
    return keys;
  }

  async addKeys(params: { name: string; keys: KeyImport[]; encryptionKey: string, storageType: string }) {
    const { name, keys, encryptionKey, storageType } = params;
    let open = true;
    for (const key of keys) {
      let { pubKey } = key;
      pubKey = pubKey || new bitcoreLib.PrivateKey(key.privKey).publicKey.toString();
      let payload = {};
      if (pubKey && key.privKey && encryptionKey) {
        const toEncrypt = JSON.stringify(key);
        const encKey = Encryption.encryptPrivateKey(toEncrypt, pubKey, encryptionKey);
        payload = { encKey, pubKey };
      }
      const toStore = JSON.stringify(payload);
      let keepAlive = true;
      if (key === keys[keys.length - 1]) {
        keepAlive = false;
      }
      await this.db[storageType].addKeys({ name, key, toStore, keepAlive, open });
      open = false;
    }
  }
}
