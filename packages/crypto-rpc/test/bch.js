import sinon from 'sinon';
import assert from 'assert';
import { expect } from 'chai';
import { CryptoRpc } from '../index.js';

const config = {
  chain: 'BCH',
  host: process.env.HOST_BCH || 'bitcoin-cash',
  protocol: 'http',
  rpcPort: '9333',
  rpcUser: 'cryptorpc',
  rpcPass: 'local321',
  tokens: {},
  currencyConfig: {
    sendTo: 'bchreg:qq9kqhzxeul20r7nsl2lrwh8d5kw97np9u960ue086',
    unlockPassword: 'password',
    rawTx:
    '0200000001445703d7470ec3e435db0f33da332fc654ae0c8d264572e487bd427125659d7500000000484730440220704a6a336eb930a95b2a6a941b3c43ccb2207db803a2332512ac255c1740b9d7022057c7bc00a188de7f4868774d1e9ff626f8bd6eca8187763b9cb184354ddc5dde41feffffff0200021024010000001976a914db1f764e6a60e4a8cb919c55e95ac41517f5cddc88ac00e1f505000000001976a9140b605c46cf3ea78fd387d5f1bae76d2ce2fa612f88ac66000000'
  }
};

describe('BCH Tests', function() {
  this.timeout(30000);
  const currency = 'BCH';
  const { currencyConfig } = config;
  let blockHash = '';
  let rpcs;
  let bitcoin;

  before(async function() {
    this.timeout(60000);
    rpcs = new CryptoRpc(config, currencyConfig);
    bitcoin = rpcs.get(currency);
    try {
      await bitcoin.asyncCall('encryptWallet', ['password']);
    } catch (e) {
      console.warn('wallet already encrypted');
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    await bitcoin.asyncCall('generate', [101]);
  });


  it('should be able to get a block hash', async () => {
    blockHash = await rpcs.getBestBlockHash({ currency });
    expect(blockHash).to.have.lengthOf('64');
  });


  it('should convert fee to satoshis per kilobyte with estimateFee', async () => {
    sinon.stub(bitcoin.rpc, 'estimateFee').callsFake((cb) => {
      cb(null, { result: 0.00001234 });
    });
    const fee = await bitcoin.estimateFee();
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
    expect(balance).to.eq(5000000000);
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
      address: 'bchreg:qrmap3fwpufpzk8j936aetfupppezngfeut6kqqds6',
      amount: 10000
    };
    const transaction2 = {
      address: 'bchreg:qpmrahuqhpmq4se34zx4lt9lp3l5j4t4ggzf98lk8v',
      amount: 20000
    };
    const transaction3 = {
      address: 'qz07vf90w70s8d0pfx9qygxxlpgr2vwz65d53p22cr',
      amount: 30000
    };
    const transaction4 = {
      address: 'qzp2lmc7m49du2n55qmyattncf404vmgnq8gr53aj7',
      amount: 40000
    };
    payToArray.push(transaction1);
    payToArray.push(transaction2);
    payToArray.push(transaction3);
    payToArray.push(transaction4);
    const maxOutputs = 2;
    const maxValue = 1e8;
    const eventEmitter = rpcs.rpcs.BCH.emitter;
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
    const outputArray = await rpcs.unlockAndSendToAddressMany({ currency, payToArray, passphrase: currencyConfig.unlockPassword, time: 1000, maxValue, maxOutputs });
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
      { address: 'bchreg:qrmap3fwpufpzk8j936aetfupppezngfeut6kqqds6',
        amount: 10000
      },
      { address: 'funkyColdMedina',
        amount: 1
      },
    ];
    const eventEmitter = rpcs.rpcs.BCH.emitter;
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
    const address1 = 'bchreg:qq2lqjaeut5ppjkx9339htfed8enx7hmugk37ytwqy';
    const amount1 = 10000;
    const address2 = 'bchreg:qq6n0n37mut4353m9k2zm5nh0pejk7vh7u77tan544';
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
    // expect(info).to.have.property('time');
    expect(info).to.have.property('mediantime');
    expect(info).to.have.property('verificationprogress');
    expect(info).to.have.property('initialblockdownload');
    expect(info).to.have.property('chainwork');
    expect(info).to.have.property('size_on_disk');
    expect(info).to.have.property('pruned');
    expect(info).to.have.property('warnings');
  });
});
