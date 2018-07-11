import { Storage } from '../services/storage';
import { Collection, MongoClient, Db } from 'mongodb';

export abstract class BaseModel<T> {
  connected = false;
  client?: MongoClient;
  db?: Db;

  // each model must implement an array of keys that are indexed, for paging
  abstract allowedPaging: Array<{
    type: 'string' | 'number' | 'date';
    key: keyof T;
  }>;

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
}
