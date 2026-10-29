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

  // the heartbeat, with the id of the state document that holds it so a renewal or resign needn't read it again
  async findSyncingNode(params: { chain: string; network: string }): Promise<{ heartBeat: string; stateId: ObjectID }> {
    const { chain, network } = params;
    const state = await this.findSingletonState();
    return { heartBeat: state[`syncingNode:${chain}:${network}`], stateId: state._id! };
  }

  async getSyncingNode(params: { chain: string; network: string }): Promise<string> {
    return (await this.findSyncingNode(params)).heartBeat;
  }

  // replaces lastHeartBeat with heartBeat, which the worker builds so that it can recognize it when it reads it back
  async selfNominateSyncingNode(params: {
    chain: string;
    network: string;
    lastHeartBeat: any;
    heartBeat: string;
    stateId?: ObjectID;
  }) {
    const { chain, network, lastHeartBeat, heartBeat } = params;
    const stateId = params.stateId || (await this.findSingletonState())._id;
    return this.collection.findOneAndUpdate(
      // renew only the heartbeat this node read, and claim one only when there is none
      { _id: stateId, [`syncingNode:${chain}:${network}`]: lastHeartBeat || { $exists: false } },
      { $set: { [`syncingNode:${chain}:${network}`]: heartBeat } }
    );
  }

  async selfResignSyncingNode(params: { chain: string; network: string; lastHeartBeat: any; stateId?: ObjectID }) {
    const { chain, network, lastHeartBeat } = params;
    const stateId = params.stateId || (await this.findSingletonState())._id;
    return this.collection.findOneAndUpdate(
      { _id: stateId, [`syncingNode:${chain}:${network}`]: lastHeartBeat },
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
