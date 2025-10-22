import supertest from 'supertest';
import sinon from 'sinon';
import app from '../../../src/routes';
import { expect } from 'chai';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';
import { base58Regex, minutesAgo, mongoIdRegex, randomHex, resetDatabase, testCoin } from '../../helpers';
import { ChainStateProvider } from '../../../src/providers/chain-state';
import { WalletStorage } from '../../../src/models/wallet';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { TransactionStorage } from '../../../src/models/transaction';
import { BitcoinBlockStorage } from '../../../src/models/block';
import { MongoBound } from '../../../src/models/base';
import { WalletAddressStorage } from '../../../src/models/walletAddress';

import { BitcoreLib } from 'crypto-wallet-core';
import secp256k1 from 'secp256k1';

const { PrivateKey, PublicKey, Address, crypto } = BitcoreLib;
const request = supertest(app);

const privKey = new PrivateKey();
const pubKey = new PublicKey(privKey);

const address = new Address(new PrivateKey().toPublicKey(), 'regtest').toString();
const missingAddress1 = new Address(new PrivateKey().toPublicKey(), 'regtest').toString();
const missingAddress2 = new Address(new PrivateKey().toPublicKey(), 'regtest').toString();
const address2 = new Address(new PrivateKey().toPublicKey(), 'regtest').toString();

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

function testWalletTransaction(tx) {
  expect(tx).to.be.an('object');
  expect(tx).to.have.property('id').that.is.a('string').with.length.greaterThan(0);
  expect(tx.id).to.match(mongoIdRegex);

  expect(tx).to.have.property('txid').that.is.a('string').with.length(64);
  expect(tx.txid).to.match(/^[a-f0-9]{64}$/);

  expect(tx).to.have.property('fee').that.is.a('number');
  expect(tx).to.have.property('size').that.is.a('number').and.to.be.greaterThan(0);

  expect(tx).to.have.property('category').that.is.a('string');
  expect(['receive', 'send', 'move']).to.include(tx.category);

  expect(tx).to.have.property('satoshis').that.is.a('number');
  if (tx.category === 'receive') {
    expect(tx.satoshis).to.be.at.least(0);
  } else {
    expect(tx.satoshis).to.be.at.most(0);
  }

  expect(tx).to.have.property('height').that.is.a('number').and.to.be.at.least(0);

  expect(tx).to.have.property('address').that.is.a('string').with.length.greaterThan(0);
  expect(tx.address).to.match(base58Regex);

  expect(tx).to.have.property('outputIndex').that.is.a('number').and.to.be.at.least(0);
}

