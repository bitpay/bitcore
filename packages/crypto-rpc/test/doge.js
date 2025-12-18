import sinon from 'sinon';
import assert from 'assert';
import { expect } from 'chai';
import { CryptoRpc } from '../index.js';

const config = {
  chain: 'DOGE',
  host: process.env.HOST_DOGE || 'dogecoin',
  protocol: 'http',
  rpcPort: '22555',
  rpcUser: 'cryptorpc',
  rpcPass: 'local321',
  tokens: {},
  currencyConfig: {
    sendTo: 'n35ckY9BRmmjs9CCFfkaZAjeDpdaY4phRZ',
    unlockPassword: 'password',
    rawTx:
    '01000000018e767be30f1e4a70dcaf2b2374fe26cfbd624d7cb3e6b17244b7100abcf4dbad0000000049483045022100fe9578607f05acd8484dff649afb8efbd3fcf3bce72ac4b1a345a1a22849f805022078a29ba99250a25a8000fd76675167088c2798626c480ac2c6b41fcb4868163601feffffff02004d4158782d00001976a914920f410c5799da55aad17ebf4d360eecf0ba481088ac00f2052a010000001976a914ec880de03abdb41d875ad5290ad59bbf5653fcd488ac53000000'
  }
};

describe('DOGE Tests', function() {
  this.timeout(20000);
  let blockHash = '';
  const currency = 'DOGE';
  const { currencyConfig } = config;
  const rpcs = new CryptoRpc(config, currencyConfig);
  const bitcoin = rpcs.get(currency);

  before(async () => {
    try {
      await bitcoin.asyncCall('encryptWallet', ['password']);
    } catch (e) {
      console.warn('wallet already encrypted');
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
    await bitcoin.asyncCall('generate', [101]);
  });


  it('should be able to get a block hash', async () => {
    blockHash = await rpcs.getBestBlockHash({ currency });
    expect(blockHash).to.have.lengthOf('64');
  });


  it('should convert fee to satoshis per kilobyte with estimateFee', async () => {
    sinon.stub(bitcoin.rpc, 'estimateSmartFee').callsFake((nBlocks, cb) => {
      cb(null, { result: { 'feerate': 0.00001234, 'blocks': 2 } });
    });
    const fee = await bitcoin.estimateFee({ nBlocks: 2 });
    expect(fee).to.be.eq(1.234);
  });

  it('should get block', async () => {
    const reqBlock = await rpcs.getBlock({ currency, hash: blockHash });
    expect(reqBlock).to.have.property('hash');
    expect(reqBlock).to.have.property('confirmations');
    expect(reqBlock).to.have.property('size');
    expect(reqBlock).to.have.property('height');
    expect(reqBlock).to.have.property('version');
    expect(reqBlock).to.have.property('versionHex');
    expect(reqBlock).to.have.property('merkleroot');
    expect(reqBlock).to.have.property('tx');
    expect(reqBlock).to.have.property('time');
    expect(reqBlock).to.have.property('mediantime');
    expect(reqBlock).to.have.property('nonce');
    expect(reqBlock).to.have.property('bits');
    expect(reqBlock).to.have.property('difficulty');
    expect(reqBlock).to.have.property('chainwork');
    expect(reqBlock).to.have.property('previousblockhash');
    assert(reqBlock);
  });

  it('should be able to get a balance', async () => {
    const balance = await rpcs.getBalance({ currency });
    expect(balance).to.eq(2050000000000000);
    assert(balance != undefined);
  });

  it('should be able to send a transaction', async () => {
    const txid = await rpcs.unlockAndSendToAddress({ currency, address: config.currencyConfig.sendTo, amount: '10000', passphrase: currencyConfig.unlockPassword });
    expect(txid).to.have.lengthOf(64);
    assert(txid);
    await bitcoin.asyncCall('generate', [2]);

    it('should get confirmations', async () => {
      const confirmations = await rpcs.getConfirmations({ currency, txid });
      assert(confirmations != undefined);
      expect(confirmations).to.eq(2);
    });


    it('should be able to get a transaction', async () => {
      const tx = await rpcs.getTransaction({ currency, txid });
      expect(tx).to.have.property('txid');
      expect(tx).to.have.property('hash');
      expect(tx).to.have.property('version');
      expect(tx).to.have.property('size');
      expect(tx).to.have.property('locktime');
      expect(tx).to.have.property('vin');
      expect(tx).to.have.property('vout');
      expect(tx).to.have.property('hex');
      assert(tx);
      assert(typeof tx === 'object');
    });
  });

  it('should be able to send many transactions', async () => {
    const payToArray = [];
    const transaction1 = {
      address: 'mzVk8WuGZGvFP6qfrbeAyu7oFFRFaMg5oB',
      amount: 10000
    };
    const transaction2 = {
      address: 'mpqVKMU5iGz9oaGKptgRXhAyyR2WyZFh3a',
      amount: 20000
    };
    const transaction3 = {
      address: 'mnhQ2e7mqsat8wfuhiE96z6JcZDnSBFz3F',
      amount: 30000
    };
    const transaction4 = {
      address: 'mshywUvMRg1oNcAefEaL5UVDqe6NjuoHid',
      amount: 40000
    };
    payToArray.push(transaction1);
    payToArray.push(transaction2);
    payToArray.push(transaction3);
    payToArray.push(transaction4);
    const maxOutputs = 2;
    const maxValue = 1e8;
    const eventEmitter = rpcs.rpcs.DOGE.emitter;
    let eventCounter = 0;
    const emitResults = [];
    const emitPromise = new Promise(resolve => {
      eventEmitter.on('success', (emitData) => {
        eventCounter++;
        emitResults.push(emitData);
        if (eventCounter === 3) {
          resolve();
        }
      });
    });
    const outputArray = await rpcs.unlockAndSendToAddressMany({ payToArray, passphrase: currencyConfig.unlockPassword, time: 1000, maxValue, maxOutputs });
    await emitPromise;
    expect(outputArray).to.have.lengthOf(4);
    expect(outputArray[0].txid).to.equal(outputArray[1].txid);
    expect(outputArray[2].txid).to.equal(outputArray[3].txid);
    expect(outputArray[1].txid).to.not.equal(outputArray[2].txid);
    for (const transaction of outputArray) {
      assert(transaction.txid);
      expect(transaction.txid).to.have.lengthOf(64);
    }
    for (const emitData of emitResults) {
      assert(emitData.address);
      assert(emitData.amount);
      assert(emitData.txid);
      expect(emitData.error === null);
      expect(emitData.vout === 0 || emitData.vout === 1);
      const transactionObj = { address: emitData.address, amount: emitData.amount };
      expect(payToArray.includes(transactionObj));
    }

    await bitcoin.asyncCall('generate', [10]);
  });

  it('should reject when one of many transactions fails', async () => {
    const payToArray = [
      { address: 'mshywUvMRg1oNcAefEaL5UVDqe6NjuoHid',
        amount: 10000
      },
      { address: 'funkyColdMedina',
        amount: 1
      },
    ];
    const eventEmitter = rpcs.rpcs.DOGE.emitter;
    const emitResults = [];
    const emitPromise = new Promise(resolve => {
      eventEmitter.on('failure', (emitData) => {
        emitResults.push(emitData);
        resolve();
      });
    });
    const outputArray = await rpcs.unlockAndSendToAddressMany({
      currency,
      payToArray,
      passphrase: currencyConfig.unlockPassword
    });
    await emitPromise;
    assert(!outputArray[1].txid);
    expect(outputArray[1].error).to.equal(emitResults[0].error);
    expect(emitResults.length).to.equal(1);
    assert(emitResults[0].error);
  });


  it('should be able to decode a raw transaction', async () => {
    const { rawTx } = config.currencyConfig;
    assert(rawTx);
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    expect(decoded).to.have.property('txid');
    expect(decoded).to.have.property('hash');
    expect(decoded).to.have.property('version');
    expect(decoded).to.have.property('size');
    expect(decoded).to.have.property('locktime');
    expect(decoded).to.have.property('vin');
    expect(decoded).to.have.property('vout');
    assert(decoded);
  });

  it('should get the tip', async () => {
    const tip = await rpcs.getTip({ currency });
    assert(tip != undefined);
    expect(tip).to.have.property('hash');
    expect(tip).to.have.property('height');
  });

  it('should validate address', async () => {
    const isValid = await rpcs.validateAddress({ currency, address: config.currencyConfig.sendTo });
    assert(isValid === true);
  });

  it('should not validate bad address', async () => {
    const isValid = await rpcs.validateAddress({ currency, address: 'NOTANADDRESS' });
    assert(isValid === false);
  });

  it('should be able to send a batched transaction', async() => {
    const address1 = 'mrc9MauBwqPGkLP7wckjfPX2Y8ZpWXnGLD';
    const amount1 = 10000;
    const address2 = 'n3NB6EWrMWvGobFL2JE5tThiiM5Eh3yWvT';
    const amount2 = 20000;
    const batch = {};
    batch[address1] = amount1;
    batch[address2] = amount2;

    await bitcoin.walletUnlock({ passphrase: config.currencyConfig.unlockPassword, time: 10 });
    const txid = await bitcoin.sendMany({ batch, options: null });
    await bitcoin.walletLock();
    expect(txid).to.have.lengthOf(64);
    assert(txid);
  });

  it('should be able to get server info', async () => {
    const info = await rpcs.getServerInfo({ currency });
    expect(info).to.have.property('chain');
    expect(info).to.have.property('blocks');
    expect(info).to.have.property('headers');
    expect(info).to.have.property('bestblockhash');
    expect(info).to.have.property('difficulty');
    expect(info).to.have.property('mediantime');
    expect(info).to.have.property('verificationprogress');
    expect(info).to.have.property('initialblockdownload');
    expect(info).to.have.property('chainwork');
    expect(info).to.have.property('pruned');
    expect(info).to.have.property('softforks');
    expect(info).to.have.property('bip9_softforks');
  });
});
