import { StorageService } from '../services/storage';
import { BaseModel } from './base';
import { ObjectID } from 'mongodb';
import os from 'os';

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

  async getSingletonState() {
    return this.collection.findOneAndUpdate(
      {},
      { $setOnInsert: { created: new Date()}},
      { upsert: true }
    );
  }

  async getSyncingNode(params: { chain: string, network: string }): Promise<string> {
    const { chain, network } = params;
    const state = await this.getSingletonState();
    return state.value![`syncingNode:${chain}:${network}`];
  }

  async selfNominateSyncingNode(params: { chain: string, network: string, lastHeartBeat: any }) {
    const { chain, network, lastHeartBeat } = params;
    const singleState = await this.getSingletonState();
    this.collection.findOneAndUpdate(
      { _id: singleState.value!._id, $or: [{ [`syncingNode:${chain}:${network}`]: { $exists: false } }, { [`syncingNode:${chain}:${network}`]: lastHeartBeat }]},
      { $set: { [`syncingNode:${chain}:${network}`]: `${os.hostname}:${process.pid}:${Date.now()}` } }
    );
  }
}

export let StateStorage = new StateModel();
