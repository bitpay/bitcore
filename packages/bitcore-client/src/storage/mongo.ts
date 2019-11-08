import 'source-map-support/register'
import { MongoClient, Db } from 'mongodb'
import {Transform} from "stream";

export class Mongo {
  path: string;
  db: Db;
  collectionName: string;
  collection: any;
  errorIfExists?: boolean;
  createIfMissing: boolean;
  dbName: string;
  databaseName: string;
  client: MongoClient;
  port: string;
  addressCollectionName: string;
  constructor(params: {
    path?: string;
    createIfMissing: boolean;
    errorIfExists: boolean;
  }) {
    const { path, createIfMissing, errorIfExists } = params;
    if (!path) {
      throw new Error('Must specify a mongo url as path');
    }
    this.port = '27017';
    this.path = path + ':' + this.port;
    this.createIfMissing = createIfMissing;
    this.errorIfExists = errorIfExists;
    let databasePath = path.split('/');
    if (databasePath[databasePath.length -1] === '') {
      databasePath.pop();
    }
    this.databaseName = databasePath.pop();
    this.collectionName = 'bitcoreWallets';
    this.addressCollectionName = 'bitcoreWalletAddresses';
  }

  async init(params) {
    const { wallet, addresses } = params;
    try {
      this.client = new MongoClient(this.path, { useNewUrlParser: true });
      await this.client.connect();
      console.log('connected');
      this.db = this.client.db(this.databaseName);
      if (wallet) {
        this.collection = this.db.collection(this.collectionName);
      } else if (addresses) {
        this.collection = this.db.collection(this.addressCollectionName)
      }
      await this.collection.createIndex({ 'name': 1 });
    } catch (error) {
      console.error(error);
    }
  }

  async close() {
    await this.client.close();
    console.log('closed connection');
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
    const cursor = this.collection.find({'name': { '$exists': true }}, { 'name': 1, 'chain': 1, 'network': 1 }).pipe(stream);
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
    const cursor = this.collection.find({}, { 'name': 1, 'key': 1, toStore: 1 }).pipe(stream);
    stream.on('end', async () => await this.close());
    return cursor;
  }

  async saveWallet(params) {
    const { wallet } = params;
    await this.init({wallet: 1});
    if (wallet.lite) {
      delete wallet.masterKey;
      delete wallet.pubKey;
    }
    wallet.authKey = wallet.authKey.toString('hex');
    try {
      await this.collection.insertOne(wallet);
      console.log('inserted');
      await this.close();
    } catch (error) {
      console.error(error);
    }
    return;
  }

  async loadWallet(params: { name: string }) {
    await this.init({ wallet: 1 });
    const { name } = params;
    const wallet = await this.collection.findOne({ name:name });
    await this.close();
    if (!wallet) {
      return;
    }
    return JSON.stringify(wallet);
  }

  async getKey(params: {
    address: string;
    name: string;
    keepAlive: boolean;
    open: boolean;
  }) {
    if (params.open) {
      await this.init({ addresses: 1 });
    }
    const { address, name } = params;
    const key = await this.collection.findOne({ name:name, address:address });
    if (!params.keepAlive) {
      await this.close();
    }
    return key.data;
  }


  async addKeys(params: {
    name: string;
    key: any
    toStore: string;
    keepAlive: boolean;
    open: boolean;
  }) {
    try {
      if (params.open) {
        await this.init({ addresses: 1 });
      }
      const { name, key, toStore } = params;
      await this.collection.insertOne({ name, address:key.address, data:toStore });
      if (!params.keepAlive) {
        await this.close()
      }
    } catch (error) {
      console.error(error);
    }
  }
}
