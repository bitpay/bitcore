import { BaseModel } from './base';
import { ObjectID } from 'mongodb';

export type IState = {
  _id?: ObjectID;
  initialSyncComplete: any;
};

export class State extends BaseModel<IState> {
  constructor() {
    super('state');
  }
  allowedPaging = [];

  onConnect() {}
}

export let StateModel = new State();
