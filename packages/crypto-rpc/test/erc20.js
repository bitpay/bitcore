import { expect } from 'chai';
import { createRequire } from 'module';
import { ethers } from 'crypto-wallet-core';
import { CryptoRpc } from '../index.js';

const require = createRequire(import.meta.url);
const deployedAddresses = require('../blockchain/EVM/ignition/deployments/chain-1337/deployed_addresses.json');

const config = {
  chain: 'ETH',
  host: process.env.HOST_ETH || 'geth',
  protocol: 'http',
  rpcPort: '8545',
  account: '0x00a329c0648769A73afAc7F9381E08FB43dBEA72',
  tokens: {
    ERC20: {
      tokenContractAddress: deployedAddresses['ERC20#CryptoErc20'],
      type: 'ERC20'
    }
  },
  currencyConfig: {
    sendTo: '0xA15035277A973d584b1d6150e93C21152D6Af440',
    unlockPassword: '',
    privateKey:
      '0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7',
    rawTx:
      '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
  }
};

describe('ERC20 Tests', function() {
  this.timeout(10000);
  const currency = 'ERC20';
  const currencyConfig = config.currencyConfig;
  let txid = '';
  let rpcs;
  
  before(done => {
    rpcs = new CryptoRpc(config, currencyConfig);
    setTimeout(done, 5000);
  });

  it('should be able to get specific balance', async () => {
    const balance = await rpcs.getBalance({ currency, address: config.account });
    expect(Number(balance)).to.be.gt(0);
  });

  it('should be able to get all balances', async () => {
    rpcs.rpcs[currency].addAccount(currencyConfig.privateKey);
    const balances = await rpcs.getBalance({ currency });
    expect(Array.isArray(balances)).to.be.true;
    expect(balances.length).to.equal(1);
    expect(balances[0].account).to.equal(config.account);
    expect(Number(balances[0].balance)).to.be.gt(0);
    rpcs.rpcs[currency].removeAccount(config.account);
  });

  it('should be able to send a transaction', async () => {
    txid = await rpcs.unlockAndSendToAddress({ currency, address: config.currencyConfig.sendTo, amount: '10000', fromAccount: currencyConfig.privateKey });
    expect(txid).to.exist;
  });

  it('should be able to send a transaction and specify a custom nonce and gasPrice', async () => {
    txid = await rpcs.unlockAndSendToAddress({
      currency,
      address: config.currencyConfig.sendTo,
      amount: '10000',
      fromAccount: currencyConfig.privateKey,
      gasPrice: 30000000000,
      nonce: 24
    });
    const decodedParams = await rpcs.getTransaction({ currency, txid });
    expect(decodedParams.nonce).to.equal(24n);
    expect(decodedParams.gasPrice).to.equal(30000000000n);
    expect(ethers.isHexString(txid)).to.be.true;
  });

  it('should be able to send a big transaction', async () => {
    txid = await rpcs.unlockAndSendToAddress({ currency, address: config.currencyConfig.sendTo, amount: 1e23, fromAccount: currencyConfig.privateKey });
    expect(txid).to.exist;
  });

  it('should be able to send many transactions', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [{ address, amount }, { address, amount }];
    const eventEmitter = rpcs.rpcs.ERC20.emitter;
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
      fromAccount: currencyConfig.privateKey
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
    expect(ethers.isHexString(outputArray[0].txid)).to.be.true;
    expect(ethers.isHexString(outputArray[1].txid)).to.be.true;
    expect(outputArray[0].txid).to.have.lengthOf(66);
    expect(outputArray[1].txid).to.have.lengthOf(66);
  });

  it('should reject when one of many transactions fails', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
      { address: 'funkyColdMedina', amount: 1 }
    ];
    const eventEmitter = rpcs.rpcs.ERC20.emitter;
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
      fromAccount: currencyConfig.privateKey
    });
    await emitPromise;
    expect(outputArray[1].txid).to.not.exist;
    expect(outputArray[1].error).to.equal(emitResults[0].error);
    expect(emitResults.length).to.equal(1);
    expect(emitResults[0].error).to.exist;
  });

  it('should be able to decode a non ERC-20 raw transaction', async () => {
    const { rawTx } = config.currencyConfig;
    expect(rawTx).to.exist;
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    expect(decoded).to.exist;
    expect(decoded.decodedData).to.not.exist;
  });

  it('should be able to decode a raw ERC-20 transaction', async () => {
    const rawTx = '0xf86c118459682f0083027100949c9933a9258347db795ade131c93d1c5ae53438980b844a9059cbb0000000000000000000000007ee308b49e36ab516cd0186b3a47cfd31d2499a100000000000000000000000000000000000000000000000000f4a6889d2aeff6830138818080';
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    expect(decoded).to.exist;
    expect(decoded.decodedData).to.exist;
    expect(decoded.decodedData.args[0]).to.equal('0x7ee308b49e36Ab516cd0186B3a47CFD31d2499A1');
    expect(decoded.decodedData.args[1]).to.equal(68862999999999990n);
  });
});

