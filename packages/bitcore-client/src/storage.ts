import 'source-map-support/register'
import { Encryption } from './encryption';
import { Wallet } from './wallet';
import { Mongo } from './storage/mongo';
import { Level } from './storage/level';

const bitcoreLib = require('bitcore-lib');

export class Storage {
  path: string;
  db: any;
  collection: 'bitcoreWallets';
  url?: string;
  errorIfExists?: boolean;
  createIfMissing: boolean;
  dbName: string;
  constructor(params: {
    path?: string;
    createIfMissing: boolean;
    errorIfExists: boolean;
    dbName?: string;
  }) {
    const { path, createIfMissing, errorIfExists } = params;
    let { dbName } = params;
    this.path = path;
    this.createIfMissing = createIfMissing;
    this.errorIfExists = errorIfExists;
    this.dbName = dbName;
    const dbMap = {
      Mongo: Mongo,
      Level: Level
    };
    if (!dbName) {
      dbName = 'Level'
    }
    this.db = new dbMap[dbName]({ createIfMissing, errorIfExists, path });
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
  }): Promise<Wallet.KeyImport> {
    const { address, name, encryptionKey } = params;
    const payload = await this.db.getKey({ name, address });
    const json = JSON.parse(payload) || payload;
    const { encKey, pubKey } = json;
    if (encryptionKey && pubKey) {
      const decrypted = Encryption.decryptPrivateKey(
        encKey,
        pubKey,
        encryptionKey
      );
      return JSON.parse(decrypted);
    } else {
      return json;
    }
  }

  async getKeys(params: {
    addresses: string[];
    name: string;
    encryptionKey: string
  }): Promise<Array<Wallet.KeyImport>> {
    const { addresses, name, encryptionKey } = params;
    const keys = new Array<Wallet.KeyImport>();
    for(const address of addresses) {
      try {
        const key = await this.getKey({name, address, encryptionKey});
        keys.push(key);
      } catch (err) {
        console.error(err);
      }
    }
    return keys;
  }

  async addKeys(params: {
    name: string;
    keys: Wallet.KeyImport[];
    encryptionKey: string;
  }) {
    const { name, keys, encryptionKey } = params;
    for(const key of keys)  {
      let { pubKey } = key;
      pubKey =
        pubKey || new bitcoreLib.PrivateKey(key.privKey).publicKey.toString();
      let payload = {};
      if (pubKey && key.privKey && encryptionKey) {
        const toEncrypt = JSON.stringify(key);
        const encKey = Encryption.encryptPrivateKey(
          toEncrypt,
          pubKey,
          encryptionKey
        );
        payload = { encKey, pubKey };
      }
      const toStore = JSON.stringify(payload);
      await this.db.addKeys({name, key, toStore});
    }
  }
}
