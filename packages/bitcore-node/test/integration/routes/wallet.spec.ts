import supertest from 'supertest';
import sinon from 'sinon';
import app from '../../../src/routes';
import { expect } from 'chai';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { randomHex, resetDatabase, testCoin } from '../../helpers';
import { ChainStateProvider } from '../../../src/providers/chain-state';
import { WalletStorage } from '../../../src/models/wallet';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { TransactionStorage } from '../../../src/models/transaction';
import { BitcoinBlockStorage } from '../../../src/models/block';
import { MongoBound } from '../../../src/models/base';
import { WalletAddressStorage } from '../../../src/models/walletAddress';

const { PrivateKey, PublicKey, Address, crypto } = require('bitcore-lib');
const secp256k1 = require('secp256k1');

const request = supertest(app);

const privKey = new PrivateKey();
const pubKey = PublicKey(privKey);

const address = Address(PrivateKey().toPublicKey(), 'regtest').toString();
const address2 = Address(PrivateKey().toPublicKey(), 'regtest').toString();

const bwsPrivKey = new PrivateKey('3711033b85a260d21cd469e7d93e27f04c31c21f13001053f1c074f7abbe6e75');

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

function getSignature(privateKey, method: 'GET' | 'POST' | 'reprocess', url: string, body={}) {
  const message = [method, url, JSON.stringify(body)].join('|');
  const messageHash = crypto.Hash.sha256sha256(Buffer.from(message));
  return Buffer.from(secp256k1.ecdsaSign(messageHash, privateKey.toBuffer()).signature).toString('hex');
}

async function addTransaction(params: { 
  senderAddress: string | 'coinbase', 
  recieverAddress: string,
  amount: number,
  fee?: number
 }): Promise<boolean> {
  const { senderAddress, recieverAddress, amount, fee = 0 } = params;
  const chain = 'BTC';
  const network = 'regtest';
  const txid = randomHex(64);
  const inputs: MongoBound<ICoin>[] = [];
  let inputsTotalValue = 0;
  // in the case of coins there are no input coins but the input count needs to be 1
  let inputCount;
  let outputCount = 2;
  const coinbase = senderAddress === 'coinbase';

  const tip = await BitcoinBlockStorage.getLocalTip({ chain, network });
  expect(tip, 'addTransaction assumes block exists to add transactions to').to.exist;
  if (!tip) {
    return false;
  }

  if (coinbase) {
    inputsTotalValue = amount;
    inputCount = 1;

    // insert coinbase utxos
    await CoinStorage.collection.insertMany([
      {
        chain: chain,
        network: network, 
        mintTxid: txid,
        mintIndex: 0,
        coinbase: true,
        mintHeight: tip.height,
        value: amount,
        spentHeight: -2,
        spentTxid: '',
        address: recieverAddress,
        wallets: [],
        script: Buffer.from('aiSqIant4vYcP3HR3v0/qZnfo2lTdVxpBol5mWK0i+vYNpdOjPk='),
      },
      {
        chain: chain,
        network: network, 
        mintTxid: txid,
        mintIndex: 1,
        coinbase: true,
        mintHeight: tip.height,
        value: 0,
        spentHeight: -2,
        spentTxid: '',
        address: 'false',
        wallets: [],
        script: Buffer.from('ABQUkj119YtLFcslg+FddDk3uHkE4g=='),
      }
    ]);
  } else {
    const smallestSufficientUtxo: MongoBound<ICoin> | null = await CoinStorage.collection.findOne(
      {
        address: senderAddress, 
        spentHeight: -2, 
        value: { $gte: amount }
      }, 
      { sort: { value: -1 }}
    );

    if (smallestSufficientUtxo) {
      inputs.push(smallestSufficientUtxo);
    } else {
      const utxos: MongoBound<ICoin>[] = [...await CoinStorage.collection
        .find({ chain, network, address: senderAddress })
        .sort({ value: 1 })
        .toArray()
      ];
      do {
        const utxo: MongoBound<ICoin> | undefined = utxos.pop();
        if (utxo) {
          inputs.push(utxo);
        } else {
          return false; // insufficient funds, transaction creation failed
        }
      } while (inputsTotalValue < amount);
    }

    inputCount = inputs.length;
    for (const input of inputs) {
      inputsTotalValue += input.value;
    }

    // update spent utxos, prevents future usage
    await CoinStorage.collection.bulkWrite(
      inputs.map(({ _id }) => {
        return {
          updateOne: {
            filter: { chain, network, _id },
            update: { $set: { spentTxid: txid, spentHeight: tip.height }}
          }
        }
      })
    );

    // add new utxos
    await CoinStorage.collection.insertMany([
      {
        chain: chain,
        network: network, 
        mintTxid: txid,
        mintIndex: 0,
        coinbase: false,
        mintHeight: tip.height,
        value: amount,
        spentHeight: -2,
        spentTxid: '',
        address: recieverAddress,
        wallets: [],
        script: Buffer.from('ABT2FdLqYRcZotGH4hBg/uUcL0lwUA=='),
      },
      {
        chain: chain,
        network: network, 
        mintTxid: txid,
        mintIndex: 1,
        coinbase: false,
        mintHeight: tip.height,
        value: inputsTotalValue - amount - fee,
        spentHeight: -2,
        spentTxid: '',
        address: senderAddress,
        wallets: [],
        script: Buffer.from('ABT2FdLqYRcZotGH4hBg/uUcL0lwUA=='),
      }
    ]);
  }

  // add new transaction
  await TransactionStorage.collection.insertOne({
    txid: txid,
    chain: chain,
    network: network,
    blockHash: tip.hash,
    blockTime: tip.time,
    blockHeight: tip.height,
    blockTimeNormalized: tip.timeNormalized,
    fee,
    value: inputsTotalValue - fee,
    coinbase,
    inputCount,
    outputCount,
    wallets: [],
    locktime: 0,
    size: 100
  });

  // add transaction to block transaction count
  await BitcoinBlockStorage.collection.updateOne(
    { height: tip.height },
    { $inc: { totalTransactions: 1 } }
  );
  return true;
}

