import { Db, MongoClient } from 'mongodb';
import 'source-map-support/register';
import { Transform } from 'stream';

export class Mongo {
  path: string;
  db: Db;
  collectionName: string;
  collection: any;
  errorIfExists?: boolean;
  createIfMissing: boolean;
  storageType: string;
  databaseName: string;
  client: MongoClient;
  port: string;
  addressCollectionName: string;
  constructor(params: { path?: string; createIfMissing: boolean; errorIfExists: boolean }) {
    const { path, createIfMissing, errorIfExists } = params;
    if (path) {
      this.path = path;
      let databasePath = path.split('/');
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
    this.collectionName = 'wallets';
    this.addressCollectionName = 'walletaddresses';
  }

  async init(params) {
    const { wallet, addresses } = params;
    try {
      this.client = new MongoClient(this.path, { useNewUrlParser: true });
      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      if (wallet) {
        this.collection = this.db.collection(this.collectionName);
      } else if (addresses) {
        this.collection = this.db.collection(this.addressCollectionName);
      }
      await this.collection.createIndex({ name: 1 });
    } catch (error) {}
  }

  async close() {
    await this.client.close();
  }

  async listWallets() {
    await this.init({ wallet: 1 });
    const stream = new Transform({
      objectMode: true,
      transform(data, enc, next) {
        this.push(JSON.stringify(data));
        next();
      }
    });
    const cursor = this.collection
      .find({ name: { $exists: true } }, { name: 1, chain: 1, network: 1, storageType: 1 })
      .pipe(stream);
    stream.on('end', async () => await this.close());
    return cursor;
  }

  async listKeys() {
    await this.init({ addresses: 1 });
    const stream = new Transform({
      objectMode: true,
      transform(data, enc, next) {
        this.push(JSON.parse(JSON.stringify(data)));
        next();
      }
    });
    const cursor = this.collection.find({}, { name: 1, key: 1, toStore: 1, storageType: 1 }).pipe(stream);
    stream.on('end', async () => await this.close());
    return cursor;
  }

  async saveWallet(params) {
    const { wallet } = params;
    await this.init({ wallet: 1 });
    if (wallet.lite) {
      delete wallet.masterKey;
      delete wallet.pubKey;
    }
    wallet.authKey = wallet.authKey.toString('hex');
    try {
      delete wallet.storage;
      delete wallet.client;
      delete wallet._id;
      await this.collection.updateOne({ name: wallet.name }, { $set: wallet }, { upsert: 1 });
      await this.close();
    } catch (error) {
      console.error(error);
    }
    return;
  }

  async loadWallet(params: { name: string }) {
    await this.init({ wallet: 1 });
    const { name } = params;
    const wallet = await this.collection.findOne({ name });
    await this.close();
    if (!wallet) {
      return;
    }
    return JSON.stringify(wallet);
  }

  async deleteWallet(params: { name: string }) {
    await this.init({ wallet: 1 });
    const { name } = params;
    await this.collection.deleteOne({ name });
    await this.close();
  }

  async getKey(params: { address: string; name: string; keepAlive: boolean; open: boolean }) {
    if (params.open) {
      await this.init({ addresses: 1 });
    }
    const { address, name } = params;
    const key = await this.collection.findOne({ name, address });
    if (!params.keepAlive) {
      await this.close();
    }
    return key.data;
  }

  async addKeys(params: { name: string; key: any; toStore: string; keepAlive: boolean; open: boolean }) {
    try {
      if (params.open) {
        await this.init({ addresses: 1 });
      }
      const { name, key, toStore } = params;
      await this.collection.insertOne({ name, address: key.address, data: toStore });
      if (!params.keepAlive) {
        await this.close();
      }
    } catch (error) {
      console.error(error);
    }
  }
}
