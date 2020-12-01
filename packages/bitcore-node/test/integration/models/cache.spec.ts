import { ObjectId } from 'bson';
import { expect } from 'chai';
import { CacheStorage } from '../../../src/models/cache';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
describe('Cache Model', function() {
  const key = 'key';
  const value = { hello: 'world' };
  const walletKey = 'wallet-key';
  const walletValue = { walletThing: 1 };
  const wallet = new ObjectId();

  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  beforeEach(async () => {
    await resetDatabase();
  });

  it('should cache a value', async () => {
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    const found = await CacheStorage.collection.findOne({ key });
    const got = await CacheStorage.getGlobal(key);
    expect(found).to.exist;
    expect(found!.expireTime).to.eq(CacheStorage.Times.Hour);
    expect(got).to.deep.eq(found!.value);
    expect(got).to.deep.eq(value);
  });

  it('should get the value', async () => {
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    const got = await CacheStorage.getGlobal(key);
    expect(got).to.deep.eq(value);
  });

  it('should expire the key', async () => {
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    await CacheStorage.expire(key);
    const got = await CacheStorage.getGlobal(key);
    expect(got).to.eq(null);
  });

  it('should cache the value returned by fn', async () => {
    const got = await CacheStorage.getGlobalOrRefresh(key, async () => value, CacheStorage.Times.Hour);
    const found = await CacheStorage.collection.findOne({ key });
    expect(found).to.exist;
    expect(found!.expireTime).to.eq(CacheStorage.Times.Hour);
    expect(got).to.deep.eq(found!.value);
  });

  it('should cache the wallet value', async () => {
    await CacheStorage.setForWallet(wallet, walletKey, walletValue, CacheStorage.Times.Day);
    const found = await CacheStorage.collection.findOne({ key: walletKey, wallet });
    const global = await CacheStorage.getGlobal(walletKey);
    expect(global).to.eq(null);
    const got = await CacheStorage.getForWallet(wallet, walletKey);
    expect(found).to.exist;
    expect(found!.expireTime).to.eq(CacheStorage.Times.Day);
    expect(got).to.deep.eq(found!.value);
    expect(got).to.deep.eq(walletValue);
  });

  it('should cache the value returned by fn for wallet', async () => {
    const got = await CacheStorage.getForWalletOrRefresh(
      wallet,
      walletKey,
      async () => walletValue,
      CacheStorage.Times.Hour
    );
    const found = await CacheStorage.collection.findOne({ key: walletKey, wallet });
    expect(found).to.exist;
    expect(found!.expireTime).to.eq(CacheStorage.Times.Hour);
    expect(got).to.deep.eq(found!.value);
  });
});