async function addBlock() {
  const chain = 'BTC';
  const network = 'regtest';
  const tip = await BitcoinBlockStorage.getLocalTip({ chain, network });

  const hash = randomHex(64);
  const time = new Date('2025-07-07T17:16:38.002Z');
  await BitcoinBlockStorage.collection.insertOne({
    network: 'regtest',
    chain: chain,
    hash: hash,
    bits: 545259519,
    height: tip ? tip.height + 1 : 0,
    merkleRoot: '760a46b4f94ab17350a3ed299546fb5648c025ad9bd22271be38cf075c9cf3f4',
    nextBlockHash: '',
    nonce: 0,
    previousBlockHash: (tip) ? tip.hash : '0000000000000000000000000000000000000000000000000000000000000000',
    processed: true,
    reward: 1250000000,
    size: 214,
    time: time,
    timeNormalized: time,
    transactionCount: 0,
    version: 805306368
  });

  if (tip) {
    await BitcoinBlockStorage.collection.updateOne({ hash: tip.hash }, { $set: { nextBlockHash: hash } })
  }
}

describe('Wallet Routes', function() {
  let sandbox;

  before(async function() {
    this.timeout(15000);
    await intBeforeHelper();
    await resetDatabase();
    await addBlock();
    await addTransaction({ senderAddress: 'coinbase', recieverAddress: address, amount: 500_000 });
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

  const updateWallet = async (params: { privKey, pubKey, address }) => {
    const { privKey, pubKey, address } = params;

    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}`;
    const body = [{ address: address }];
    const chainStateUpdateWalletSpy = sandbox.spy(ChainStateProvider, 'updateWallet');
    const walletAddressStorageUpdateCoinsSpy = sandbox.spy(WalletAddressStorage, 'updateCoins');

    await request.post(url)
      .set('x-signature', getSignature(privKey, 'POST', url, body))
      .send(body);
    expect(chainStateUpdateWalletSpy.calledOnce).to.be.true;
    expect(walletAddressStorageUpdateCoinsSpy.calledOnce).to.be.true;
  }

  it('should have empty wallets db at start', done => {
    WalletStorage.collection.findOne({}).then(doc => {
      expect(doc).to.be.null;
      done();
    }).catch(done);
  });

  it('should not have wallet before it is created', done => {
    const spy = sandbox.spy(ChainStateProvider, 'createWallet');
    request.get(`/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}`)
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

  it('should check wallet before it exists', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/check`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url, {}))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { lastAddress, sum } = res.body;
        expect(sum).to.equal(0)
        expect(lastAddress).to.be.undefined;
        done();
      });
  });

  it('should update wallet', done => {
    updateWallet({ privKey, pubKey, address }).then(done);
  });

  it('should get address after update', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/addresses`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url, {}))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(res.body).to.deep.include({ address: address });
        done();
      });
  });

  it('should check wallet', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/check`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url, {}))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { lastAddress, sum } = res.body;
        expect(lastAddress).to.equal(address);

        const expectedSum = Buffer.from(address).reduce((tot, cur) => (tot + cur) % Number.MAX_SAFE_INTEGER);
        expect(sum).to.equal(expectedSum);
        expect(sum).to.be.greaterThan(0);
        done();
      });
  });

  {
    let balance1;
    it('should get new wallet balance', done => {
      const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/balance`;
      request.get(url)
        .set('x-signature', getSignature(privKey, 'GET', url, {}))
        .expect(200, async (err, res) => {
          if (err) console.error(err);
          const { confirmed, unconfirmed, balance } = res.body;
          expect(confirmed).to.be.greaterThan(0);
          expect(unconfirmed).to.equal(0);
          expect(balance).to.greaterThan(0);
          balance1 = balance;
          done();
        });
    });

    it('should get wallet added utxos', done => {
      const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/utxos`;
      request.get(url)
        .set('x-signature', getSignature(privKey, 'GET', url, {}))
        .expect(200, (err, res) => {
          if (err) console.error(err);
          let balance = 0;
          for (const utxo of res.body) {
            expect(utxo.chain).to.equal('BTC');
            expect(utxo.network).to.equal('regtest');
            balance += utxo.value;
            testCoin(utxo);
          }
          expect(balance).to.equal(balance1);
          done();
        });
    });

    it('should handle block updating (1/4): adding block and transactions directly to mongodb', done => {
      const amount = 10_000;
      const fee = 100;
      addBlock()
        .then(async () => {
          await addTransaction({ senderAddress: address, recieverAddress: address2, amount, fee })
          done()
        });
    });

    it('should handle block updating (2/4): updating and reprocessing address via api', done => {
      const url = `/api/BTC/regtest/wallet/${pubKey}`
      const body = [{ address: address }];

      request.post(url)
        .set('x-signature', getSignature(privKey, 'POST', url, body))
        .set('x-reprocess', getSignature(bwsPrivKey, 'reprocess', '/addAddresses' + pubKey, body))
        .send(body)
        .expect(200, done);
    });

    it('should handle block updating (3/4): get blocks utxos', done => {
      const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/utxos`;
      request.get(url)
        .set('x-signature', getSignature(privKey, 'GET', url, {}))
        .expect(200, (err, res) => {
          if (err) console.error(err);
          let balance = 0;
          for (const utxo of res.body) {
            expect(utxo.chain).to.equal('BTC');
            expect(utxo.network).to.equal('regtest');
            balance += utxo.value;
            testCoin(utxo);
          }
          done();
        });
    });

    it('should handle block updating (4/4): get balance', done => {
      const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/balance`;
      const amount = 10_000;
      const fee = 100;
      request.get(url)
        .set('x-signature', getSignature(privKey, 'GET', url, {}))
        .expect(200, (err, res) => {
          if (err) console.error(err);
          const { confirmed, unconfirmed, balance } = res.body;
          expect(balance1 - balance).to.equal(amount + fee);
          expect(balance1 - confirmed).to.equal(amount + fee);
          expect(unconfirmed).to.be.at.least(0);
          done();
        });
    });
  };

  it('should get address after update and reprocess', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/addresses`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url, {}))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(res.body).to.deep.include({ address: address });
        done();
      });
  });

  it('should check wallet after update and reprocess', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/check`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url, {}))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { lastAddress, sum } = res.body;
        expect(lastAddress).to.equal(address);

        const expectedSum = Buffer.from(address).reduce((tot, cur) => (tot + cur) % Number.MAX_SAFE_INTEGER);
        expect(sum).to.equal(expectedSum);
        expect(sum).to.be.greaterThan(0);
        done();
      });
  });
});