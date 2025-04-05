import sinon from 'sinon';
import { BaseModel } from '../../src/models/base';
import { BitcoinBlockStorage } from '../../src/models/block';
import { CacheStorage } from '../../src/models/cache';
import { CoinStorage } from '../../src/models/coin';
import { EventStorage } from '../../src/models/events';
import { RateLimitStorage } from '../../src/models/rateLimit';
import { StateStorage } from '../../src/models/state';
import { TransactionStorage } from '../../src/models/transaction';
import { WalletStorage } from '../../src/models/wallet';
import { WalletAddressStorage } from '../../src/models/walletAddress';
import { Storage } from '../../src/services/storage';

export async function resetDatabase() {
  console.log('Resetting database');
  await Promise.all([
    resetModel(BitcoinBlockStorage),
    resetModel(TransactionStorage),
    resetModel(CoinStorage),
    resetModel(WalletAddressStorage),
    resetModel(WalletStorage),
    resetModel(StateStorage),
    resetModel(RateLimitStorage),
    resetModel(EventStorage),
    resetModel(CacheStorage)
  ]);
}

export async function resetModel(model: BaseModel<any>) {
  return model.collection.deleteMany({});
}

export function mockCollection(toReturn, collectionMethods = {}) {
  const mock = Object.assign(
    {
      find: sinon.stub().returnsThis(),
      aggregate: sinon.stub().returnsThis(),
      count: sinon.stub().returnsThis(),
      sort: sinon.stub().returnsThis(),
      project: sinon.stub().returnsThis(),
      insertOne: sinon.stub().resolves(),
      insertMany: sinon.stub().resolves(),
      bulkWrite: sinon.stub().resolves(),
      remove: sinon.stub().resolves(),
      deleteOne: sinon.stub().resolves(),
      deleteMany: sinon.stub().resolves(),
      limit: sinon.stub().returnsThis(),
      toArray: sinon.stub().resolves(toReturn instanceof Array ? toReturn : [toReturn]),
      findOne: sinon.stub().resolves(toReturn),
      update: sinon.stub().resolves({ result: toReturn }),
      updateOne: sinon.stub().resolves(toReturn),
      updateMany: sinon.stub().resolves({ nModified: 1 }),
      addCursorFlag: sinon.stub().returnsThis()
    },
    collectionMethods
  );
  return mock;
}

export function mockStorage(toReturn, collectionMethods = {}) {
  Storage.db = {
    collection: sinon.stub().returns(mockCollection(toReturn, collectionMethods))
  } as any;
  return Storage;
}

export function mockModel(collectionName: string, toReturn: any, collectionMethods = {}) {
  if (!Storage.db) {
    Storage.db = {
      collection: sinon.stub().returns(mockCollection(toReturn, collectionMethods))
    } as any;
  }
  const collectionFn: sinon.SinonStub = Storage.db!.collection as sinon.SinonStub;
  if (collectionFn.withArgs) {
    collectionFn.withArgs(collectionName).returns(mockCollection(toReturn, collectionMethods));
  }
}
