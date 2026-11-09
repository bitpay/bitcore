import { ObjectId } from 'bson';
import { expect } from 'chai';
import * as sinon from 'sinon';
import logger from '../../../src/logger';
import { CacheStorage } from '../../../src/models/cache';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { EVMTransactionStorage } from '../../../src/providers/chain-state/evm/models/transaction';
import { TEST_OP_ETH_TO_ETH1, TEST_OP_ETH_TO_ETH2, TEST_OP_ERC20_TO_ERC201, TEST_OP_ERC20_TO_ERC202, TEST_OP_ERC20Token_TO_ETH1, TEST_OP_ERC20Token_TO_ETH2, TEST_OP_ETH_TO_ERC201, TEST_OP_ETH_TO_ERC202, TEST_OP_TRANSFER_ERC20_TO_ERC201, TEST_OP_TRANSFER_ERC20_TO_ERC202 } from '../../data/test-ops';

describe('Cache Model', function() {
  const key = 'key';
  const value = { hello: 'world' };
  const walletKey = 'wallet-key';
  const walletValue = { walletThing: 1 };
  const wallet = new ObjectId();
  const otherAddress = '0x9527a556f0D9AA753dE0D1f9Ad024a17dd281B1D';
  const otherKey = `getBalanceForAddress-ETH-testnet-${otherAddress.toLowerCase()}`;

  // eslint-disable-next-line @typescript-eslint/no-this-alias
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

  it('should delete an expired entry before returning the miss', async () => {
    await CacheStorage.setGlobal(key, value, -1);
    const got = await CacheStorage.getGlobal(key);
    expect(got).to.eq(null);
    const found = await CacheStorage.collection.findOne({ key });
    expect(found).to.not.exist;
  });

  it('should not delete a refreshed entry with a stale delete', async () => {
    const freshValue = { hello: 'again' };
    await CacheStorage.setGlobal(key, value, -1);
    const stale = await CacheStorage.collection.findOne({ key });
    // refresh reuses the same document; the stale-versioned delete must no-op
    await CacheStorage.setGlobal(key, freshValue, CacheStorage.Times.Hour);
    await CacheStorage.collection.deleteOne({ _id: stale!._id, created: stale!.created });
    const got = await CacheStorage.getGlobal(key);
    expect(got).to.deep.eq(freshValue);
  });

  it('should cache the value returned by fn', async () => {
    const got = await CacheStorage.getGlobalOrRefresh(key, async () => value, CacheStorage.Times.Hour);
    const found = await CacheStorage.collection.findOne({ key });
    expect(found).to.exist;
    expect(found!.expireTime).to.eq(CacheStorage.Times.Hour);
    expect(got).to.deep.eq(found!.value);
  });

  describe('getGlobalAndRefresh', function() {
    const fresh = { hello: 'again' };
    const sandbox = sinon.createSandbox();
    let warn: sinon.SinonStub;
    const age = (ms: number) => CacheStorage.collection.updateOne({ key }, { $set: { created: Date.now() - ms } });
    const waitFor = async (check: () => Promise<boolean> | boolean) => {
      const until = Date.now() + 5000;
      while (!(await check())) {
        if (Date.now() > until) {
          throw new Error('timed out');
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    };
    const storedValue = async () => (await CacheStorage.collection.findOne({ key }))?.value;

    beforeEach(() => {
      warn = sandbox.stub(logger, 'warn');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('computes and stores a value the first time, for maxAge', async () => {
      const got = await CacheStorage.getGlobalAndRefresh(key, async () => value, CacheStorage.Times.Minute);
      const found = await CacheStorage.collection.findOne({ key });
      expect(got).to.deep.eq(value);
      expect(found!.value).to.deep.eq(value);
      expect(found!.expireTime).to.eq(CacheStorage.Times.Minute);
    });

    it('passes on a failure the first time, and stores nothing', async () => {
      const err = await CacheStorage.getGlobalAndRefresh(key, async () => {
        throw new Error('no value');
      }, CacheStorage.Times.Minute).catch(e => e);
      expect(err).to.have.property('message', 'no value');
      expect(await CacheStorage.collection.findOne({ key })).to.not.exist;
    });

    it('computes once for concurrent first calls', async () => {
      let calls = 0;
      const refresh = async () => {
        calls++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return value;
      };
      const got = await Promise.all([1, 2, 3].map(() => CacheStorage.getGlobalAndRefresh(key, refresh, CacheStorage.Times.Minute)));
      expect(got).to.deep.eq([value, value, value]);
      expect(calls).to.eq(1);
    });

    it('returns a value younger than maxAge without refreshing it', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      await age(59 * 1000);
      let calls = 0;
      const got = await CacheStorage.getGlobalAndRefresh(key, async () => {
        calls++;
        return fresh;
      }, CacheStorage.Times.Minute);
      expect(got).to.deep.eq(value);
      expect(calls).to.eq(0);
    });

    it('returns a value older than maxAge, and replaces it in the background', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      await age(61 * 1000);
      const got = await CacheStorage.getGlobalAndRefresh(key, async () => fresh, CacheStorage.Times.Minute);
      expect(got).to.deep.eq(value);
      await waitFor(async () => (await storedValue())?.hello === 'again');
      expect(await CacheStorage.getGlobalAndRefresh(key, async () => value, CacheStorage.Times.Minute)).to.deep.eq(fresh);
    });

    it('returns a value cached before staleAfter, and replaces it in the background', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      const got = await CacheStorage.getGlobalAndRefresh(key, async () => fresh, CacheStorage.Times.Minute, Date.now() + 1);
      expect(got).to.deep.eq(value);
      await waitFor(async () => (await storedValue())?.hello === 'again');
    });

    it('ignores a staleAfter older than the value', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      let calls = 0;
      await CacheStorage.getGlobalAndRefresh(key, async () => {
        calls++;
        return fresh;
      }, CacheStorage.Times.Minute, Date.now() - 1000);
      expect(calls).to.eq(0);
    });

    it('dates a value from when its computation started', async () => {
      const started = Date.now();
      let entered = 0;
      await CacheStorage.getGlobalAndRefresh(key, async () => {
        entered = Date.now();
        await new Promise(resolve => setTimeout(resolve, 200));
        return value;
      }, CacheStorage.Times.Minute);
      const found = await CacheStorage.collection.findOne({ key });
      expect(found!.created).to.be.within(started, entered);
      expect(Date.now() - found!.created).to.be.at.least(190);
    });

    it('keeps the value when a refresh fails, without passing on the failure', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      await age(61 * 1000);
      let calls = 0;
      const failing = async () => {
        calls++;
        throw new Error('refresh failed');
      };
      expect(await CacheStorage.getGlobalAndRefresh(key, failing, CacheStorage.Times.Minute)).to.deep.eq(value);
      await waitFor(() => warn.callCount === 1);
      expect(warn.firstCall.args[1]).to.eq(key);
      expect(warn.firstCall.args[2]).to.have.property('message', 'refresh failed');
      expect(await storedValue()).to.deep.eq(value);
      expect(await CacheStorage.getGlobalAndRefresh(key, failing, CacheStorage.Times.Minute)).to.deep.eq(value);
      await waitFor(() => warn.callCount === 2);
      expect(calls).to.eq(2);
    });

    it('recovers from a first computation that throws before returning a promise', async () => {
      const throwing = (): Promise<any> => {
        throw new Error('thrown at once');
      };
      const err = await CacheStorage.getGlobalAndRefresh(key, throwing, CacheStorage.Times.Minute).catch(e => e);
      expect(err).to.have.property('message', 'thrown at once');
      expect(await CacheStorage.getGlobalAndRefresh(key, async () => value, CacheStorage.Times.Minute)).to.deep.eq(value);
    });

    it('recovers from a refresh that throws before returning a promise', async () => {
      await CacheStorage.setGlobal(key, value, CacheStorage.Times.Minute);
      await age(61 * 1000);
      const throwing = (): Promise<any> => {
        throw new Error('thrown at once');
      };
      expect(await CacheStorage.getGlobalAndRefresh(key, throwing, CacheStorage.Times.Minute)).to.deep.eq(value);
      await waitFor(() => warn.callCount === 1);
      expect(warn.firstCall.args[2]).to.have.property('message', 'thrown at once');
      expect(await CacheStorage.getGlobalAndRefresh(key, async () => fresh, CacheStorage.Times.Minute)).to.deep.eq(value);
      await waitFor(async () => (await storedValue())?.hello === 'again');
    });

    it('gives up on a refresh that takes longer than maxAge, so the next call can refresh', async () => {
      const maxAge = 300;
      await CacheStorage.setGlobal(key, value, maxAge);
      await age(maxAge + 1000);
      let calls = 0;
      const hanging = () => {
        calls++;
        return new Promise(() => undefined);
      };
      const started = Date.now();
      expect(await CacheStorage.getGlobalAndRefresh(key, hanging, maxAge)).to.deep.eq(value);
      expect(await CacheStorage.getGlobalAndRefresh(key, hanging, maxAge)).to.deep.eq(value);
      expect(calls).to.eq(1);
      await waitFor(() => warn.callCount === 1);
      expect(Date.now() - started).to.be.below(3 * maxAge);
      expect(warn.firstCall.args[2]).to.have.property('message', `Refreshing ${key} timed out`);
      expect(await CacheStorage.getGlobalAndRefresh(key, async () => fresh, maxAge)).to.deep.eq(value);
      await waitFor(async () => (await storedValue())?.hello === 'again');
      expect(calls).to.eq(1);
    });
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

  it('should expire balance cache for ETH to ETH', async () => {

    const chain = 'ETH';
    const network = 'testnet';
    const address1 = '0x60a0c2f0f36020dca97f6214b3c8ff72d50d76db'; // ETH 1 address
    const address2 = '0x3Ec3dA6E14BE9518A9a6e92DdCC6ACfF2CEFf4ef'; // ETH 2 address
    const otherAddress = '0x9527a556f0D9AA753dE0D1f9Ad024a17dd281B1D';
    const otherKey = `getBalanceForAddress-ETH-testnet-${otherAddress.toLowerCase()}`;

    const key1 = `getBalanceForAddress-${chain}-${network}-${address1.toLowerCase()}`;
    const key2 = `getBalanceForAddress-${chain}-${network}-${address2.toLowerCase()}`;

    const op1 = TEST_OP_ETH_TO_ETH1;
    const op2 = TEST_OP_ETH_TO_ETH2;

    await CacheStorage.setGlobal(key1, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(key2, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(otherKey, value, CacheStorage.Times.Hour);

    await EVMTransactionStorage.expireBalanceCache(op1);
    await EVMTransactionStorage.expireBalanceCache(op2);

    const got1 = await CacheStorage.getGlobal(key1);
    const got2 = await CacheStorage.getGlobal(key2);
    const gotOther = await CacheStorage.getGlobal(otherKey);

    expect(got1).to.eq(null);
    expect(got2).to.eq(null);
    expect(gotOther).to.deep.eq(value);
  });


  it('should expire balance cache for transfer ERC20Token to ERC20Token', async () => {

    const chain = 'ETH';
    const network = 'testnet';
    const address1 = '0x60a0c2f0f36020dca97f6214b3c8ff72d50d76db'; // Linked ETH1 address
    const address2 = '0x3Ec3dA6E14BE9518A9a6e92DdCC6ACfF2CEFf4ef'; // Linked ETH2 address

    const tokenAddress1 = '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa'; // 1 Token address
    const tokenAddress2 = '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa'; // 2 Token address

    const keyToken1 = `getBalanceForAddress-${chain}-${network}-${address1.toLowerCase()}-${tokenAddress1.toLowerCase()}`;
    const keyToken2 = `getBalanceForAddress-${chain}-${network}-${address2.toLowerCase()}-${tokenAddress2.toLowerCase()}`;

    const key1 = `getBalanceForAddress-${chain}-${network}-${address1.toLowerCase()}`;
    const key2 = `getBalanceForAddress-${chain}-${network}-${address2.toLowerCase()}`;

    const op1 = TEST_OP_TRANSFER_ERC20_TO_ERC201;
    const op2 = TEST_OP_TRANSFER_ERC20_TO_ERC202;

    await CacheStorage.setGlobal(keyToken1, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(keyToken2, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(key1, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(key2, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(otherKey, value, CacheStorage.Times.Hour);

    await EVMTransactionStorage.expireBalanceCache(op1);
    await EVMTransactionStorage.expireBalanceCache(op2);

    const gotToken1 = await CacheStorage.getGlobal(keyToken1);
    const gotToken2 = await CacheStorage.getGlobal(keyToken2);
    const got1 = await CacheStorage.getGlobal(key1);
    const got2 = await CacheStorage.getGlobal(key2);
    const gotOther = await CacheStorage.getGlobal(otherKey);

    expect(gotToken1).to.eq(null);
    expect(gotToken2).to.eq(null);
    expect(got1).to.eq(null);
    expect(got2).to.deep.eq(value); // Nothing to update in Linked ETH2
    expect(gotOther).to.deep.eq(value);
  });


  it('should expire balance cache for swaps ERC20Token to ERC20Token', async () => {

    const chain = 'ETH';
    const network = 'testnet';
    const address = '0x60a0c2f0f36020dca97f6214b3c8ff72d50d76db'; // Linked ETH address
    const tokenAddress1 = '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa'; // 1 Token address
    const tokenAddress2 = '0xaaf64bfcc32d0f15873a02163e7e500671a4ffcd'; // 2 Token address

    const keyToken1 = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}-${tokenAddress1.toLowerCase()}`;
    const keyToken2 = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}-${tokenAddress2.toLowerCase()}`;

    const key = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}`;

    const op1 = TEST_OP_ERC20_TO_ERC201;
    const op2 = TEST_OP_ERC20_TO_ERC202;

    await CacheStorage.setGlobal(keyToken1, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(keyToken2, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(otherKey, value, CacheStorage.Times.Hour);

    await EVMTransactionStorage.expireBalanceCache(op1);
    await EVMTransactionStorage.expireBalanceCache(op2);

    const gotToken1 = await CacheStorage.getGlobal(keyToken1);
    const gotToken2 = await CacheStorage.getGlobal(keyToken2);
    const got = await CacheStorage.getGlobal(key);
    const gotOther = await CacheStorage.getGlobal(otherKey);

    expect(gotToken1).to.eq(null);
    expect(gotToken2).to.eq(null);
    expect(got).to.eq(null);
    expect(gotOther).to.deep.eq(value);
  });

  it('should expire balance cache for swaps ERC20Token to ETH', async () => {

    const chain = 'ETH';
    const network = 'testnet';
    const address = '0x60a0c2f0f36020dca97f6214b3c8ff72d50d76db'; // Linked ETH address
    const tokenAddress = '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa'; // Token address
    const keyToken = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}-${tokenAddress.toLowerCase()}`;
    const key = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}`;

    const op1 = TEST_OP_ERC20Token_TO_ETH1;
    const op2 = TEST_OP_ERC20Token_TO_ETH2;

    await CacheStorage.setGlobal(keyToken, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(otherKey, value, CacheStorage.Times.Hour);

    await EVMTransactionStorage.expireBalanceCache(op1);
    await EVMTransactionStorage.expireBalanceCache(op2);

    const gotToken = await CacheStorage.getGlobal(keyToken);
    const got = await CacheStorage.getGlobal(key);
    const gotOther = await CacheStorage.getGlobal(otherKey);

    expect(gotToken).to.eq(null);
    expect(got).to.eq(null);
    expect(gotOther).to.deep.eq(value);
  });

  it('should expire balance cache for swaps ETH to ERC20Token', async () => {

    const chain = 'ETH';
    const network = 'testnet';
    const address = '0x60a0c2f0f36020dca97f6214b3c8ff72d50d76db'; // Linked ETH address
    const tokenAddress = '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa'; // Token address
    const keyToken = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}-${tokenAddress.toLowerCase()}`;
    const key = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}`;

    const op1 = TEST_OP_ETH_TO_ERC201;
    const op2 = TEST_OP_ETH_TO_ERC202;

    await CacheStorage.setGlobal(keyToken, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(otherKey, value, CacheStorage.Times.Hour);

    await EVMTransactionStorage.expireBalanceCache(op1);
    await EVMTransactionStorage.expireBalanceCache(op2);

    const gotToken = await CacheStorage.getGlobal(keyToken);
    const got = await CacheStorage.getGlobal(key);
    const gotOther = await CacheStorage.getGlobal(otherKey);

    expect(gotToken).to.eq(null);
    expect(got).to.eq(null);
    expect(gotOther).to.deep.eq(value);
  });
});
