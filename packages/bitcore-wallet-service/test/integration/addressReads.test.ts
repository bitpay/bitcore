'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import util from 'util';
import sinon from 'sinon';
import { BCHAddressTranslator } from '../../src/lib/bchaddresstranslator';
import { Common } from '../../src/lib/common';
import { Address } from '../../src/lib/model';
import { WalletService } from '../../src/lib/server';
import { Storage } from '../../src/lib/storage';
import * as TestData from '../testdata';
import helpers from './helpers';

const should = chai.should();
const { Defaults } = Common;

// The order the wallet's addresses come back in: by createdOn, then by path compared as a string, so within one second
// m/0/10 comes before m/0/2. Every case below is checked against this list.
const ORDER = [
  // createdOn 1000
  'm/0/0', 'm/0/1', 'm/0/2', 'm/0/3', 'm/0/4', 'm/1/0',
  // createdOn 1001
  'm/0/10', 'm/0/11', 'm/0/12', 'm/0/5', 'm/0/6', 'm/0/7', 'm/0/8', 'm/0/9', 'm/1/1', 'm/1/2'
];
const CREATED_ON = path => ['m/0/0', 'm/0/1', 'm/0/2', 'm/0/3', 'm/0/4', 'm/1/0'].includes(path) ? 1000 : 1001;

