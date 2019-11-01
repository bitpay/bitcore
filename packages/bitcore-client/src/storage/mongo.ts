import 'source-map-support/register'
import { MongoClient } from 'mongodb'

export class Mongo {
  path: string;
  db: any;
  collectionName: string;
  collection: any;
  errorIfExists?: boolean;
  createIfMissing: boolean;
  dbName: string;
  databaseName: string;
  client: any;
  port: string;
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
  }

  async init() {
    try {
      this.client = new MongoClient(this.path, { useNewUrlParser: true });
      await this.client.connect();
      console.log('connected');
      this.db = this.client.db(this.databaseName);
      this.collection = this.db.collection(this.collectionName);
    } catch (error) {
      console.error(error);
    }
  }

  async close() {
    await this.client.close();
    console.log('closed connection');
  }

  listWallets() {
    // return this.db.
  }

  listKeys() {
  }

  async saveWallet(params) {
    const { wallet } = params;
    await this.init();
    wallet.authKey = JSON.stringify(wallet.authKey);
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
    await this.init();
    const { name } = params;
    const wallet = await this.collection.findOne({ name:name });
    await this.close();
    wallet.authKey = JSON.parse(wallet.authKey);
    if (!wallet) {
      return;
    }
    return JSON.stringify(wallet);
  }

  async getKey(params: {
    address: string;
    name: string;
  }) {
    const { address, name } = params;
    return (await this.db.get(`key|${name}|${address}`)) as string;
  }

  async addKeys(params: {
    name: string;
    key: any
    toStore: string;
  }) {
    const { name, key, toStore} = params;
    await this.db.put(`key|${name}|${key.address}`, toStore);
  }
}
