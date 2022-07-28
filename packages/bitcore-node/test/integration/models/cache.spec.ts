import { ObjectId } from 'bson';
import { expect } from 'chai';
import { CacheStorage } from '../../../src/models/cache';
import { resetDatabase } from '../../helpers';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { EthTransactionStorage } from '../../../src/modules/ethereum/models/transaction';
import { TEST_OP_ETH_TO_ETH1, TEST_OP_ETH_TO_ETH2, TEST_OP_ERC20_TO_ERC201, TEST_OP_ERC20_TO_ERC202, TEST_OP_ERC20Token_TO_ETH1, TEST_OP_ERC20Token_TO_ETH2, TEST_OP_ETH_TO_ERC201, TEST_OP_ETH_TO_ERC202, TEST_OP_TRANSFER_ERC20_TO_ERC201, TEST_OP_TRANSFER_ERC20_TO_ERC202 } from '../../data/test-ops';

describe('Cache Model', function() {
  const key = 'key';
  const value = { hello: 'world' };
  const walletKey = 'wallet-key';
  const walletValue = { walletThing: 1 };
  const wallet = new ObjectId();
  const otherAddress = '0x9527a556f0D9AA753dE0D1f9Ad024a17dd281B1D';
  const otherKey = `getBalanceForAddress-ETH-testnet-${otherAddress.toLowerCase()}`;

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

    await  EthTransactionStorage.expireBalanceCache(op1);
    await  EthTransactionStorage.expireBalanceCache(op2);

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

    const tokenAddress1 = '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa' // 1 Token address
    const tokenAddress2 = '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa' // 2 Token address

    const keyToken1 = `getBalanceForAddress-${chain}-${network}-${address1.toLowerCase()}-${tokenAddress1.toLowerCase()}`;
    const keyToken2 = `getBalanceForAddress-${chain}-${network}-${address2.toLowerCase()}-${tokenAddress2.toLowerCase()}`;

    const key1 = `getBalanceForAddress-${chain}-${network}-${address1.toLowerCase()}`;
    const key2 = `getBalanceForAddress-${chain}-${network}-${address2.toLowerCase()}`;

    const op1 =  TEST_OP_TRANSFER_ERC20_TO_ERC201;
    const op2 =  TEST_OP_TRANSFER_ERC20_TO_ERC202;

    await CacheStorage.setGlobal(keyToken1, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(keyToken2, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(key1, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(key2, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(otherKey, value, CacheStorage.Times.Hour);

    await  EthTransactionStorage.expireBalanceCache(op1);
    await  EthTransactionStorage.expireBalanceCache(op2);

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
    const tokenAddress1 = '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa' // 1 Token address
    const tokenAddress2 = '0xaaf64bfcc32d0f15873a02163e7e500671a4ffcd' // 2 Token address

    const keyToken1 = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}-${tokenAddress1.toLowerCase()}`;
    const keyToken2 = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}-${tokenAddress2.toLowerCase()}`;

    const key = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}`;

     const op1 =  TEST_OP_ERC20_TO_ERC201;
     const op2 =  TEST_OP_ERC20_TO_ERC202;

    await CacheStorage.setGlobal(keyToken1, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(keyToken2, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(otherKey, value, CacheStorage.Times.Hour);

    await  EthTransactionStorage.expireBalanceCache(op1);
    await  EthTransactionStorage.expireBalanceCache(op2);

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
    const tokenAddress = '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa' // Token address
    const keyToken = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}-${tokenAddress.toLowerCase()}`;
    const key = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}`;

     const op1 = TEST_OP_ERC20Token_TO_ETH1;
     const op2 = TEST_OP_ERC20Token_TO_ETH2;

    await CacheStorage.setGlobal(keyToken, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(otherKey, value, CacheStorage.Times.Hour);

    await  EthTransactionStorage.expireBalanceCache(op1);
    await  EthTransactionStorage.expireBalanceCache(op2);

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
    const tokenAddress = '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa' // Token address
    const keyToken = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}-${tokenAddress.toLowerCase()}`;
    const key = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}`;

     const op1 = TEST_OP_ETH_TO_ERC201;
     const op2 =  TEST_OP_ETH_TO_ERC202;

    await CacheStorage.setGlobal(keyToken, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(key, value, CacheStorage.Times.Hour);
    await CacheStorage.setGlobal(otherKey, value, CacheStorage.Times.Hour);

    await  EthTransactionStorage.expireBalanceCache(op1);
    await  EthTransactionStorage.expireBalanceCache(op2);

    const gotToken = await CacheStorage.getGlobal(keyToken);
    const got = await CacheStorage.getGlobal(key);
    const gotOther = await CacheStorage.getGlobal(otherKey);

    expect(gotToken).to.eq(null);
    expect(got).to.eq(null);
    expect(gotOther).to.deep.eq(value);
  });
});