describe('Address reads', function() {
  let blockchainExplorer;
  let storage: Storage;

  before(async function() {
    ({ blockchainExplorer, storage } = await helpers.before());
  });

  beforeEach(async function() {
    await helpers.beforeEach();
  });

  // undoes direct assignments to the mock explorer
  const restores: Array<() => void> = [];
  afterEach(function() {
    sinon.restore();
    while (restores.length) restores.pop()();
  });

  after(async function() {
    await helpers.after();
  });

  const call = (server: WalletService, method: string, opts = {}) => util.promisify(server[method]).call(server, opts);
  const addresses = () => storage.db.collection(Storage.collections.ADDRESSES);
  const setCreatedOn = (walletId: string, paths: string[], createdOn) => addresses().updateMany({ walletId, path: { $in: paths } }, { $set: { createdOn } });

  // A 1-of-1 wallet with 13 receive and 3 change addresses, stored with the createdOn values of ORDER
  const walletWithAddresses = async (opts = {}) => {
    const { server, wallet } = await helpers.createAndJoinWallet(1, 1, opts);
    await helpers.createAddresses(server, wallet, 13, 3);
    for (const createdOn of [1000, 1001]) {
      await setCreatedOn(wallet.id, ORDER.filter(path => CREATED_ON(path) === createdOn), createdOn);
    }
    const docs = await addresses().find({ walletId: wallet.id }).toArray();
    const addressOf = Object.fromEntries(docs.map(d => [d.path, d.address]));
    return { server, wallet, addressOf };
  };

  // What getAddresses should return for these options, applied to ORDER the way the API documents them
  const expectedPaths = ({ noChange = false, reverse = false, skip = 0, limit = 0, paths = null, order = ORDER }) => {
    let list = order.filter(path => !(noChange && path.startsWith('m/1/')) && (!paths || paths.includes(path)));
    if (reverse) list = [...list].reverse();
    if (skip > 0) list = list.slice(skip);
    if (limit > 0) list = list.slice(0, limit);
    return list;
  };

  // Makes the addresses collection fail every query
  const failAddressQueries = () => {
    const realCollection = storage.db.collection.bind(storage.db);
    const failing = {
      find: () => failing,
      sort: () => failing,
      skip: () => failing,
      limit: () => failing,
      project: () => failing,
      toArray: cb => cb(new Error('addresses read failed')),
      findOne: (...args) => args.pop()(new Error('addresses read failed'))
    };
    sinon.stub(storage.db, 'collection').callsFake(name => name === Storage.collections.ADDRESSES ? failing : realCollection(name));
  };

  describe('getAddresses', function() {
    it('orders by createdOn, then by path as a string', async function() {
      const { server } = await walletWithAddresses();
      const result = await call(server, 'getAddresses');
      result.map(a => a.path).should.deep.equal(ORDER);
    });

    it('applies noChange, reverse, skip and limit in that order, for every combination', async function() {
      const { server } = await walletWithAddresses();
      for (const noChange of [false, true]) {
        for (const reverse of [false, true]) {
          for (const skip of [0, 2, 3, 4, 7, 20]) {
            for (const limit of [0, 1, 3, 4, 5, 6, 8, 10, 20]) {
              const opts = { noChange, reverse, skip, limit };
              const result = await call(server, 'getAddresses', opts);
              result.map(a => a.path).should.deep.equal(expectedPaths(opts), JSON.stringify(opts));
            }
          }
        }
      }
    });

    it('filters by address, keeping the order and the paging', async function() {
      const { server, addressOf } = await walletWithAddresses();
      const paths = ['m/0/2', 'm/0/11', 'm/1/2', 'm/0/9', 'm/0/0'];
      for (const reverse of [false, true]) {
        for (const [skip, limit] of [[0, 0], [1, 2], [0, 10]]) {
          for (const noChange of [false, true]) {
            const opts = { addresses: paths.map(p => addressOf[p]), noChange, reverse, skip, limit };
            const result = await call(server, 'getAddresses', opts);
            result.map(a => a.path).should.deep.equal(expectedPaths({ paths, noChange, reverse, skip, limit }), JSON.stringify({ reverse, skip, limit, noChange }));
          }
        }
      }
    });

    const expectOrder = async (server, order: string[], opts = {}) => {
      for (const paging of [{}, { limit: 2 }, { reverse: true, limit: 2 }, { skip: 1, limit: 3 }]) {
        const all = { ...opts, ...paging };
        (await call(server, 'getAddresses', all)).map(a => a.path).should.deep.equal(expectedPaths({ ...all, order }), JSON.stringify(all));
      }
    };

    it('puts an address with no createdOn last', async function() {
      const { server, wallet } = await walletWithAddresses();
      await addresses().updateOne({ walletId: wallet.id, path: 'm/0/3' }, { $unset: { createdOn: '' } });
      await expectOrder(server, [...ORDER.filter(p => p !== 'm/0/3'), 'm/0/3']);
    });

    it('puts an address with a null createdOn first', async function() {
      const { server, wallet } = await walletWithAddresses();
      await setCreatedOn(wallet.id, ['m/0/9'], null);
      await expectOrder(server, ['m/0/9', ...ORDER.filter(p => p !== 'm/0/9')]);
    });

    it('keeps the order of receive addresses when only a change address has no createdOn', async function() {
      const { server, wallet } = await walletWithAddresses();
      await addresses().updateOne({ walletId: wallet.id, path: 'm/1/0' }, { $unset: { createdOn: '' } });
      await expectOrder(server, [...ORDER.filter(p => p !== 'm/1/0'), 'm/1/0'], { noChange: true });
    });

    it('leaves out addresses whose isChange is any truthy value when noChange is set', async function() {
      const { server, wallet } = await walletWithAddresses();
      await addresses().updateOne({ walletId: wallet.id, path: 'm/1/1' }, { $set: { isChange: 1 } });
      for (const opts of [{ noChange: true }, { noChange: true, limit: 20 }]) {
        (await call(server, 'getAddresses', opts)).map(a => a.path).should.deep.equal(expectedPaths({ noChange: true }), JSON.stringify(opts));
      }
    });

    it('returns nothing for a wallet with no addresses, an empty address filter, or a skip past the end', async function() {
      const { server: empty } = await helpers.createAndJoinWallet(1, 1);
      for (const opts of [{}, { limit: 1 }, { reverse: true, limit: 1 }]) {
        (await call(empty, 'getAddresses', opts)).should.deep.equal([]);
      }
      const { server } = await walletWithAddresses({ offset: 1 });
      (await call(server, 'getAddresses', { addresses: [] })).should.deep.equal([]);
      (await call(server, 'getAddresses', { skip: 30, limit: 2 })).should.deep.equal([]);
    });

    it('treats fractional, huge, infinite, negative and NaN skips and limits the way slice does', async function() {
      const { server } = await walletWithAddresses();
      for (const opts of [
        { limit: 1.5 }, { limit: 0.5 }, { limit: Infinity }, { limit: 1e300 }, { skip: 2, limit: 2 ** 60 }, { limit: -1 }, { limit: NaN },
        { skip: 1.5, limit: 2 }, { skip: Infinity, limit: 1 }, { skip: -2, limit: 2 }, { skip: NaN, limit: 2 }, { reverse: true, skip: 2.7, limit: 3.2 }
      ]) {
        (await call(server, 'getAddresses', opts)).map(a => a.path).should.deep.equal(expectedPaths(opts), JSON.stringify(opts));
      }
    });

    it('returns BCH addresses in cash address format', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'bch' });
      await helpers.createAddresses(server, wallet, 2, 0);
      const stored = await addresses().find({ walletId: wallet.id }).sort({ path: 1 }).toArray();

      const result = await call(server, 'getAddresses', { limit: 1 });

      result.length.should.equal(1);
      result[0].address.should.equal(BCHAddressTranslator.translate(stored[0].address, 'cashaddr'));
    });

    it('passes on a storage error', async function() {
      const { server } = await walletWithAddresses();
      failAddressQueries();
      for (const opts of [{}, { limit: 2 }]) {
        const err: any = await call(server, 'getAddresses', opts).catch(e => e);
        err.message.should.equal('addresses read failed');
      }
    });
  });

  describe('createAddress', function() {
    // 13 receive addresses, all created in the same second, so the newest three are m/0/7, m/0/8 and m/0/9
    const walletAtTheGap = async () => {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 1);
      await helpers.createAddresses(server, wallet, 13, 3);
      await addresses().updateMany({ walletId: wallet.id }, { $set: { createdOn: 1001 } });
      sinon.stub(Defaults, 'MAX_MAIN_ADDRESS_GAP').value(3);
      const docs = await addresses().find({ walletId: wallet.id }).toArray();
      const pathOf = Object.fromEntries(docs.map(d => [d.address, d.path]));
      const addressOf = Object.fromEntries(docs.map(d => [d.path, d.address]));
      return { server, wallet, pathOf, addressOf };
    };
    const recordActivityChecks = (pathOf, active: string[], failsOn?: number) => {
      helpers.stubAddressActivity(active, failsOn);
      return sinon.spy(blockchainExplorer, 'getAddressActivity');
    };

    it('fails at the gap after checking the newest receive addresses, newest first', async function() {
      const { server, pathOf } = await walletAtTheGap();
      const checks = recordActivityChecks(pathOf, []);

      const err: any = await call(server, 'createAddress').catch(e => e);

      err.code.should.equal('MAIN_ADDRESS_GAP_REACHED');
      checks.getCalls().map(c => pathOf[c.args[0]]).should.deep.equal(['m/0/9', 'm/0/8', 'm/0/7']);
    });

    it('stops at the newest address with activity, marks it, and creates the next address', async function() {
      const { server, wallet, pathOf, addressOf } = await walletAtTheGap();
      const checks = recordActivityChecks(pathOf, [addressOf['m/0/8'], addressOf['m/0/7']]);

      const address = await call(server, 'createAddress');

      address.path.should.equal('m/0/13');
      checks.getCalls().map(c => pathOf[c.args[0]]).should.deep.equal(['m/0/9', 'm/0/8']);
      const marked = await addresses().find({ walletId: wallet.id, hasActivity: true }).toArray();
      marked.map(d => d.path).should.deep.equal(['m/0/8']);
    });

    it('creates without checking when an address in the window already has activity', async function() {
      const { server, wallet, pathOf } = await walletAtTheGap();
      await addresses().updateOne({ walletId: wallet.id, path: 'm/0/7' }, { $set: { hasActivity: true } });
      const checks = recordActivityChecks(pathOf, []);

      (await call(server, 'createAddress')).path.should.equal('m/0/13');
      checks.callCount.should.equal(0);
    });

    it('ignores activity on addresses outside the window and on change addresses', async function() {
      const { server, wallet, pathOf } = await walletAtTheGap();
      await addresses().updateMany({ walletId: wallet.id, path: { $in: ['m/0/6', 'm/0/10', 'm/1/2'] } }, { $set: { hasActivity: true } });
      const checks = recordActivityChecks(pathOf, []);

      const err: any = await call(server, 'createAddress').catch(e => e);

      err.code.should.equal('MAIN_ADDRESS_GAP_REACHED');
      checks.callCount.should.equal(3);
    });

    it('creates without checking when there are fewer receive addresses than the gap', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 1);
      await helpers.createAddresses(server, wallet, 2, 5);
      sinon.stub(Defaults, 'MAX_MAIN_ADDRESS_GAP').value(3);
      const checks = recordActivityChecks({}, []);

      (await call(server, 'createAddress')).path.should.equal('m/0/2');
      checks.callCount.should.equal(0);
    });

    it('passes on an error checking activity', async function() {
      const { server, pathOf } = await walletAtTheGap();
      recordActivityChecks(pathOf, [], 2);
      const err = await call(server, 'createAddress').catch(e => e);
      err.should.equal('failed on request');
    });

    it('passes on a storage error', async function() {
      const { server } = await walletAtTheGap();
      failAddressQueries();
      const err: any = await call(server, 'createAddress').catch(e => e);
      err.message.should.equal('addresses read failed');
    });

    it('returns the first address of a single-address wallet', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 1, { singleAddress: true });
      const first = await call(server, 'createAddress');
      first.path.should.equal('m/0/0');
      (await call(server, 'createAddress')).address.should.equal(first.address);
      (await addresses().countDocuments({ walletId: wallet.id })).should.equal(1);
    });

    it('passes on a storage error for a single-address wallet', async function() {
      const { server } = await helpers.createAndJoinWallet(1, 1, { singleAddress: true });
      await call(server, 'createAddress');
      failAddressQueries();
      const err: any = await call(server, 'createAddress').catch(e => e);
      err.message.should.equal('addresses read failed');
    });
  });

  describe('reads only the addresses it needs', function() {
    // 30 receive and 10 change addresses, each created in its own second
    const largeWallet = async () => {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 1);
      await helpers.createAddresses(server, wallet, 30, 10);
      const docs = await addresses().find({ walletId: wallet.id }).toArray();
      for (const [i, doc] of docs.entries()) {
        await addresses().updateOne({ _id: doc._id }, { $set: { createdOn: 1000 + i } });
      }
      return { server, wallet };
    };
    const countBuilt = () => sinon.spy(Address, 'fromObj');
    // Wraps the addresses collection: counts the documents its queries return, and fails the queries after the first
    // `passing` finds when that is given. The cursors are the real ones, so the query shape doesn't matter.
    const wrapAddressQueries = ({ passing = Infinity } = {}) => {
      const realCollection = storage.db.collection.bind(storage.db);
      const counts = { finds: 0, docs: 0, findOnes: 0 };
      sinon.stub(storage.db, 'collection').callsFake(name => {
        const collection = realCollection(name);
        if (name !== Storage.collections.ADDRESSES) return collection;
        return Object.assign(Object.create(collection), {
          find: (...args) => {
            const cursor = collection.find(...args);
            const fail = ++counts.finds > passing;
            const toArray = cursor.toArray.bind(cursor);
            cursor.toArray = cb => fail ? cb(new Error('addresses read failed')) : toArray((err, docs) => {
              counts.docs += docs?.length || 0;
              cb(err, docs);
            });
            return cursor;
          },
          findOne: (...args) => {
            counts.findOnes++;
            return collection.findOne(...args);
          }
        });
      });
      return counts;
    };

    it('getAddresses with a limit builds only that many addresses', async function() {
      const { server } = await largeWallet();
      const built = countBuilt();
      const read = wrapAddressQueries();
      (await call(server, 'getAddresses', { limit: 1 })).length.should.equal(1);
      built.callCount.should.equal(1);
      read.docs.should.equal(2); // the page and one more, to see that the next address has a different createdOn
      read.findOnes.should.equal(1);
    });

    it('getAddresses with skip and a limit builds only the addresses up to the end of the page', async function() {
      const { server } = await largeWallet();
      const built = countBuilt();
      const read = wrapAddressQueries();
      (await call(server, 'getAddresses', { noChange: true, reverse: true, skip: 2, limit: 3 })).length.should.equal(3);
      built.callCount.should.equal(5);
      read.docs.should.equal(6);
    });

    it('getAddresses also builds the addresses that share the page\'s last createdOn', async function() {
      const { server, wallet } = await largeWallet();
      const first = await addresses().find({ walletId: wallet.id }).sort({ createdOn: 1 }).limit(4).toArray();
      await addresses().updateMany({ _id: { $in: first.slice(1).map(d => d._id) } }, { $set: { createdOn: first[1].createdOn } });
      const built = countBuilt();
      const read = wrapAddressQueries();
      (await call(server, 'getAddresses', { limit: 2 })).length.should.equal(2);
      built.callCount.should.equal(4);
      read.docs.should.equal(6); // the page and one more, then the three sharing the last createdOn
    });

    it('getAddresses passes on a storage error reading the page', async function() {
      const { server } = await largeWallet();
      wrapAddressQueries({ passing: 0 });
      const err: any = await call(server, 'getAddresses', { limit: 2 }).catch(e => e);
      err.message.should.equal('addresses read failed');
    });

    it('getAddresses passes on a storage error reading the addresses that share the last createdOn', async function() {
      const { server, wallet } = await largeWallet();
      await addresses().updateMany({ walletId: wallet.id }, { $set: { createdOn: 1000 } });
      wrapAddressQueries({ passing: 1 });
      const err: any = await call(server, 'getAddresses', { limit: 2 }).catch(e => e);
      err.message.should.equal('addresses read failed');
    });

    it('the single-address paths build only the first address', async function() {
      for (const [coin, singleAddress] of [['eth', false], ['xrp', false], ['btc', true]] as Array<[string, boolean]>) {
        const { server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin, singleAddress, offset: coin === 'xrp' ? 1 : coin === 'btc' ? 2 : 0 });
        await helpers.createAddresses(server, wallet, 10, 0);
        const docs = await addresses().find({ walletId: wallet.id }).toArray();
        for (const [i, doc] of docs.entries()) {
          await addresses().updateOne({ _id: doc._id }, { $set: { createdOn: 1000 + i } });
        }
        await helpers.stubUtxos(server, wallet, [1]);
        const built = countBuilt();
        await call(server, coin === 'btc' ? 'createAddress' : 'getBalance');
        built.callCount.should.equal(1, coin);
        built.restore();
      }
    });

    it('createAddress builds only the addresses in the gap window', async function() {
      const { server } = await largeWallet();
      sinon.stub(Defaults, 'MAX_MAIN_ADDRESS_GAP').value(3);
      helpers.stubAddressActivity([]);
      const built = countBuilt();
      const read = wrapAddressQueries();
      const err: any = await call(server, 'createAddress').catch(e => e);
      err.code.should.equal('MAIN_ADDRESS_GAP_REACHED');
      built.callCount.should.equal(3);
      read.docs.should.equal(4);
    });
  });

  describe('single-address chains use their first address', function() {
    // BWS can't derive a SOL address from an xpub (the client supplies a derived key), so the SOL wallet's address is
    // stored directly
    const SOL_ADDRESS = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
    const SOL_ADDRESS_2 = 'GZNcvqb38Yd3TPD5JMvZJAGxxrDu8JLGECykcmzBpBw7';
    const firstAddress = async (coin: string, server: WalletService, wallet) => {
      if (coin !== 'sol') return call(server, 'createAddress');
      const address = { walletId: wallet.id, address: SOL_ADDRESS, path: 'm/0/0', isChange: false, publicKeys: [], coin: 'sol', chain: 'sol', network: 'livenet', createdOn: 1000 };
      await addresses().insertOne({ ...address });
      return address;
    };
    // stubUtxos doesn't handle SOL: the mock explorer's getBalance already answers with a balance, and the rent minimum
    // is stubbed here
    const stubBalance = async (coin: string, server: WalletService, wallet) => {
      if (coin !== 'sol') return helpers.stubUtxos(server, wallet, [1]);
      const getRentMinimum = blockchainExplorer.getRentMinimum;
      blockchainExplorer.getRentMinimum = (space, cb) => cb(null, Defaults.MIN_SOL_BALANCE);
      restores.push(() => { blockchainExplorer.getRentMinimum = getRentMinimum; });
    };

    for (const coin of ['eth', 'xrp', 'sol']) {
      it(`${coin} balance lists the first address`, async function() {
        const { server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin });
        const address = await firstAddress(coin, server, wallet);
        await stubBalance(coin, server, wallet);

        const balance = await call(server, 'getBalance');

        balance.byAddress.length.should.equal(1);
        balance.byAddress[0].address.should.equal(address.address);
        balance.byAddress[0].path.should.equal(address.path);
      });

      it(`${coin} balance passes on a storage error`, async function() {
        const { server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin });
        await firstAddress(coin, server, wallet);
        await stubBalance(coin, server, wallet);
        failAddressQueries();
        const err: any = await call(server, 'getBalance').catch(e => e);
        err.message.should.equal('addresses read failed');
      });
    }

    // 11 receive addresses where m/0/2 and m/0/10 are the oldest: comparing paths as strings makes m/0/10 first
    const tieForFirst = async (server, wallet) => {
      await helpers.createAddresses(server, wallet, 11, 0);
      await addresses().updateMany({ walletId: wallet.id }, { $set: { createdOn: 1001 } });
      await setCreatedOn(wallet.id, ['m/0/2', 'm/0/10'], 1000);
      return (await addresses().findOne({ walletId: wallet.id, path: 'm/0/10' })).address;
    };

    it('the first address is the first by createdOn, then by path as a string', async function() {
      const { server: eth, wallet: ethWallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' });
      const ethFirst = await tieForFirst(eth, ethWallet);
      await helpers.stubUtxos(eth, ethWallet, [1]);
      (await call(eth, 'getBalance')).byAddress.map(a => a.address).should.deep.equal([ethFirst]);

      const { server: btc, wallet: btcWallet } = await helpers.createAndJoinWallet(1, 1, { singleAddress: true, offset: 1 });
      const btcFirst = await tieForFirst(btc, btcWallet);
      (await call(btc, 'createAddress')).address.should.equal(btcFirst);
      // the change goes to the first address too
      await helpers.stubUtxos(btc, btcWallet, [1]);
      const txp = await helpers.createAndPublishTx(btc, {
        outputs: [{ toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', amount: 0.5e8 }],
        feePerKb: 100e2
      }, TestData.copayers[1].privKey_1H_0);
      txp.changeAddress.address.should.equal(btcFirst);

      const { server: sol, wallet: solWallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'sol', offset: 2 });
      await firstAddress('sol', sol, solWallet);
      await addresses().insertOne({ walletId: solWallet.id, address: SOL_ADDRESS_2, path: 'm/0/1', isChange: false, publicKeys: [], coin: 'sol', chain: 'sol', network: 'livenet', createdOn: 2000 });
      await stubBalance('sol', sol, solWallet);
      (await call(sol, 'getBalance')).byAddress.map(a => a.address).should.deep.equal([SOL_ADDRESS]);
    });

    it('a single-address BTC wallet sends change to its first address', async function() {
      const { server, wallet } = await helpers.createAndJoinWallet(1, 1, { singleAddress: true });
      const address = await call(server, 'createAddress');
      await helpers.stubUtxos(server, wallet, [1]);

      const txp = await helpers.createAndPublishTx(server, {
        outputs: [{ toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', amount: 0.5e8 }],
        feePerKb: 100e2
      }, TestData.copayers[0].privKey_1H_0);

      txp.changeAddress.address.should.equal(address.address);
    });
  });
});
