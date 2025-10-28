import 'source-map-support/register';
import { Transform } from 'stream';
import { Db, MongoClient } from 'mongodb';

export class Mongo {
  path: string;
  db: Db;
  walletCollectionName: string = 'wallets';
  addressCollectionName: string = 'walletaddresses';
  walletCollection: any;
  addressCollection: any;
  errorIfExists?: boolean;
  createIfMissing: boolean;
  storageType: string;
  databaseName: string;
  client: MongoClient;
  port: string;

  constructor(params: { path?: string; createIfMissing: boolean; errorIfExists: boolean }) {
    const { path, createIfMissing, errorIfExists } = params;
    if (path) {
      this.path = path;
      const databasePath = path.split('/');
      if (databasePath[databasePath.length - 1] === '') {
        databasePath.pop();
      }
      this.databaseName = databasePath.pop();
    } else {
      this.path = 'mongodb://localhost/bitcoreWallet';
      this.databaseName = 'bitcoreWallets';
    }
    this.createIfMissing = createIfMissing;
    this.errorIfExists = errorIfExists;
  }

  async init() {
    if (this.db) {
      return;
    }
    try {
      this.client = new MongoClient(this.path, { useNewUrlParser: true, useUnifiedTopology: true });
      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      this.walletCollection = this.db.collection(this.walletCollectionName);
      this.addressCollection = this.db.collection(this.addressCollectionName);
      await this.walletCollection.createIndex({ name: 1 });
      await this.addressCollection.createIndex({ name: 1 });
    } catch { /* ignore */ }
  }

  async close() {
    await this.client?.close();
    this.client = null;
    this.db = null;
  }

  async testConnection() {
    try {
      const client = new MongoClient(this.path, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        noDelay: true,
        serverSelectionTimeoutMS: 5000
      });
      await client.connect();
      await client.close();
      return true;
    } catch {
      return false;
    }
  }

  async listWallets() {
    await this.init();
    const stream = new Transform({
      objectMode: true,
      transform(data, enc, next) {
        this.push(JSON.stringify(data));
        next();
      }
    });
    const cursor = this.walletCollection
      .find({ name: { $exists: true } }, { name: 1, chain: 1, network: 1, storageType: 1, tokens: 1 })
      .pipe(stream);
    stream.on('end', async () => await this.close());
    return cursor;
  }

  async listKeys() {
    await this.init();
    const stream = new Transform({
      objectMode: true,
      transform(data, enc, next) {
        this.push(JSON.parse(JSON.stringify(data)));
        next();
      }
    });
    const cursor = this.addressCollection.find({}, { name: 1, key: 1, toStore: 1, storageType: 1 }).pipe(stream);
    stream.on('end', async () => await this.close());
    return cursor;
  }

  async saveWallet(params) {
    const { wallet } = params;
    await this.init();
    if (wallet.lite) {
      delete wallet.masterKey;
      delete wallet.pubKey;
    }
    wallet.authKey = wallet.authKey.toString('hex');
    try {
      delete wallet.storage;
      delete wallet.client;
      delete wallet._id;
      await this.walletCollection.updateOne({ name: wallet.name }, { $set: wallet }, { upsert: 1 });
      await this.close();
    } catch (error) {
      console.error(error);
    }
    return;
  }

  async loadWallet(params: { name: string }) {
    await this.init();
    const { name } = params;
    const wallet = await this.walletCollection.findOne({ name });
    await this.close();
    if (!wallet) {
      return;
    }
    return JSON.stringify(wallet);
  }

  async deleteWallet(params: { name: string }) {
    await this.init();
    const { name } = params;
    await this.walletCollection.deleteOne({ name });
    await this.addressCollection.deleteMany({ name });
    await this.close();
  }

  async getKey(params: { address: string; name: string; keepAlive: boolean; open: boolean }) {
    if (params.open) {
      await this.init();
    }
    const { address, name } = params;
    const key = await this.addressCollection.findOne({ name, address });
    if (!params.keepAlive) {
      await this.close();
    }
    return key?.data;
  }

  async addKeys(params: { name: string; key: any; toStore: string; keepAlive: boolean; open: boolean }) {
    try {
      if (params.open) {
        await this.init();
      }
      const { name, key, toStore } = params;
      await this.addressCollection.insertOne({ name, address: key.address, data: toStore });
      if (!params.keepAlive) {
        await this.close();
      }
    } catch (error) {
      console.error(error);
    }
  }

  async getAddress(params: { name: string; address: string, keepAlive: boolean; open: boolean }) {
    const { name, address, keepAlive, open } = params;
    const data = await this.getKey({ address, name, keepAlive, open });
    if (!data) {
      return null;
    }
    const { pubKey, path } = JSON.parse(data);
    return { address, pubKey, path };
  }

  async getAddresses(params: { name: string; limit?: number; skip?: number }) {
    const { name, limit, skip } = params;
    const keys = await this.addressCollection.find({ name }, {}, { $limit: limit, $skip: skip }).toArray();
    return keys.map(k => {
      const { pubKey, path } = JSON.parse(k.data);
      return { address: k.address, pubKey, path };
    });
  }
}
