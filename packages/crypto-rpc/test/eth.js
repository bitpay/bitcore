import sinon from 'sinon';
import { assert, expect } from 'chai';
import * as ethers from 'ethers';
import * as util from 'web3-utils';
import { CryptoRpc } from '../index.js';

const config = {
  chain: 'ETH',
  host: process.env.HOST_ETH || 'geth',
  protocol: 'http',
  port: '8545',
  rpcPort: '8545',
  account: '0x00a329c0648769A73afAc7F9381E08FB43dBEA72',
  currencyConfig: {
    sendTo: '0xA15035277A973d584b1d6150e93C21152D6Af440',
    unlockPassword: '',
    privateKey:
      '4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7',
    rawTx:
      '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
  }
};

describe.skip('ETH Tests', function() {
  const currency = 'ETH';
  const currencyConfig = config.currencyConfig;
  const rpcs = new CryptoRpc(config, currencyConfig);
  const ethRPC = rpcs.get(currency);
  let txid = '';
  let blockHash = '';

  this.timeout(10000);

  before(done => {
    setTimeout(done, 5000);
  });

  afterEach(async () => {
    sinon.restore();
    await new Promise(r => setTimeout(r, 1000));
  });

  it('should estimate gas price', async () => {
    sinon.spy(ethRPC.web3.eth, 'getBlock');
    sinon.spy(ethRPC.blockGasPriceCache, 'get');
    const gasPrice = await ethRPC.estimateGasPrice();
    expect(gasPrice).to.be.gt(0);
    expect(ethRPC.blockGasPriceCache.get.callCount).to.equal(0);
    expect(ethRPC.web3.eth.getBlock.callCount).to.equal(10);
  });

  it('should estimate gas price with cache', async () => {
    sinon.spy(ethRPC.web3.eth, 'getBlock');
    sinon.spy(ethRPC.blockGasPriceCache, 'get');
    const gasPrice = await ethRPC.estimateGasPrice();
    expect(gasPrice).to.be.gt(0);
    expect(ethRPC.blockGasPriceCache.get.callCount).to.be.gt(0);
    expect(ethRPC.web3.eth.getBlock.callCount).to.be.lt(10);
  });

  it('should estimate fee for type 2 transaction', async () => {
    sinon.spy(ethRPC.web3.eth, 'getBlock');
    const maxFee = await ethRPC.estimateFee({ txType: 2, priority: 5 });
    expect(maxFee).to.be.equal(5154455240n);
    expect(ethRPC.web3.eth.getBlock.callCount).to.equal(1);
  });

  it('should estimate max fee', async () => {
    sinon.spy(ethRPC.web3.eth, 'getBlock');
    const maxFee = await ethRPC.estimateMaxFee({});
    expect(maxFee).to.be.equal(2654455240n);
    expect(ethRPC.web3.eth.getBlock.callCount).to.equal(1);
  });

  it('should estimate max fee using priority fee percentile', async () => {
    sinon.spy(ethRPC.emitter, 'emit');
    sinon.spy(ethRPC.web3.eth, 'getBlock');
    const maxFee = await ethRPC.estimateMaxFee({ percentile: 15 });
    expect(maxFee).to.be.equal(1154455240n);
    expect(ethRPC.web3.eth.getBlock.callCount).to.be.lt(10);
    expect(ethRPC.emitter.emit.callCount).to.equal(0);
  });

  it('should estimate max priority fee', async () => {
    sinon.spy(ethRPC.blockMaxPriorityFeeCache, 'set');
    const maxPriorityFee = await ethRPC.estimateMaxPriorityFee({});
    expect(maxPriorityFee).to.be.gt(0n);
    expect(maxPriorityFee).to.be.equal(1000000000n);
    expect(ethRPC.blockMaxPriorityFeeCache.set.callCount).to.equal(0);
  });

  it('should estimate fee', async () => {
    const fee = await rpcs.estimateFee({ currency, nBlocks: 4 });
    expect(fee).to.equal(20000000000n);
  });

  it('should send raw transaction', async () => {
    // Get nonce
    const txCount = await rpcs.getTransactionCount({
      currency,
      address: config.account
    });

    // construct the transaction data
    const txData = {
      nonce: txCount,
      chainId: 1337,
      gasLimit: 25000,
      gasPrice: 2.1*10e9,
      to: config.currencyConfig.sendTo,
      value: Number(util.toWei('123', 'wei'))
    };
    const privateKey = config.currencyConfig.privateKey;
    const signer = new ethers.Wallet(privateKey);
    const signedTx = await signer.signTransaction(txData);
    const sentTx = await rpcs.sendRawTransaction({
      currency,
      rawTx: signedTx
    });
    expect(sentTx.length).to.equal(66);
  });

  it('should catch failed send raw transaction', async () => {
    try {
      // construct the transaction data
      const txData = {
        nonce: null,
        chainId: 1337,
        gasLimit: 25000,
        gasPrice: 2.1*10e9,
        to: config.currencyConfig.sendTo,
        value: Number(util.toWei('123', 'wei'))
      };
      const privateKey = config.currencyConfig.privateKey;
      const signer = new ethers.Wallet(privateKey);
      const signedTx = await signer.signTransaction(txData);
      await rpcs.sendRawTransaction({
        currency,
        rawTx: signedTx
      });
      return signedTx;
    } catch (err) {
      expect(err.message).to.include('nonce too low');
    }
  });

  it('should succeed send raw transaction already broadcast', async () => {
    const txCount = await rpcs.getTransactionCount({
      currency,
      address: config.account
    });
    try {
      // construct the transaction data
      const txData = {
        // add to nonce so that the first tx isn't auto-mined before second tx is sent
        nonce: txCount + 1n,
        chainId: 1337,
        gasLimit: 25000,
        gasPrice: 2.1*10e9,
        to: config.currencyConfig.sendTo,
        value: Number(util.toWei('123', 'wei'))
      };
      const privateKey = config.currencyConfig.privateKey;
      const signer = new ethers.Wallet(privateKey);
      const signedTx = await signer.signTransaction(txData);
      const txSend1 = await rpcs.sendRawTransaction({
        currency,
        rawTx: signedTx
      });
      const txSend2 = await rpcs.sendRawTransaction({
        currency,
        rawTx: signedTx
      });
      expect(txSend1).to.equal(txSend2);
    } catch (err) {
      expect(err.toString()).to.not.exist();
    }
  });

  it('should succeed send raw type 2 transaction', async () => {
    const txCount = await rpcs.getTransactionCount({
      currency,
      address: config.account
    });

    // construct the transaction data
    const txData = {
      nonce: txCount,
      chainId: 1337,
      gasLimit: 25000,
      type: 2,
      maxFeePerGas: Number(util.toWei('10', 'gwei')),
      to: config.currencyConfig.sendTo,
      value: Number(util.toWei('321', 'wei'))
    };
    const privateKey = config.currencyConfig.privateKey;
    const signer = new ethers.Wallet(privateKey);
    const signedTx = await signer.signTransaction(txData);
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx: signedTx });
    expect(decoded).to.exist;
    expect(decoded.type).to.equal(2);
    const txSend1 = await rpcs.sendRawTransaction({
      currency,
      rawTx: signedTx
    });
    expect(txSend1).to.equal('0x94266a12747ccea60d7566777d22c8e3b7bbaa71e16e69468c547c2bab0b9f90');      
  });

  it('should be able to get a block hash', async () => {
    const block = await rpcs.getBestBlockHash({ currency });
    blockHash = block;
    expect(util.isHex(block)).to.be.true;
  });

  it('should get block', async () => {
    const reqBlock = await rpcs.getBlock({ currency, hash: blockHash });
    expect(reqBlock.hash).to.equal(blockHash);
    expect(reqBlock).to.have.property('number');
    expect(reqBlock).to.have.property('hash');
    expect(reqBlock).to.have.property('parentHash');
    expect(reqBlock).to.have.property('sha3Uncles');
    expect(reqBlock).to.have.property('logsBloom');
    expect(reqBlock).to.have.property('transactionsRoot');
    expect(reqBlock).to.have.property('stateRoot');
    expect(reqBlock).to.have.property('receiptsRoot');
    expect(reqBlock).to.have.property('miner');
    expect(reqBlock).to.have.property('difficulty');
    // expect(reqBlock).to.have.property('totalDifficulty');
    expect(reqBlock).to.have.property('extraData');
    expect(reqBlock).to.have.property('size');
    expect(reqBlock).to.have.property('gasLimit');
    expect(reqBlock).to.have.property('gasUsed');
    expect(reqBlock).to.have.property('timestamp');
    expect(reqBlock).to.have.property('transactions');
    expect(reqBlock).to.have.property('uncles');
  });

  it('should be able to get a balance', async () => {
    const balance = await rpcs.getBalance({ currency });
    expect(util.isAddress(balance[0].account)).to.be.true;
    assert.hasAllKeys(balance[0], ['account', 'balance']);
  });

  it('should be able to send a transaction', async () => {
    txid = await rpcs.unlockAndSendToAddress({
      currency,
      address: config.currencyConfig.sendTo,
      amount: '10000',
      passphrase: currencyConfig.unlockPassword
    });
    expect(util.isHex(txid)).to.be.true;
  });

  it('should be able to send a transaction and specify a custom nonce and gasPrice', async () => {
    txid = await rpcs.unlockAndSendToAddress({
      currency,
      address: config.currencyConfig.sendTo,
      amount: '10000',
      passphrase: currencyConfig.unlockPassword,
      gasPrice: 30000000000,
      nonce: 25,
      chainId: 1337
    });
    const decodedParams = await rpcs.getTransaction({ txid });
    expect(decodedParams.nonce).to.equal(25n);
    expect(decodedParams.gasPrice).to.equal(30000000000n);
    expect(util.isHex(txid)).to.be.true;
  });

  it('should be able to send many transactions', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [{ address, amount }, { address, amount }];
    const eventEmitter = rpcs.rpcs.ETH.emitter;
    let eventCounter = 0;
    const emitResults = [];
    const emitPromise = new Promise(resolve => {
      eventEmitter.on('success', (emitData) => {
        eventCounter++;
        emitResults.push(emitData);
        if (eventCounter === 2) {
          resolve(emitResults);
        }
      });
    });
    const outputArray = await rpcs.unlockAndSendToAddressMany({
      currency,
      payToArray,
      passphrase: currencyConfig.unlockPassword
    });
    await emitPromise;
    expect(emitResults[0].txid).to.exist;
    expect(emitResults[0].error).to.not.exist;
    expect(emitResults[0].address).to.equal(address);
    expect(emitResults[0].amount).to.equal(amount);
    expect(emitResults[1].txid).to.exist;
    expect(emitResults[1].error).to.not.exist;
    expect(emitResults[1].address).to.equal(address);
    expect(emitResults[1].amount).to.equal(amount);
    expect(outputArray.length).to.equal(2);
    expect(util.isHex(outputArray[0].txid)).to.be.true;
    expect(util.isHex(outputArray[1].txid)).to.be.true;
    expect(outputArray[0].txid).to.have.lengthOf(66);
    expect(outputArray[1].txid).to.have.lengthOf(66);
    expect(outputArray[1].txid).to.not.equal(outputArray[0].txid);
  });

  it('should reject when one of many transactions fails', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
      { address: 'funkyColdMedina', amount: 1 }
    ];
    const eventEmitter = rpcs.rpcs.ETH.emitter;
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
    expect(outputArray[1].txid).to.not.exist;
    expect(outputArray[1].error).to.equal(emitResults[0].error);
    expect(emitResults.length).to.equal(1);
    expect(emitResults[0].error).to.exist;
  });

  it('should be able to get a transaction', async () => {
    const tx = await rpcs.getTransaction({ currency, txid });
    expect(tx).to.be.an('object');
  });

  it('should be able to decode a raw transaction', async () => {
    const { rawTx } = config.currencyConfig;
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    expect(decoded).to.exist;
  });

  it('should be able to decode a raw type 2 transaction', async () => {
    const rawTx = '0x02f9017d0580808504a817c800809437d7b3bbd88efde6a93cf74d2f5b0385d3e3b08a870dd764300b8000b90152f9014f808504a817c800809437d7b3bbd88efde6a93cf74d2f5b0385d3e3b08a870dd764300b8000b90124b6b4af05000000000000000000000000000000000000000000000000000dd764300b800000000000000000000000000000000000000000000000000000000004a817c8000000000000000000000000000000000000000000000000000000016ada606a26050bb49a5a8228599e0dd48c1368abd36f4f14d2b74a015b2d168dbcab0773ce399393220df874bb22ca961f351e038acd2ba5cc8c764385c9f23707622cc435000000000000000000000000000000000000000000000000000000000000001c7e247d684a635813267b10a63f7f3ba88b28ca2790c909110b28236cf1b9bba03451e83d5834189f28d4c77802fc76b7c760a42bc8bebf8dd15e6ead146805630000000000000000000000000000000000000000000000000000000000000000058080c0';
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    expect(decoded).to.exist;
    expect(decoded.type).to.equal(2);
    expect(decoded.maxFeePerGas).to.exist;
    expect(decoded.maxPriorityFeePerGas).to.exist;
  });

  it('should get the tip', async () => {
    const tip = await rpcs.getTip({ currency });
    assert.hasAllKeys(tip, ['height', 'hash']);
  });

  it('should get confirmations', async () => {
    const confirmations = await rpcs.getConfirmations({ currency, txid });
    expect(confirmations).to.exist;
  });

  it('should not get confirmations with invalid txid', async () => {
    expect(async () => await rpcs.getConfirmations({ currency, txid: 'wrongtxid' })).to.throw;
  });

  it('should validate address', async () => {
    const isValid = await rpcs.validateAddress({
      currency,
      address: config.currencyConfig.sendTo
    });
    const utilVaildate = util.isAddress(config.currencyConfig.sendTo);
    expect(isValid).to.equal(utilVaildate);
  });

  it('should not validate bad address', async () => {
    const isValid = await rpcs.validateAddress({
      currency,
      address: 'NOTANADDRESS'
    });
    const utilVaildate = util.isAddress('NOTANADDRESS');
    expect(isValid).to.equal(utilVaildate);
  });

  it('should be able to get server info', async () => {
    const info = await rpcs.getServerInfo({ currency });
    expect(typeof info).to.equal('string');
  });

  it('should get pending transactions', async () => {
    const pendingTxs = await rpcs.getTransactions({ currency });
    expect(Array.isArray(pendingTxs)).to.equal(true);
  });
});
