import os from 'os';
import { ObjectID } from 'mongodb';
import { StorageService } from '../services/storage';
import { BaseModel } from './base';

export interface IState {
  _id?: ObjectID;
  initialSyncComplete: any;
  verifiedBlockHeight?: {
    [chain: string]: {
      [network: string]: number;
    };
  };
  lastAddressSubscriptionUpdate?: {
    [chain: string]: {
      [network: string]: Date;
    };
  };
}

export class StateModel extends BaseModel<IState> {
  constructor(storage?: StorageService) {
    super('state', storage);
  }
  allowedPaging = [];

  onConnect() {}

  async getSingletonState() {
    return this.collection.findOneAndUpdate(
      {},
      { $setOnInsert: { created: new Date() } },
      { upsert: true, returnOriginal: false }
    );
  }

  async findSingletonState() {
    // read from the primary: a stale heartbeat would make renewals fail
    const state = await this.collection.findOne({}, { readPreference: 'primary' });
    return state || (await this.getSingletonState()).value!;
  }

  async getSyncingNode(params: { chain: string; network: string }): Promise<string> {
    const { chain, network } = params;
    const state = await this.findSingletonState();
    return state[`syncingNode:${chain}:${network}`];
  }

  async selfNominateSyncingNode(params: { chain: string; network: string; lastHeartBeat: any }) {
    const { chain, network, lastHeartBeat } = params;
    const singleState = await this.findSingletonState();
    return this.collection.findOneAndUpdate(
      // renew only the heartbeat this node read, and claim one only when there is none
      { _id: singleState._id, [`syncingNode:${chain}:${network}`]: lastHeartBeat || { $exists: false } },
      { $set: { [`syncingNode:${chain}:${network}`]: `${os.hostname}:${process.pid}:${Date.now()}` } }
    );
  }

  async selfResignSyncingNode(params: { chain: string; network: string; lastHeartBeat: any }) {
    const { chain, network, lastHeartBeat } = params;
    const singleState = await this.findSingletonState();
    return this.collection.findOneAndUpdate(
      { _id: singleState._id, [`syncingNode:${chain}:${network}`]: lastHeartBeat },
      { $unset: { [`syncingNode:${chain}:${network}`]: true } }
    );
  }

  setVerifiedBlockHeight(params: { chain: string; network: string; height: number }) {
    const { chain, network, height } = params;
    return this.collection.updateOne(
      {},
      {
        $addToSet: { initialSyncComplete: `${chain}:${network}` },
        $set: { [`verifiedBlockHeight.${chain}.${network}`]: height }
      },
      { upsert: true }
    );
  }

  setLastAddressSubscriptionUpdate(params: { chain: string; network: string; timestamp: Date }) {
    const { chain, network, timestamp } = params;
    return this.collection.updateOne(
      {},
      {
        $addToSet: { initialSyncComplete: `${chain}:${network}` },
        $set: { [`lastAddressSubscriptionUpdate.${chain}.${network}`]: timestamp }
      },
      { upsert: true }
    );
  }
}

export const StateStorage = new StateModel();
