import { StorageService } from '../services/storage';
import { BaseModel } from './base';
import { ObjectID } from 'mongodb';

export type IState = {
  _id?: ObjectID;
  initialSyncComplete: any;
};

export class StateModel extends BaseModel<IState> {
  constructor(storage?: StorageService) {
    super('state', storage);
  }
  allowedPaging = [];

  onConnect() {}
}

export let StateStorage = new StateModel();
