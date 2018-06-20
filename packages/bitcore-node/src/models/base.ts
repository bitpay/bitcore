import { Storage } from '../services/storage';
import { Collection, MongoClient, Db } from 'mongodb';

export abstract class BaseModel<T> {
  connected = false;
  client?: MongoClient;
  db?: Db;

  constructor(private collectionName: string) {
    this.handleConnection();
  }

  private async handleConnection() {
    Storage.connection.on('CONNECTED', async () => {
      if (Storage.db != undefined) {
        this.connected = true;
        await this.onConnect();
      }
    });
  }

  abstract async onConnect();

  get collection(): Collection<T> {
    if (Storage.db) {
      return Storage.db.collection(this.collectionName);
    } else {
      throw new Error('Not connected to the database yet');
    }
  }

  get find() {
    return this.collection.find.bind(this.collection);
  }
  get findOne() {
    return this.collection.findOne.bind(this.collection);
  }
  get update() {
    return this.collection.update.bind(this.collection);
  }
  get updateOne() {
    return this.collection.updateOne.bind(this.collection);
  }
  get remove() {
    return this.collection.remove.bind(this.collection);
  }
  get insert() {
    return this.collection.insert.bind(this.collection);
  }
}
