import { randomBytes } from 'crypto';
import { ObjectId } from 'bson';
import { expect } from 'chai';
import * as sinon from 'sinon';
import logger from '../../../src/logger';
import { CacheStorage } from '../../../src/models/cache';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { XRP } from '../../../src/modules/ripple/api/csp';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

describe('XRP balance at a time', function() {
  const chain = 'XRP';
  // a network of its own, so no other test's cache entries are involved
  const network = 'balanceattime';
  const ledgerIndex = 100;
  const time = '2024-01-01T00:05:00.000Z';
  const genesisTime = '2023-01-01T00:00:00.000Z';
  const timeWithoutLedger = '2000-01-01T00:00:00.000Z';
  const ledgerIndexes = { [time]: ledgerIndex, [genesisTime]: 0 };
  // balances in XRP returned by the client, by ledger
  const balances = { latest: '12.5', [ledgerIndex]: '7.25', 0: '0.000001' };

  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const suite = this;
  this.timeout(30000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  const sandbox = sinon.createSandbox();
  let clientCalls: Array<{ address: string; ledgerIndex?: number }>;
  let ledgerLookups: string[];
  // lets a test hold or fail a client response
  let clientGate: (ledgerIndex?: number) => Promise<void>;
  // balances for particular addresses, in place of `balances`
  let addressBalances: { [address: string]: string };
  let cacheKeys: string[];
  let wallets: ObjectId[];

  // XRP addresses are case sensitive
  function newAddress() {
    return 'r' + randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g, 'x') + 'Ab';
  }

  // the key the transaction tagger expires when a new tx arrives for the address
  function latestKey(address: string) {
    const key = `getBalanceForAddress-${chain}-${network}-${address.toLowerCase()}`;
    cacheKeys.push(key);
    return key;
  }

  function getBalance(address: string, args: any) {
    latestKey(address);
    return XRP.getBalanceForAddress({ chain, network, address, args });
  }

  function getWalletBalance(wallet: any, walletTime = time) {
    return XRP.getWalletBalanceAtTime({ chain, network, wallet, time: walletTime, args: {} });
  }

  async function newWallet(addressCount: number) {
    const wallet = new ObjectId();
    wallets.push(wallet);
    const addresses = new Array(addressCount).fill(null).map(() => newAddress());
    for (const address of addresses) {
      latestKey(address);
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

  function drops(confirmed: number) {
    return { confirmed, unconfirmed: 0, balance: confirmed };
  }

  beforeEach(() => {
    clientCalls = [];
    ledgerLookups = [];
    clientGate = async () => {};
    addressBalances = {};
    cacheKeys = [];
    wallets = [];
    sandbox.stub(XRP, 'getClient').resolves({
      getBalance: async (params: { address: string; ledgerIndex?: number }) => {
        clientCalls.push(params);
        await clientGate(params.ledgerIndex);
        return addressBalances[params.address] ?? balances[params.ledgerIndex ?? 'latest'];
      }
    } as any);
    sandbox.stub(XRP, 'getBlockBeforeTime').callsFake(async params => {
      ledgerLookups.push(params.time as string);
      const index = ledgerIndexes[params.time as string];
      return index === undefined ? null : ({ height: index } as any);
    });
  });

  afterEach(async () => {
    sandbox.restore();
    await CacheStorage.collection.deleteMany({ key: { $in: cacheKeys } });
    await WalletAddressStorage.collection.deleteMany({ wallet: { $in: wallets } });
  });

  describe('getBalanceForAddress', () => {
    it('returns the latest balance in drops and caches it under the latest key', async () => {
      const address = newAddress();
      expect(await getBalance(address, {})).to.deep.equal(drops(12500000));
      expect(clientCalls).to.deep.equal([{ address, ledgerIndex: undefined }]);
      const cached = await CacheStorage.collection.findOne({ key: latestKey(address) });
      expect(cached!.value).to.deep.equal(drops(12500000));
      expect(cached!.expireTime).to.equal(CacheStorage.Times.Minute);
    });

    it('rounds the balance to whole drops', async () => {
      const [first, second] = [newAddress(), newAddress()];
      addressBalances = { [first]: '1.1', [second]: '0.0000014' };
      expect(await getBalance(first, {})).to.deep.equal(drops(1100000));
      expect(await getBalance(second, { time })).to.deep.equal(drops(1));
    });

    it('serves the latest balance from the cache for the same address in any case', async () => {
      const address = newAddress();
      await getBalance(address, {});
      expect(await getBalance(address.toLowerCase(), {})).to.deep.equal(drops(12500000));
      expect(clientCalls.map(call => call.address)).to.deep.equal([address]);
    });

    it('reads the latest balance again once the transaction tagger expires it', async () => {
      const address = newAddress();
      await getBalance(address, {});
      await CacheStorage.expire(latestKey(address));
      await getBalance(address, {});
      expect(clientCalls.length).to.equal(2);
    });

    it('returns the balance at the ledger before the time', async () => {
      const address = newAddress();
      expect(await getBalance(address, { time })).to.deep.equal(drops(7250000));
      expect(ledgerLookups).to.deep.equal([time]);
      expect(clientCalls).to.deep.equal([{ address, ledgerIndex }]);
    });

    it('returns the balance at the genesis ledger', async () => {
      const address = newAddress();
      expect(await getBalance(address, { time: genesisTime })).to.deep.equal(drops(1));
      expect(clientCalls).to.deep.equal([{ address, ledgerIndex: 0 }]);
    });

    it('returns zero for an account that is not funded, and caches the latest zero', async () => {
      clientGate = async () => {
        throw { data: { error_code: 19 } };
      };
      const address = newAddress();
      expect(await getBalance(address, {})).to.deep.equal(drops(0));
      expect(await getBalance(address, {})).to.deep.equal(drops(0));
      expect(await getBalance(newAddress(), { time })).to.deep.equal(drops(0));
      expect(clientCalls.length).to.equal(2);
    });

    it('logs and throws other client errors, without caching them', async () => {
      const loggerError = sandbox.stub(logger, 'error');
      for (const failure of [new Error('client failure'), { message: 'client failure' }, 'client failure']) {
        clientGate = async () => {
          throw failure;
        };
        for (const args of [{}, { time }]) {
          const address = newAddress();
          loggerError.resetHistory();
          expect(await errorFrom(getBalance(address, args))).to.equal(failure);
          expect(loggerError.callCount).to.equal(1);
          expect(loggerError.firstCall.args[0]).to.match(
            new RegExp(`^Error getting XRP balance for ${address} on ${network}: .*client failure`, 's')
          );
          expect(await CacheStorage.collection.findOne({ key: latestKey(address) })).to.equal(null);
        }
      }
    });

    it('throws when there is no ledger before the time', async () => {
      const error = await errorFrom(getBalance(newAddress(), { time: timeWithoutLedger }));
      expect(error.message).to.equal(`Balance not found at ${timeWithoutLedger}`);
      expect(clientCalls).to.deep.equal([]);
    });
  });

  describe('getWalletBalanceAtTime', () => {
    it('sums the balance of every wallet address at the ledger before the time', async () => {
      const { wallet, addresses } = await newWallet(3);
      expect(await getWalletBalance(wallet)).to.deep.equal(drops(21750000));
      expect(clientCalls).to.have.deep.members(addresses.map(address => ({ address, ledgerIndex })));
    });

    it('reads the balance at the genesis ledger', async () => {
      const { wallet } = await newWallet(2);
      expect(await getWalletBalance(wallet, genesisTime)).to.deep.equal(drops(2));
      expect(clientCalls.map(call => call.ledgerIndex)).to.deep.equal([0, 0]);
    });

    it('reads the latest balance when no time is given', async () => {
      const { wallet } = await newWallet(2);
      expect(await getWalletBalance(wallet, '')).to.deep.equal(drops(25000000));
      expect(ledgerLookups).to.deep.equal([]);
      expect(clientCalls.map(call => call.ledgerIndex)).to.deep.equal([undefined, undefined]);
    });

    it('returns zero for a wallet without addresses, without looking up a ledger', async () => {
      const { wallet } = await newWallet(0);
      expect(await getWalletBalance(wallet)).to.deep.equal(drops(0));
      expect(ledgerLookups).to.deep.equal([]);
    });

    it('throws when there is no ledger before the time', async () => {
      const { wallet } = await newWallet(2);
      const error = await errorFrom(getWalletBalance(wallet, timeWithoutLedger));
      expect(error.message).to.equal(`Balance not found at ${timeWithoutLedger}`);
      expect(clientCalls).to.deep.equal([]);
    });
  });
});
