import { StateStorage } from '../../src/models/state';
import sinon from 'sinon';
import { BitcoinBlockStorage } from '../../src/models/block';
import { TransactionStorage } from '../../src/models/transaction';
import { CoinStorage } from '../../src/models/coin';
import { WalletAddressStorage } from '../../src/models/walletAddress';
import { WalletStorage } from '../../src/models/wallet';
import { Storage } from '../../src/services/storage';
import { BaseModel } from '../../src/models/base';
import { RateLimitStorage } from '../../src/models/rateLimit';
import { EventStorage } from '../../src/models/events';

export async function resetDatabase() {
  console.log('Restting database');
  await resetModel(BitcoinBlockStorage);
  await resetModel(TransactionStorage);
  await resetModel(CoinStorage);
  await resetModel(WalletAddressStorage);
  await resetModel(WalletStorage);
  await resetModel(StateStorage);
  await resetModel(RateLimitStorage);
  await resetModel(EventStorage);
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
  const isStubbed: sinon.SinonStub = Storage.db!.collection as sinon.SinonStub;
  if (isStubbed.withArgs) {
    isStubbed.withArgs(collectionName).returns(mockCollection(toReturn, collectionMethods));
  }
}
