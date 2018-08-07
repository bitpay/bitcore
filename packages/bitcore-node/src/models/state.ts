import { BaseModel } from './base';

export type IState = {
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
