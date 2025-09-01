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
import { expect } from 'chai';

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

export function expectObjectToHaveProps(obj: any, props: Record<string, string>) {
  expect(obj).to.include.all.keys(Object.keys(props));
  for (const key in props) {
    expect(obj[key]).to.be.a(props[key]);
  }
};
export function testCoin (coin) {
  expect(coin, 'coin is undefined').to.exist;
  expect(coin, 'coin is not an object').to.be.an('object');
  expect(coin, 'coin test').to.have.property('chain').that.is.a('string', `coin.chain is not a string`);
  expect(coin, 'coin test').to.have.property('network').that.is.a('string', 'coin.network is not a string');
  expect(coin, 'coin test').to.have.property('mintIndex').that.is.a('number', 'coin.mintIndex is not a number');
  expect(coin, 'coin test').to.have.property('mintTxid').that.is.a('string', 'coin.mintTxid is not a string');
  expect(coin, 'coin test').to.have.property('address').that.is.a('string', 'coin.address is not a string');
  expect(coin, 'coin test').to.have.property('coinbase').that.is.a('boolean', 'coin.coinbase is not a boolean');
  expect(coin, 'coin test').to.have.property('mintHeight').that.is.a('number', 'coin.mintHeight is not a number');
  expect(coin, 'coin test').to.have.property('script');
  expect(coin, 'coin test').to.have.property('spentHeight').that.is.a('number', 'coin.spentHeight is not a number');
  expect(coin, 'coin test').to.have.property('value').that.is.a('number', 'coin.value is not a number');
  expect(coin, 'coin test').to.have.property('spentTxid').that.is.a('string', 'coin.spentTxid is not a string');
  if ('confirmations' in coin) {
    expect(coin.confirmations, 'coin.confirmations is not a number').to.be.a('number');
  }
}

export const minutesAgo = (minutes: number): Date => new Date(Date.now() - 1000 * 60 * minutes);
