import { StorageService } from '../services/storage';
import { BaseModel } from './base';
import { ObjectID } from 'mongodb';

export type IState = {
  _id?: ObjectID;
  initialSyncComplete: any;
};

export class StateSchema extends BaseModel<IState> {
  constructor(storage?: StorageService) {
    super('state', storage);
  }
  allowedPaging = [];

  onConnect() {}
}

export let StateModel = new StateSchema();
