import sinon from 'sinon';
import assert from 'assert';
import { expect } from 'chai';
import { CryptoRpc } from '../index.js';

const config = {
  chain: 'BTC',
  host: process.env.HOST_BTC || 'bitcoin',
  protocol: 'http',
  rpcPort: '8333',
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

describe('BTC Tests', function() {
  this.timeout(10000);
  const currency = 'BTC';
  const { currencyConfig } = config;
  const walletName = 'wallet0';
  const addressLabel = 'abc123';
  let walletAddress = '';
  let rpcs;
  let bitcoin;

  before(async () => {
    rpcs = new CryptoRpc(config, currencyConfig);
    bitcoin = rpcs.get(currency);
    await bitcoin.asyncCall('createwallet', [walletName]);
    walletAddress = await bitcoin.asyncCall('getnewaddress', [addressLabel]);
  });

  it('should determine if wallet is encrypted', async () => {
    expect(await bitcoin.isWalletEncrypted()).to.eq(false);
    try {
      await bitcoin.asyncCall('encryptWallet', ['password']);
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (e) {
      console.warn('wallet already encrypted');
    }
    expect(await bitcoin.isWalletEncrypted()).to.eq(true);
    await bitcoin.asyncCall('generatetoaddress', [101, walletAddress]);
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
    const blockHash = await rpcs.getBestBlockHash({ currency });
    expect(blockHash).to.have.lengthOf('64');
  });

  /* These tests don't work in the pipeline because the docker regtest blockchain isn't mature enough to give a fee */
  // it('should be able to estimateFee', async () => {
  //   const fee = await bitcoin.estimateFee({ nBlocks: 2 });
  //   expect(fee).to.be.gte(1);
  // });

  // it('should be able to estimateFee with mode', async () => {
  //   const fee = await bitcoin.estimateFee({ nBlocks: 2, mode: 'economical' });
  //   expect(fee).to.be.gte(1);
  // });

  it('should convert fee to satoshis per kilobyte with estimateFee', async () => {
    sinon.stub(bitcoin.rpc, 'estimateSmartFee').callsFake((nBlocks, cb) => {
      cb(null, { result: { feerate: 0.00001234, blocks: 2 } });
    });
    const fee = await bitcoin.estimateFee({ nBlocks: 2 });
    expect(fee).to.be.eq(1.234);
  });

  it('should not estimateMaxPriorityFee for non EVM chain', async () => {
    const fee = await rpcs.estimateMaxPriorityFee({ currency, nBlocks: 2 });
    expect(fee).to.be.eq(undefined);
  });

  it('should be able to get a balance', async () => {
    const balance = await rpcs.getBalance({ currency });
    expect(balance).to.eq(5000000000);
    assert(balance != undefined);
  });

  it('should be able to send a transaction', async () => {
    const txid = await rpcs.unlockAndSendToAddress({ currency, address: walletAddress, amount: '10000', passphrase: currencyConfig.unlockPassword });
    expect(txid).to.have.lengthOf(64);
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
    const eventEmitter = rpcs.rpcs.BTC.emitter;
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
  });

  it('should reject when one of many transactions fails', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
      { address: 'funkyColdMedina', amount: 1 }
    ];
    const eventEmitter = rpcs.rpcs.BTC.emitter;
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

  describe('Get Blocks', function() {
    let blockHash;
    before(async () => {
      blockHash = await rpcs.getBestBlockHash({ currency });
      expect(blockHash).to.have.lengthOf('64');
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
  
  });

  describe('Get Transactions', function() {
    let txid;
    before(async () => {
      txid = await rpcs.unlockAndSendToAddress({ currency, address: walletAddress, amount: '10000', passphrase: currencyConfig.unlockPassword });
      expect(txid).to.have.lengthOf(64);
      assert(txid);
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
  
    it('should be able to get a transaction with detail', async() => {
      const tx = await rpcs.getTransaction({ currency, txid, detail: true });
      expect(tx).to.exist;
      expect(tx.txid).to.equal(txid);
      expect(tx.vin[0].address).to.exist;
      expect(tx.vin[0].value).to.exist;
    });

    it('should get confirmations', async () => {
      let confirmations = await rpcs.getConfirmations({ currency, txid });
      assert(confirmations != undefined);
      expect(confirmations).to.eq(0);
      await bitcoin.asyncCall('generatetoaddress', [1, config.currencyConfig.sendTo]);
      confirmations = await rpcs.getConfirmations({ currency, txid });
      expect(confirmations).to.eq(1);
    });
  });

  describe('Get Wallet Transactions', function() {
    let txs;

    describe('Unloaded wallet', function() {
      before(async () => {
        await bitcoin.asyncCall('unloadwallet', [walletName]);
      });
      after(async () => {
        await bitcoin.asyncCall('loadwallet', [walletName]);
      });

      it('should error if no wallet is loaded', async () => {
        try {
          await rpcs.getTransactions({ currency });
          throw new Error('should have thrown');
        } catch (e) {
          expect(e.message).to.include('No wallet is loaded');
        }
      });
    });

    it('should return wallet transactions', async () => {
      txs = await rpcs.getTransactions({ currency });
      expect(txs).to.have.lengthOf(10);
    });

    it('should return wallet transactions with count and skip', async () => {
      const _txs = await rpcs.getTransactions({ currency, count: 2, skip: 3 });
      expect(_txs).to.have.lengthOf(2);
      // txs are ordered in ascending order, so latest are at the bottom.
      expect(_txs[1].txid).to.equal(txs.slice(-3)[0].txid);
    });

    it('should return wallet transactions by label', async () => {
      const _txs = await rpcs.getTransactions({ currency, label: addressLabel });
      expect(_txs).to.have.lengthOf(10);
      expect(_txs.every(t => t.label === addressLabel)).to.equal(true);
      expect(_txs[0].txid).to.not.equal(txs[0].txid); // makes sure it's not just returning the same array
    });

  });

  describe('Tx outputs', function() {
    let txid;
    before(async () => {
      txid = await rpcs.unlockAndSendToAddress({ currency, address: config.currencyConfig.sendTo, amount: '10000', passphrase: currencyConfig.unlockPassword });
      expect(txid).to.have.lengthOf(64);
      assert(txid);
    });
    it('should get tx output info from mempool', async() => {
      const output1 = await rpcs.getTxOutputInfo({ currency, txid, vout: 0, includeMempool: true });
      const output2 = await rpcs.getTxOutputInfo({ currency, txid, vout: 1, includeMempool: true });
      const output = [output1, output2].find(v => v.value === 0.0001);
      expect(output).to.exist;
      expect(output.scriptPubKey.address).to.equal(config.currencyConfig.sendTo);
    });

    it('should fail to get tx output when not in mempool', async() => {
      let output = null;
      try {
        output = await rpcs.getTxOutputInfo({ currency, txid, vout: 0, includeMempool: false });
      } catch (e) {
        expect(e.message).to.include('No info found for');
      }
      expect(output).to.be.null;
    });
    
    describe('Tx output after confirmation', function() {
      before(async () => {
        let confirmations = await rpcs.getConfirmations({ currency, txid });
        assert(confirmations != undefined);
        expect(confirmations).to.eq(0);
        await bitcoin.asyncCall('generatetoaddress', [1, config.currencyConfig.sendTo]);
        confirmations = await rpcs.getConfirmations({ currency, txid });
        expect(confirmations).to.eq(1);
      });

      it('should get tx output info', async() => {
        const output1 = await rpcs.getTxOutputInfo({ currency, txid, vout: 0 });
        const output2 = await rpcs.getTxOutputInfo({ currency, txid, vout: 1 });
        const output = [output1, output2].find(v => v.value === 0.0001);
        expect(output).to.exist;
        expect(output.scriptPubKey.address).to.equal(config.currencyConfig.sendTo);
      });
    
      it('should get tx output info for bitcore', async() => {
        const output1 = await rpcs.getTxOutputInfo({ currency, txid, vout: 0, transformToBitcore: true });
        const output2 = await rpcs.getTxOutputInfo({ currency, txid, vout: 1, transformToBitcore: true });
        const output = [output1, output2].find(v => v.value === 0.0001);
        expect(output).to.exist;
        expect(output.address).to.equal(config.currencyConfig.sendTo);
        expect(output.mintTxid).to.equal(txid);
      });
    });
  });

  it('should be able to get server info', async () => {
    const info = await rpcs.getServerInfo({ currency });
    expect(info).to.have.property('chain');
    expect(info).to.have.property('blocks');
    expect(info).to.have.property('headers');
    expect(info).to.have.property('bestblockhash');
    expect(info).to.have.property('difficulty');
    // expect(info).to.have.property('time'); // TODO this is added in newer bitcoin core version
    expect(info).to.have.property('mediantime');
    expect(info).to.have.property('verificationprogress');
    expect(info).to.have.property('initialblockdownload');
    expect(info).to.have.property('chainwork');
    // expect(info).to.have.property('size_on_disk'); // TODO this is added in newer bitcoin core version
    expect(info).to.have.property('pruned');
    expect(info).to.have.property('warnings');
  });
});
