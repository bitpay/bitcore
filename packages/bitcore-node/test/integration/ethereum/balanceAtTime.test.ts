import { randomBytes } from 'crypto';
import { ObjectId } from 'bson';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { CacheStorage } from '../../../src/models/cache';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { ETH } from '../../../src/modules/ethereum/api/csp';
import { EVMBlockStorage } from '../../../src/providers/chain-state/evm/models/block';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('EVM balance at a time', function() {
  const chain = 'ETH';
  // a network of its own, so no other test's blocks or cache entries are involved
  const network = 'balanceattime';
  const height = 100;
  const time = '2024-01-01T00:05:00.000Z';
  const genesisTime = '2023-01-01T00:00:00.000Z';
  const bigTime = '2024-06-01T00:00:00.000Z';
  const timeWithoutBlock = '2000-01-01T00:00:00.000Z';
  const blockHeights = { [time]: height, [genesisTime]: 0, [bigTime]: 200 };
  const tokenAddress = '0x' + 'Ab'.repeat(20);
  // more wei than a double holds exactly
  const big = 5n * 10n ** 18n + 1n;
  // balances returned by the RPC, by block
  const nativeBalances = { latest: 1000n, [height]: 700n, 0: 5n, 200: big };
  const tokenBalances = { latest: 50n, [height]: 30n };

  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  const sandbox = sinon.createSandbox();
  let rpcCalls: Array<{ type: string; method: string; address: string; token?: string; block: number | string }>;
  let blockLookups: string[];
  // lets a test hold or fail an RPC response
  let rpcGate: (block: number | string) => Promise<void>;
  let cacheKeys: string[];
  let wallets: ObjectId[];

  // a mixed-case address, like a checksummed one
  function newAddress() {
    const hex = randomBytes(20).toString('hex');
    return '0x' + hex.replace(/[a-f]/g, (c, i) => (i % 2 ? c.toUpperCase() : c));
  }

  // the key the transaction tagger expires when a new tx arrives for the address
  function latestKey(address: string, token?: string) {
    const key = token
      ? `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}-${token.toLowerCase()}`
      : `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}`;
    cacheKeys.push(key);
    return key;
  }

  function getBalance(address: string, args: any) {
    latestKey(address, args?.tokenAddress);
    return ETH.getBalanceForAddress({ chain, network, address, args });
  }

  function getWalletBalance(wallet: any, args?: any, walletTime = time) {
    return ETH.getWalletBalanceAtTime({ chain, network, wallet, time: walletTime, args });
  }

  async function newWallet(addressCount: number) {
    const wallet = new ObjectId();
    wallets.push(wallet);
    const addresses = new Array(addressCount).fill(null).map(() => newAddress());
    for (const address of addresses) {
      latestKey(address);
      latestKey(address, tokenAddress);
    }
    if (addresses.length) {
      await WalletAddressStorage.collection.insertMany(
        addresses.map(address => ({ chain, network, wallet, address, processed: true }))
      );
    }
    return { wallet: { _id: wallet } as any, addresses };
  }

  async function errorFrom(promise: Promise<any>): Promise<any> {
    try {
      await promise;
    } catch (e) {
      return e;
    }
    throw new Error('expected an error');
  }

  function cacheWrites() {
    return (CacheStorage.setGlobal as sinon.SinonSpy).getCalls().filter(call => cacheKeys.includes(call.args[0]));
  }

  function latestRpcCalls() {
    return rpcCalls.filter(call => call.block === 'latest');
  }

  beforeEach(() => {
    rpcCalls = [];
    blockLookups = [];
    rpcGate = async () => {};
    cacheKeys = [];
    wallets = [];
    sandbox.stub(ETH, 'getWeb3').callsFake(async (_network: string, params?: { type: string }) => {
      const type = params?.type || 'realtime';
      return {
        web3: {
          eth: {
            getBalance: async (address: string, block: number | string) => {
              rpcCalls.push({ type, method: 'getBalance', address, block });
              await rpcGate(block);
              return nativeBalances[block];
            },
            Contract: function(_abi: any, token: string) {
              return {
                methods: {
                  balanceOf: (address: string) => ({
                    call: async (_options: any, block: number | string) => {
                      rpcCalls.push({ type, method: 'balanceOf', address, token, block });
                      await rpcGate(block);
                      return tokenBalances[block];
                    }
                  })
                }
              };
            }
          }
        }
      } as any;
    });
    sandbox.stub(ETH, 'getBlockBeforeTime').callsFake(async params => {
      blockLookups.push(params.time as string);
      const blockHeight = blockHeights[params.time as string];
      return blockHeight === undefined ? null : ({ height: blockHeight } as any);
    });
    sandbox.spy(CacheStorage, 'setGlobal');
  });

  afterEach(async () => {
    sandbox.restore();
    await CacheStorage.collection.deleteMany({ key: { $in: cacheKeys } });
    await WalletAddressStorage.collection.deleteMany({ wallet: { $in: wallets } });
    await EVMBlockStorage.collection.deleteMany({ chain, network });
  });

  describe('getBalanceForAddress', () => {
    it('returns the latest native balance from the realtime RPC and caches it under the latest key', async () => {
      const address = newAddress();
      expect(await getBalance(address, {})).to.deep.equal({ confirmed: 1000, unconfirmed: 0, balance: 1000 });
      expect(rpcCalls).to.deep.equal([{ type: 'realtime', method: 'getBalance', address, block: 'latest' }]);
      const cached = await CacheStorage.collection.findOne({ key: latestKey(address) });
      expect(cached!.value).to.deep.equal({ confirmed: '0x3e8', unconfirmed: '0x0', balance: '0x3e8' });
      expect(cached!.expireTime).to.equal(CacheStorage.Times.Minute);
    });

    it('serves the latest balance from the cache, whatever the address case', async () => {
      const address = newAddress();
      await getBalance(address, {});
      expect(await getBalance(address.toLowerCase(), {})).to.deep.equal(
        { confirmed: 1000, unconfirmed: 0, balance: 1000 }
      );
      expect(rpcCalls.length).to.equal(1);
    });

    it('formats the cached latest balance for each request', async () => {
      const address = newAddress();
      await getBalance(address, {});
      expect(await getBalance(address, { hex: 'true' })).to.deep.equal(
        { confirmed: '0x3e8', unconfirmed: '0x0', balance: '0x3e8' }
      );
      expect(await getBalance(address, {})).to.deep.equal({ confirmed: 1000, unconfirmed: 0, balance: 1000 });
      expect(rpcCalls.length).to.equal(1);
    });

    it('reads the latest balance again once the transaction tagger expires it', async () => {
      const address = newAddress();
      await getBalance(address, {});
      await CacheStorage.expire(latestKey(address));
      await getBalance(address, {});
      expect(latestRpcCalls().length).to.equal(2);
    });

    it('does not cache a failed RPC', async () => {
      const address = newAddress();
      const failure = new Error('rpc failure');
      rpcGate = async () => {
        throw failure;
      };
      expect(await errorFrom(getBalance(address, {}))).to.equal(failure);
      expect(await CacheStorage.collection.findOne({ key: latestKey(address) })).to.equal(null);
      rpcGate = async () => {};
      expect(await getBalance(address, {})).to.deep.equal({ confirmed: 1000, unconfirmed: 0, balance: 1000 });
      expect(rpcCalls.length).to.equal(2);
    });

    it('returns the latest token balance and caches it under the token\'s latest key', async () => {
      const address = newAddress();
      expect(await getBalance(address, { tokenAddress })).to.deep.equal({ confirmed: 50, unconfirmed: 0, balance: 50 });
      expect(rpcCalls).to.deep.equal([
        { type: 'realtime', method: 'balanceOf', address, token: tokenAddress, block: 'latest' }
      ]);
      const cached = await CacheStorage.collection.findOne({ key: latestKey(address, tokenAddress) });
      expect(cached!.value).to.deep.equal({ confirmed: '0x32', unconfirmed: '0x0', balance: '0x32' });
    });

    for (const hex of ['true', '1']) {
      it(`returns hex strings when hex is ${hex}`, async () => {
        expect(await getBalance(newAddress(), { hex })).to.deep.equal(
          { confirmed: '0x3e8', unconfirmed: '0x0', balance: '0x3e8' }
        );
        expect(await getBalance(newAddress(), { hex, time })).to.deep.equal(
          { confirmed: '0x2bc', unconfirmed: '0x0', balance: '0x2bc' }
        );
      });
    }

    it('returns exact hex, and the nearest number otherwise, for balances a double cannot hold', async () => {
      const hex = '0x' + big.toString(16);
      expect(await getBalance(newAddress(), { time: bigTime, hex: 'true' })).to.deep.equal(
        { confirmed: hex, unconfirmed: '0x0', balance: hex }
      );
      expect(await getBalance(newAddress(), { time: bigTime })).to.deep.equal(
        { confirmed: Number(big), unconfirmed: 0, balance: Number(big) }
      );
    });

    it('returns the native balance at the block before the time from the historical RPC', async () => {
      const address = newAddress();
      expect(await getBalance(address, { time })).to.deep.equal({ confirmed: 700, unconfirmed: 0, balance: 700 });
      expect(blockLookups).to.deep.equal([time]);
      expect(rpcCalls).to.deep.equal([{ type: 'historical', method: 'getBalance', address, block: height }]);
    });

    it('returns the token balance at the block before the time from the historical RPC', async () => {
      const address = newAddress();
      expect(await getBalance(address, { time, tokenAddress })).to.deep.equal(
        { confirmed: 30, unconfirmed: 0, balance: 30 }
      );
      expect(rpcCalls).to.deep.equal([
        { type: 'historical', method: 'balanceOf', address, token: tokenAddress, block: height }
      ]);
    });

    it('returns the balance at the genesis block', async () => {
      expect(await getBalance(newAddress(), { time: genesisTime })).to.deep.equal(
        { confirmed: 5, unconfirmed: 0, balance: 5 }
      );
      expect(rpcCalls.map(call => call.block)).to.deep.equal([0]);
    });

    it('finds the block before the time in the blocks collection', async () => {
      (ETH.getBlockBeforeTime as sinon.SinonStub).restore();
      await EVMBlockStorage.collection.deleteMany({ chain, network });
      await EVMBlockStorage.collection.insertMany([
        { chain, network, height: height - 1, timeNormalized: new Date('2024-01-01T00:00:00.000Z') },
        { chain, network, height, timeNormalized: new Date('2024-01-01T00:04:00.000Z') },
        { chain, network, height: height + 1, timeNormalized: new Date('2024-01-01T00:06:00.000Z') }
      ] as any);
      expect(await getBalance(newAddress(), { time })).to.deep.equal({ confirmed: 700, unconfirmed: 0, balance: 700 });
      expect(rpcCalls.map(call => call.block)).to.deep.equal([height]);
    });

    it('throws when there is no block before the time', async () => {
      const error = await errorFrom(getBalance(newAddress(), { time: timeWithoutBlock }));
      expect(error.message).to.equal(`Balance not found at ${timeWithoutBlock}`);
      expect(rpcCalls).to.deep.equal([]);
    });

    it('returns the balance at the time even while the latest balance is cached', async () => {
      const address = newAddress();
      await getBalance(address, {});
      await getBalance(address, { tokenAddress });
      expect(await getBalance(address, { time })).to.deep.equal({ confirmed: 700, unconfirmed: 0, balance: 700 });
      expect(await getBalance(address, { time, tokenAddress })).to.deep.equal(
        { confirmed: 30, unconfirmed: 0, balance: 30 }
      );
    });

    it('does not write the cache for a balance at a time', async () => {
      const address = newAddress();
      await getBalance(address, { time });
      await getBalance(address, { time, tokenAddress });
      expect(cacheWrites()).to.deep.equal([]);
      expect(await CacheStorage.collection.findOne({ key: latestKey(address) })).to.equal(null);
      expect(await CacheStorage.collection.findOne({ key: latestKey(address, tokenAddress) })).to.equal(null);
    });

    it('keeps the cached latest balance when a balance at a time finishes after it', async () => {
      const address = newAddress();
      let historicalStarted: () => void = () => {};
      const started = new Promise<void>(resolve => {
        historicalStarted = resolve;
      });
      let releaseHistorical: () => void = () => {};
      const held = new Promise<void>(resolve => {
        releaseHistorical = resolve;
      });
      rpcGate = async block => {
        if (block !== 'latest') {
          historicalStarted();
          await held;
        }
      };
      // both requests miss the cache; the latest one is cached first, then the one at a time finishes
      const historical = getBalance(address, { time });
      await Promise.race([started, historical]);
      await getBalance(address, {});
      releaseHistorical();
      await historical;

      expect(await getBalance(address, {})).to.deep.equal({ confirmed: 1000, unconfirmed: 0, balance: 1000 });
      expect(latestRpcCalls().length).to.equal(1);
    });
  });

  describe('getWalletBalanceAtTime', () => {
    it('sums the balance of every wallet address at the block before the time', async () => {
      const { wallet, addresses } = await newWallet(3);
      expect(await getWalletBalance(wallet, {})).to.deep.equal({ confirmed: 2100, unconfirmed: 0, balance: 2100 });
      expect(rpcCalls.map(({ type, address, block }) => ({ type, address, block }))).to.have.deep.members(
        addresses.map(address => ({ type: 'historical', address, block: height }))
      );
    });

    it('sums token balances', async () => {
      const { wallet } = await newWallet(3);
      expect(await getWalletBalance(wallet, { tokenAddress })).to.deep.equal(
        { confirmed: 90, unconfirmed: 0, balance: 90 }
      );
    });

    it('returns hex sums when hex is set', async () => {
      const { wallet } = await newWallet(3);
      expect(await getWalletBalance(wallet, { hex: 'true' })).to.deep.equal(
        { confirmed: '0x834', unconfirmed: '0x0', balance: '0x834' }
      );
    });

    it('sums exactly in hex, and sums each address\'s nearest number otherwise', async () => {
      const { wallet } = await newWallet(3);
      const hex = '0x' + (3n * big).toString(16);
      expect(await getWalletBalance(wallet, { hex: 'true' }, bigTime)).to.deep.equal(
        { confirmed: hex, unconfirmed: '0x0', balance: hex }
      );
      const sum = Number(3n * BigInt(Number(big)));
      expect(await getWalletBalance(wallet, {}, bigTime)).to.deep.equal(
        { confirmed: sum, unconfirmed: 0, balance: sum }
      );
    });

    it('reads the balance at the genesis block', async () => {
      const { wallet } = await newWallet(2);
      expect(await getWalletBalance(wallet, {}, genesisTime)).to.deep.equal(
        { confirmed: 10, unconfirmed: 0, balance: 10 }
      );
      expect(rpcCalls.map(call => call.block)).to.deep.equal([0, 0]);
    });

    it('reads the balance at the time without args', async () => {
      const { wallet } = await newWallet(1);
      expect(await getWalletBalance(wallet)).to.deep.equal({ confirmed: 700, unconfirmed: 0, balance: 700 });
      expect(blockLookups).to.deep.equal([time]);
    });

    it('adds the time to the args it is given', async () => {
      const { wallet } = await newWallet(1);
      const args = { hex: 'true' };
      await getWalletBalance(wallet, args);
      expect(args).to.deep.equal({ hex: 'true', time });
    });

    it('reads the latest balance when no time is given', async () => {
      const { wallet } = await newWallet(2);
      expect(await getWalletBalance(wallet, {}, '')).to.deep.equal({ confirmed: 2000, unconfirmed: 0, balance: 2000 });
      expect(blockLookups).to.deep.equal([]);
      expect(rpcCalls.map(call => call.block)).to.deep.equal(['latest', 'latest']);
    });

    it('reads the balance at a time given only in the args', async () => {
      const { wallet } = await newWallet(2);
      expect(await getWalletBalance(wallet, { time }, '')).to.deep.equal(
        { confirmed: 1400, unconfirmed: 0, balance: 1400 }
      );
      expect(rpcCalls.map(call => call.block)).to.deep.equal([height, height]);
    });

    it('reads only the requested address, ignoring case', async () => {
      const { wallet, addresses } = await newWallet(3);
      expect(await getWalletBalance(wallet, { address: addresses[1].toUpperCase() })).to.deep.equal(
        { confirmed: 700, unconfirmed: 0, balance: 700 }
      );
      expect(rpcCalls.map(call => call.address)).to.deep.equal([addresses[1]]);
    });

    it('returns zero for an address that is not in the wallet, without looking up a block', async () => {
      const { wallet } = await newWallet(2);
      expect(await getWalletBalance(wallet, { address: newAddress() })).to.deep.equal(
        { confirmed: 0, unconfirmed: 0, balance: 0 }
      );
      expect(blockLookups).to.deep.equal([]);
    });

    it('returns zero for a wallet without addresses, without looking up a block', async () => {
      const { wallet } = await newWallet(0);
      expect(await getWalletBalance(wallet, {})).to.deep.equal({ confirmed: 0, unconfirmed: 0, balance: 0 });
      expect(blockLookups).to.deep.equal([]);
    });

    it('throws when there is no block before the time', async () => {
      const { wallet } = await newWallet(2);
      const error = await errorFrom(getWalletBalance(wallet, {}, timeWithoutBlock));
      expect(error.message).to.equal(`Balance not found at ${timeWithoutBlock}`);
      expect(rpcCalls).to.deep.equal([]);
    });

    it('throws for a wallet without an _id', async () => {
      const error = await errorFrom(getWalletBalance({}, {}));
      expect(error.message).to.equal('Wallet balance can only be retrieved for wallets with the _id property');
    });

    it('sums the balances at the time even while the latest balances are cached', async () => {
      const { wallet, addresses } = await newWallet(3);
      for (const address of addresses) {
        await getBalance(address, {});
      }
      expect(await getWalletBalance(wallet, {})).to.deep.equal({ confirmed: 2100, unconfirmed: 0, balance: 2100 });
      expect(cacheWrites().length).to.equal(3);
      for (const address of addresses) {
        const cached = await CacheStorage.collection.findOne({ key: latestKey(address) });
        expect(cached!.value.balance).to.equal('0x3e8');
      }
    });

    for (const [label, walletTime] of [['', time], [' at the genesis block', genesisTime]]) {
      it(`looks up the block once for every address in the wallet${label}`, async () => {
        const { wallet } = await newWallet(3);
        await getWalletBalance(wallet, {}, walletTime);
        expect(blockLookups).to.deep.equal([walletTime]);
      });
    }
  });
});