function getSignature(privateKey, method: 'GET' | 'POST' | 'reprocess', url: string, body={}) {
  const message = [method, url, JSON.stringify(body)].join('|');
  const messageHash = crypto.Hash.sha256sha256(Buffer.from(message));
  return Buffer.from(secp256k1.ecdsaSign(messageHash, privateKey.toBuffer()).signature).toString('hex');
}
async function addTransaction(params: {
  senderAddress: string,
  recieverAddress: string,
  value: number,
  fee?: number
}) {
  const { senderAddress, recieverAddress, value, fee=0 } = params;
  await addMultiIOTransaction({ senderAddresses: [senderAddress], recipients: [{ address: recieverAddress, value }], fee });
}
async function addMultiIOTransaction(params: { 
  senderAddresses: string[] | 'coinbase', 
  recipients: { address: string, value: number }[],
  fee?: number
 }) {
  const { senderAddresses, recipients, fee = 0 } = params;
  const chain = 'BTC';
  const network = 'regtest';
  const txid = randomHex(64);
  const inputs: MongoBound<ICoin>[] = [];
  let inputsTotalValue = 0;
  // in the case of coins there are no input coins but the input count needs to be 1
  let inputCount;
  const outputCount = 2;
  const coinbase = senderAddresses === 'coinbase' || senderAddresses[0] === 'coinbase';

  const tip = await BitcoinBlockStorage.getLocalTip({ chain, network });
  expect(tip, 'addTransaction assumes block exists to add transactions to').to.exist;
  if (!tip) {
    return;
  }

  if (coinbase) {
    inputCount = 1;
    inputsTotalValue = recipients[0].value;

    // insert coinbase utxos
    await CoinStorage.collection.insertMany([
      {
        chain: chain,
        network: network, 
        mintTxid: txid,
        mintIndex: 0,
        coinbase: true,
        mintHeight: tip.height,
        value: recipients[0].value,
        spentHeight: -2,
        spentTxid: '',
        address: recipients[0].address,
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
    let totalValueSent = 0;
    for (const recipient of recipients) {
      totalValueSent += recipient.value;
    }
    let changeAddress;
    for (const senderAddress of senderAddresses) {
      const remainingValue = totalValueSent - inputsTotalValue;
      const smallestSufficientUtxo: MongoBound<ICoin> | null = await CoinStorage.collection.findOne(
        {
          address: senderAddress, 
          spentHeight: -2, 
          value: { $gte: remainingValue }
        }, 
        { sort: { value: 1 } }
      );
      
      if (smallestSufficientUtxo) {
        inputs.push(smallestSufficientUtxo);
        inputCount++;
        inputsTotalValue += smallestSufficientUtxo.value;
      } else {
        const utxos: MongoBound<ICoin>[] = [...await CoinStorage.collection
          .find({ chain, network, address: senderAddress, spentHeight: -2 })
          .sort({ value: 1 })
          .toArray()];
        
        do {
          const utxo: MongoBound<ICoin> | undefined = utxos.pop();
          if (utxo) {
            inputs.push(utxo);
            inputsTotalValue += utxo.value;
            inputCount++;
          } else {
            break;
          }
        } while (inputsTotalValue < totalValueSent);
      }
      if (inputsTotalValue >= totalValueSent + fee) {
        changeAddress = senderAddress;
        break;
      }
    }
    expect(inputsTotalValue, 'Not enough funds to create transaction').to.be.at.least(totalValueSent + fee);

    // update spent utxos, prevents future usage
    await CoinStorage.collection.bulkWrite(
      inputs.map(({ _id }) => {
        return {
          updateOne: {
            filter: { chain, network, _id },
            update: { $set: { spentTxid: txid, spentHeight: tip.height } }
          }
        };
      })
    );

    // add new utxos
    await CoinStorage.collection.insertMany([
      // utxos for every recipient
      ...recipients.map(recipient => ({
        chain: chain,
        network: network,
        mintTxid: txid,
        mintIndex: 0,
        coinbase: false,
        mintHeight: tip.height,
        value: recipient.value,
        spentHeight: -2,
        spentTxid: '',
        address: recipient.address,
        wallets: [],
        script: Buffer.from('ABT2FdLqYRcZotGH4hBg/uUcL0lwUA=='),
      })
      ),
      // change utxo
      {
        chain: chain,
        network: network,
        mintTxid: txid,
        mintIndex: 1,
        coinbase: false,
        mintHeight: tip.height,
        value: inputsTotalValue - totalValueSent - fee,
        spentHeight: -2,
        spentTxid: '',
        address: changeAddress,
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
}

async function addBlock(params?: {
  time?: Date
}) {
  let { time } = params || {};
  const chain = 'BTC';
  const network = 'regtest';
  const tip = await BitcoinBlockStorage.getLocalTip({ chain, network });
  const hash = randomHex(64);
  if (!time)
    time = tip ? new Date(tip.time.getTime() + 1000 * 60 * 10) : new Date();
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
    await BitcoinBlockStorage.collection.updateOne({ hash: tip.hash }, { $set: { nextBlockHash: hash } });
  }
}

describe('Wallet Routes', function() {
  let sandbox;
  const firstBlockTime = minutesAgo(60);
  const addressBalanceAtFirstBlock = 500_000;
  const missingValue1 = 400_000;
  const addressBalanceAtSecondBlock = addressBalanceAtFirstBlock + 500_000 - missingValue1;

  before(async function() {
    this.timeout(15000);
    await intBeforeHelper();
    await resetDatabase();
    await addBlock({ time: firstBlockTime });
    await addTransaction({ senderAddress: 'coinbase', recieverAddress: address, value: addressBalanceAtFirstBlock });
    await addBlock();
    await addTransaction({ senderAddress: 'coinbase', recieverAddress: address, value: 500_000 });
    for (let i = 0; i < 3; i++) {
      await addTransaction({ senderAddress: address, recieverAddress: missingAddress1, value: missingValue1 / 4 });
    }
    await addTransaction({ senderAddress: address, recieverAddress: missingAddress2, value: missingValue1 / 4 });
    await addBlock();
    await addTransaction({ senderAddress: 'coinbase', recieverAddress: address, value: 100_000 });
    await addMultiIOTransaction({ senderAddresses: [missingAddress1, missingAddress2, address], recipients: [{ address: address2, value: 500_000 }] });
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
  };

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
      .set('x-signature', getSignature(privKey, 'GET', url))
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
      .set('x-signature', getSignature(privKey, 'GET', url))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(res.body).to.deep.equal([]);
        done();
      });
  }); 

  it('should check wallet before it exists', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/check`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { lastAddress, sum } = res.body;
        expect(sum).to.equal(0);
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
      .set('x-signature', getSignature(privKey, 'GET', url))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(res.body).to.deep.include({ address: address });
        done();
      });
  });

  it('should check wallet', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/check`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url))
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

  it('should get wallet', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        testWalletEquivalence(wallet, res.body);
        expect(res.body._id).to.exist.and.to.be.a('string').with.length(24);
        done();
      });
  });

  it('should get new wallet balance before time (first block only)', done => {
    const fiveMinutesAfterFirstBlock = new Date(firstBlockTime.getTime() + 1000 * 60 * 5);
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/balance/${fiveMinutesAfterFirstBlock.toISOString()}`;
    (url);
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { confirmed, unconfirmed, balance } = res.body;
        expect(confirmed).to.be.greaterThan(0).and.to.equal(addressBalanceAtFirstBlock);
        expect(unconfirmed).to.equal(0);
        expect(balance).to.greaterThan(0).and.to.equal(addressBalanceAtFirstBlock);
        done();
      });
  });

  it('should get new wallet balance before time (second block and down)', done => {
    const fiveMinutesAfterSecondBlock = new Date(firstBlockTime.getTime() + 1000 * 60 * 15);
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/balance/${fiveMinutesAfterSecondBlock.toISOString()}`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const { confirmed, unconfirmed, balance } = res.body;
        expect(confirmed).to.be.greaterThan(0).and.to.equal(addressBalanceAtSecondBlock);
        expect(unconfirmed).to.equal(0);
        expect(balance).to.greaterThan(0).and.to.equal(addressBalanceAtSecondBlock);
        done();
      });
  });

  it('should get wallet added transactions', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/transactions`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const transactions = res.text.split('\n').slice(0, -1).map(line => JSON.parse(line));
        for (const tx of transactions) {
          testWalletTransaction(tx);
        }
        done();
      });
  });

  {
    let balance1;
    it('should get new wallet balance', done => {
      const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/balance`;
      request.get(url)
        .set('x-signature', getSignature(privKey, 'GET', url))
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
        .set('x-signature', getSignature(privKey, 'GET', url))
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
      const value = 10_000;
      const fee = 100;
      addBlock()
        .then(async () => {
          await addTransaction({ senderAddress: address, recieverAddress: missingAddress1, value, fee });
          done();
        });
    });

    it('should handle block updating (2/4): updating and reprocessing address via api', done => {
      const url = `/api/BTC/regtest/wallet/${pubKey}`;
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
        .set('x-signature', getSignature(privKey, 'GET', url))
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
      const value = 10_000;
      const fee = 100;
      request.get(url)
        .set('x-signature', getSignature(privKey, 'GET', url))
        .expect(200, (err, res) => {
          if (err) console.error(err);
          const { confirmed, unconfirmed, balance } = res.body;
          expect(balance1 - balance).to.equal(value + fee);
          expect(balance1 - confirmed).to.equal(value + fee);
          expect(unconfirmed).to.be.at.least(0);
          done();
        });
    });
  };

  it('should get address after update and reprocess', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/addresses`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        expect(res.body).to.deep.include({ address: address });
        done();
      });
  });

  it('should check wallet after update and reprocess', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/check`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url))
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

  it('should get wallet missing addresses', done => {
    const url = `/api/${wallet.chain}/${wallet.network}/wallet/${pubKey}/addresses/missing`;
    request.get(url)
      .set('x-signature', getSignature(privKey, 'GET', url))
      .expect(200, (err, res) => {
        if (err) console.error(err);
        const lines = res.text.split('\n').slice(0, -1);
        const data = JSON.parse(lines.at(-1));

        let expectedTotal = 0;
        const expectedMissingAddresses: string[] = [];

        interface MissingAddressCoin { 
          value: number;
          address: string;
          expected: string;
          wallets: [];
          _id: string[];
        };

        const coinData: MissingAddressCoin[] = JSON.parse(lines[0]).missing;
        for (const coin of coinData) {
          expectedTotal += coin.value;
          expect(Address.isValid(coin.address, 'regtest')).to.be.true;
          expect(coin._id).to.match(mongoIdRegex);
          expect(coin.expected).to.match(mongoIdRegex);
          expect(coin.wallets).to.exist.and.to.be.an('array');
          expect(coin.value).to.be.at.least(0);
          expect(coinData.filter(c => c._id === coin._id).length).to.equal(1);
          expectedMissingAddresses.push(coin.address);
        }
        
        const { allMissingAddresses, totalMissingValue } = data;
        expect(allMissingAddresses).to.include(missingAddress1);
        expect(allMissingAddresses).to.include(missingAddress2);
        expect(allMissingAddresses).to.deep.equal(expectedMissingAddresses);
        expect(totalMissingValue).to.equal(expectedTotal);
        expect(totalMissingValue).to.equal(missingValue1);
        done();
      });
  });
});