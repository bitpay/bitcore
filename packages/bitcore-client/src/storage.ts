import * as fs from 'fs';
import * as os from 'os';
import 'source-map-support/register';
import { Transform } from 'stream';
import { Encryption } from './encryption';
import { Level } from './storage/level';
import { Mongo } from './storage/mongo';
import { Wallet } from './wallet';
import { KeyImport } from './wallet';

const bitcoreLib = require('crypto-wallet-core').BitcoreLib;

export class Storage {
  path: string;
  db: Mongo | Level;
  collection: 'bitcoreWallets';
  url?: string;
  errorIfExists?: boolean;
  createIfMissing: boolean;
  storageType: string;
  constructor(params: { path?: string; createIfMissing: boolean; errorIfExists: boolean; storageType?: string }) {
    const { path, createIfMissing, errorIfExists } = params;
    let { storageType } = params;
    if (path && path.includes('mongo')) {
      storageType = 'Mongo';
    }
    this.path = path;
    this.createIfMissing = createIfMissing;
    this.errorIfExists = errorIfExists;
    this.storageType = storageType;
    const dbMap = {
      Mongo,
      Level
    };
    if (!storageType) {
      storageType = 'Level';
    }
    this.db = new dbMap[storageType]({ createIfMissing, errorIfExists, path });
  }

  async loadWallet(params: { name: string }) {
    const { name } = params;
    const wallet = await this.db.loadWallet({ name });
    if (!wallet) {
      return;
    }
    return JSON.parse(wallet);
  }

  listWallets() {
    return this.db.listWallets();
  }

  listKeys() {
    return this.db.listKeys();
  }

  async saveWallet(params) {
    const { wallet } = params;
    return this.db.saveWallet({ wallet });
  }

  async getKey(params: {
    address: string;
    name: string;
    encryptionKey: string;
    keepAlive: boolean;
    open: boolean;
  }): Promise<KeyImport> {
    const { address, name, encryptionKey, keepAlive, open } = params;
    const payload = await this.db.getKey({ name, address, keepAlive, open });
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
      await this.db.addKeys({ name, key, toStore, keepAlive, open });
      open = false;
    }
  }
}
