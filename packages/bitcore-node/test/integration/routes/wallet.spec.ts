import supertest from 'supertest';
import sinon from 'sinon';
import app from '../../../src/routes';
import { expect } from 'chai';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { resetDatabase } from '../../helpers';
import { ChainStateProvider } from '../../../src/providers/chain-state';
import { WalletStorage } from '../../../src/models/wallet';

const request = supertest(app);

const wallet = {
  chain: 'BTC',
  network: 'regtest',
  name: 'user',
  pubKey: '037fe2463515824e28d31e4629b42e2319a358e7e951281cf1af13d13a27edf4f1',
  path: 'm/84/1h/0h/0/0',
  singleAddress: 'bcrt1qzun74zp996s2najfar32t6j5dmyj5052s4vdq7'
}
function testWalletEquivalence(wallet1, doc) {
  const { chain, network, name, pubKey, path, singleAddress } = doc;

  expect(chain).to.equal(wallet1.chain);
  expect(network).to.equal(wallet1.network);
  expect(name).to.equal(wallet1.name);
  expect(pubKey).to.equal(wallet1.pubKey);
  expect(path).to.equal(wallet1.path);
  expect(singleAddress).to.equal(wallet1.singleAddress);
}

describe('Wallet Routes', function() {
  let sandbox;

  before(async function() {
    this.timeout(15000);
    await intBeforeHelper();
    await resetDatabase();
  });

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    sandbox.restore();
  });

  after(async function() {
    await intAfterHelper();
  });


  it('should have empty wallets db at start', done => {
    WalletStorage.collection.findOne({}).then(doc => {
      expect(doc).to.be.null;
      done();
    }).catch(done);
  });

  it('should not have wallet before it is created', done => {
    const spy = sandbox.spy(ChainStateProvider, 'createWallet');
    request.get(`/api/${wallet.chain}/${wallet.network}/wallet/${wallet.pubKey}`)
      .expect(404, (err, res) => {
        if (err) console.error(err);
        expect(res.text).to.include('Wallet not found');
        // test to make sure sinon is working and not giving genuine positives in other tests
        expect(spy.notCalled).to.be.true;
        done();
      });
  });

  it('should create a new wallet', done => {
    const spy = sandbox.spy(ChainStateProvider, 'createWallet');
    request.post(`/api/${wallet.chain}/${wallet.network}/wallet`)
      .send(wallet)
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(spy.calledOnce).to.be.true;
        testWalletEquivalence(wallet, res.body);
        done();
      });
  });

  it('should get wallet initial balance and it should be empty', done => {
    request.get(`/api/${wallet.chain}/${wallet.network}/wallet/${wallet.pubKey}/balance`)
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { confirmed, unconfirmed, balance } = res.body;
        expect(confirmed).to.equal(0);
        expect(unconfirmed).to.equal(0);
        expect(balance).to.equal(0);
        done();
      });
  });

  it('should have a db call to wallets', done => {
    WalletStorage.collection.findOne(wallet).then(doc => {
      testWalletEquivalence(wallet, doc);
      done();
    }).catch(done);
  });

  it('should get wallet initial utxos and it should be empty', done => {
    request.get(`/api/${wallet.chain}/${wallet.network}/wallet/${wallet.pubKey}/utxos`)
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(res.body).to.deep.equal([]);
        done();
      });
  });
});