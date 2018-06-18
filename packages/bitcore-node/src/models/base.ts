import { Storage } from '../services/storage';
import { Collection } from "mongodb";

export class BaseModel<T> {
  collection: Collection<T>
  client = Storage.client;
  db = Storage.db;

  constructor(collectionName: string) {
    this.collection = Storage.db!.collection(collectionName);
  }

  find = this.collection.find;
  findOne = this.collection.findOne;
  update = this.collection.update;
  updateOne = this.collection.updateOne;
  remove = this.collection.remove;
}
