import assert from 'assert';
import sinon from 'sinon';
import { expect } from 'chai';
import { CryptoRpc } from '../index.js';

const config = {
  chain: 'LTC',
  host: process.env.HOST_LTC || 'litecoin',
  protocol: 'http',
  rpcPort: '10333',
  rpcUser: 'cryptorpc',
  rpcPass: 'local321',
  tokens: {},
  currencyConfig: {
    sendTo: '2NGFWyW3LBPr6StDuDSNFzQF3Jouuup1rua',
    unlockPassword: 'password',
    rawTx:
      '0100000001641ba2d21efa8db1a08c0072663adf4c4bc3be9ee5aabb530b2d4080b8a41cca000000006a4730440220062105df71eb10b5ead104826e388303a59d5d3d134af73cdf0d5e685650f95c0220188c8a966a2d586430d84aa7624152a556550c3243baad5415c92767dcad257f0121037aaa54736c5ffa13132e8ca821be16ce4034ae79472053dde5aa4347034bc0a2ffffffff0240787d010000000017a914c8241f574dfade4d446ec90cc0e534cb120b45e387eada4f1c000000001976a9141576306b9cc227279b2a6c95c2b017bb22b0421f88ac00000000'
  }
};

describe('LTC Tests', function() {
  this.timeout(10000);
  let txid = '';
  let blockHash = '';
  const currency = 'LTC';
  const { currencyConfig } = config;
  const rpcs = new CryptoRpc(config, currencyConfig);
  const bitcoin = rpcs.get(currency);

  it('should determine if wallet is encrypted', async () => {
    expect(await bitcoin.isWalletEncrypted()).to.eq(false);
    try {
      await bitcoin.asyncCall('encryptWallet', ['password']);
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (e) {
      console.warn('wallet already encrypted');
    }
    expect(await bitcoin.isWalletEncrypted()).to.eq(true);
    await bitcoin.asyncCall('generate', [101]);
  });

  it('walletUnlock should unlock wallet successfully', async () => {
    await bitcoin.walletUnlock({ passphrase: config.currencyConfig.unlockPassword, time: 10 });
  });

  it('walletUnlock should error on if wrong args', async () => {
    await bitcoin.walletUnlock({ passphrase: config.currencyConfig.unlockPassword })
      .catch(err => {
        assert(err);
        expect(typeof err).to.eq('object');
        expect(err).to.have.property('message');
        expect(err.message).to.eq('JSON value is not an integer as expected');
      });
  });

  it('walletUnlock should error on if wrong passphrase', async () => {
    await bitcoin.walletUnlock({ passphrase: 'wrong', time: 10 })
      .catch(err => {
        assert(err);
        expect(typeof err).to.eq('object');
        expect(err).to.have.property('message');
        expect(err.message).to.eq('Error: The wallet passphrase entered was incorrect.');
      });
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
    expect(reqBlock).to.have.property('strippedsize');
    expect(reqBlock).to.have.property('size');
    expect(reqBlock).to.have.property('weight');
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
    expect(reqBlock).to.have.property('nTx');
    expect(reqBlock).to.have.property('previousblockhash');
    assert(reqBlock);
  });

  it('should be able to get a balance', async () => {
    const balance = await rpcs.getBalance({ currency });
    expect(balance).to.eq(5000000000);
    assert(balance != undefined);
  });

  it('should be able to send a transaction', async () => {
    txid = await rpcs.unlockAndSendToAddress({ currency, address: config.currencyConfig.sendTo, amount: '10000', passphrase: currencyConfig.unlockPassword });
    expect(txid).to.have.lengthOf(64);
    assert(txid);
  });

  it('should be able to send many transactions', async () => {
    const payToArray = [];
    const transaction1 = {
      address: 'mm7mGjBBe1sUF8SFXCW779DX8XrmpReBTg',
      amount: 10000
    };
    const transaction2 = {
      address: 'mm7mGjBBe1sUF8SFXCW779DX8XrmpReBTg',
      amount: 20000
    };
    const transaction3 = {
      address: 'mgoVRuvgbgyZL8iQWfS6TLPZzQnpRMHg5H',
      amount: 30000
    };
    const transaction4 = {
      address: 'mv5XmsNbK2deMDhkVq5M28BAD14hvpQ9b2',
      amount: 40000
    };
    payToArray.push(transaction1);
    payToArray.push(transaction2);
    payToArray.push(transaction3);
    payToArray.push(transaction4);
    const maxOutputs = 2;
    const maxValue = 1e8;
    const eventEmitter = rpcs.rpcs.LTC.emitter;
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
  });

  it('should reject when one of many transactions fails', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
      { address: 'funkyColdMedina', amount: 1 }
    ];
    const eventEmitter = rpcs.rpcs.LTC.emitter;
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

  it('should be able to get a transaction', async () => {
    const tx = await rpcs.getTransaction({ currency, txid });
    expect(tx).to.have.property('txid');
    expect(tx).to.have.property('hash');
    expect(tx).to.have.property('version');
    expect(tx).to.have.property('size');
    expect(tx).to.have.property('vsize');
    expect(tx).to.have.property('locktime');
    expect(tx).to.have.property('vin');
    expect(tx).to.have.property('vout');
    expect(tx).to.have.property('hex');
    assert(tx);
    assert(typeof tx === 'object');
  });

  it('should be able to decode a raw transaction', async () => {
    const { rawTx } = config.currencyConfig;
    assert(rawTx);
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    expect(decoded).to.have.property('txid');
    expect(decoded).to.have.property('hash');
    expect(decoded).to.have.property('version');
    expect(decoded).to.have.property('size');
    expect(decoded).to.have.property('vsize');
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

  it('should get confirmations', async () => {
    let confirmations = await rpcs.getConfirmations({ currency, txid });
    assert(confirmations != undefined);
    expect(confirmations).to.eq(0);
    await bitcoin.asyncCall('generate', [1]);
    confirmations = await rpcs.getConfirmations({ currency, txid });
    expect(confirmations).to.eq(1);
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
    const address1 = 'mtXWDB6k5yC5v7TcwKZHB89SUp85yCKshy';
    const amount1 = '10000';
    const address2 = 'msngvArStqsSqmkG7W7Fc9jotPcURyLyYu';
    const amount2 = '20000';
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
