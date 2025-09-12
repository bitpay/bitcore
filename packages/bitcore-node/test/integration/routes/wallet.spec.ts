import supertest from 'supertest';
import sinon from 'sinon';
import app from '../../../src/routes';
import { expect } from 'chai';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { resetDatabase } from '../../helpers';
import { ChainStateProvider } from '../../../src/providers/chain-state';
import { WalletStorage } from '../../../src/models/wallet';
import { WalletAddressStorage } from '../../../src/models/walletAddress';

const request = supertest(app);
const bitcore = require('bitcore-lib');
const secp256k1 = require('secp256k1');

const privKey = new bitcore.PrivateKey();
const pubKey = bitcore.PublicKey(privKey);
const address = new bitcore.PrivateKey().toAddress();

const wallet = {
  chain: 'BTC',
  network: 'regtest',
  name: 'user',
  pubKey: pubKey.toString(),
  path: 'm/84/1h/0h/0/0',
  singleAddress: 'bcrt1qzun74zp996s2najfar32t6j5dmyj5052s4vdq7'
};

function testWalletEquivalence(wallet1, doc) {
  const { chain, network, name, pubKey, path, singleAddress } = doc;

  expect(chain).to.equal(wallet1.chain);
  expect(network).to.equal(wallet1.network);
  expect(name).to.equal(wallet1.name);
  expect(pubKey).to.equal(wallet1.pubKey);
  expect(path).to.equal(wallet1.path);
  expect(singleAddress).to.equal(wallet1.singleAddress);
}

function getSignature(privateKey, method: 'GET' | 'POST', url: string, body={}) {
  const message = [method, url, JSON.stringify(body)].join('|');
  const messageHash = bitcore.crypto.Hash.sha256sha256(Buffer.from(message));
  return Buffer.from(secp256k1.ecdsaSign(messageHash, privateKey.toBuffer()).signature).toString('hex');
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

  it('should not add wallet twice', done => {
    // const createSpy = sandbox.spy(ChainStateProvider, 'createWallet');
    const getSpy = sandbox.spy(ChainStateProvider, 'getWallet');
    request.post(`/api/${wallet.chain}/${wallet.network}/wallet`)
      .send(wallet)
      .expect(200, (err, res) => {
        if (err) console.error(err);
        // expect(createSpy.notCalled).to.be.true;
        expect(getSpy.calledOnce).to.be.true;
        expect(res.text).to.equal('Wallet already exists');
        done();
      });
  });

  it('should get wallet initial balance and it should be empty', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/balance`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url, {}))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { confirmed, unconfirmed, balance } = res.body;
        expect(confirmed).to.equal(0);
        expect(unconfirmed).to.equal(0);
        expect(balance).to.equal(0);
        done();
      });
  });

  it('should have document in wallets', done => {
    WalletStorage.collection.findOne(wallet).then(doc => {
      testWalletEquivalence(wallet, doc);
      done();
    }).catch(done);
  });

  it('should get wallet initial utxos and it should be empty', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/utxos`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url, {}))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(res.body).to.deep.equal([]);
        done();
      });
  }); 

  it('should update wallet', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}`;
    const body = [{ address: address.toObject() }];
    const chainStateUpdateWalletSpy = sandbox.spy(ChainStateProvider, 'updateWallet');
    const walletAddressStorageUpdateCoinsSpy = sandbox.spy(WalletAddressStorage, 'updateCoins');

    request.post(url)
      .set('x-signature', getSignature(privKey, 'POST', url, body))
      .send(body)
      .expect(200, (err) => {
        if (err) console.error(err);
        expect(chainStateUpdateWalletSpy.calledOnce).to.be.true;
        expect(walletAddressStorageUpdateCoinsSpy.calledOnce).to.be.true;
        done();
      })
  });

  it('should get address after update', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/addresses`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url, {}))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(res.body).to.deep.include({ address: address.toObject() });
        done();
      });
  });
});