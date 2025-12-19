import { expect } from 'chai';
import sinon from 'sinon';
import { Web3, ethers } from 'crypto-wallet-core';
import { CryptoRpc } from '../index.js';
import { chainConfig } from '../lib/eth/chains.js';

const configs = [
  {
    chain: 'ETH',
    host: process.env.ETH_HOST || 'geth',
    protocol: 'http',
    port: '8545',
    rpcPort: '8545',
    account: '0x00a329c0648769A73afAc7F9381E08FB43dBEA72',
    currencyConfig: {
      sendTo: '0xA15035277A973d584b1d6150e93C21152D6Af440',
      unlockPassword: '',
      privateKey:
        '0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7',
      rawTx:
        '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
    }
  },
  {
    chain: 'ARB',
    host: process.env.HOST_ARB || 'geth',
    protocol: 'http',
    port: '8545',
    rpcPort: '8545',
    account: '0x30aEB843945055c9d96c4f2E99BF66FF1EF778C7',
    currencyConfig: {
      sendTo: '0xBa1E702D95682023782DD630fdC66E13ded26615',
      unlockPassword: '',
      privateKey: '0x3669381038794f93b2e30f9fc7edc871aec5351e40af833aa049e4c00a25ec8a',
      rawTx:
      '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
    },
    isEVM: true
  },
  {
    chain: 'OP',
    host: process.env.HOST_OP || 'geth',
    protocol: 'http',
    port: '8545',
    rpcPort: '8545',
    account: '0x94BE9Bd3f76B0689a141aED24c149bB6acBa5411',
    currencyConfig: {
      sendTo: '0xe4Fcbfb1c2ddD20d618CDD8E78d8E64aCB835AD0',
      unlockPassword: '',
      privateKey: '0xbc65cb6c016e4e05d56ea272dd2513ab8fb999f85badbd726e2db7e12383b748',
      rawTx:
      '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
    },
    isEVM: true
  },
  {
    chain: 'BASE',
    host: process.env.HOST_BASE || 'geth',
    protocol: 'http',
    port: '8545',
    rpcPort: '8545',
    account: '0xB556dc491B7652f73B9D3080A6Cbf2766dB368e9',
    currencyConfig: {
      sendTo: '0x37D3bCDA9d7d5Dc41e32DAd77a5BA89a77aA8BD0',
      unlockPassword: '',
      privateKey: '0x61cad5947d07d2ca69fc57e96c5b79b2927ea263475b17938b2900d0a258faec',
      rawTx:
      '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
    },
    isEVM: true
  },
  {
    chain: 'MATIC',
    host: process.env.HOST_MATIC || 'geth',
    protocol: 'http',
    port: '8545',
    rpcPort: '8545',
    account: '0x7B9bCe020241027a136399a3307195c41AC9d5d7',
    currencyConfig: {
      sendTo: '0xc0b4dD3941898CB1dAF5cD768Bc1997F77a3D9a5',
      unlockPassword: '',
      privateKey:
        '0x1ac9e617ee805e0e6fab5aff99b960bf464d03e8db5bc73e15419422a81c57e2',
      rawTx:
        '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
    },
    isEVM: true
  }
];

describe('EVM', function() {
  before(async function() {
    const recipientConfigs = configs.slice(1);
    const mainConfig = configs[0];
    const rpc = new CryptoRpc(mainConfig, mainConfig.currencyConfig);
    for (const config of recipientConfigs) {
      // fund the other addresses
      await rpc.unlockAndSendToAddress({
        currency: mainConfig.chain,
        address: config.account,
        amount: 1e20,
        fromAccount: mainConfig.currencyConfig.privateKey
      });
    }
  });

  for (const config of configs) {

    describe(`${config.chain} Tests: `, function() {
      const currency = config.chain;
      const currencyConfig = config.currencyConfig;
      const rpcs = new CryptoRpc(config, currencyConfig);
      const evmRPC = rpcs.get(currency);
      let txid = '';
      let blockHash = '';
    
      this.timeout(30000);
    
      before(done => {
        setTimeout(done, 10000);
      });

      afterEach(() => {
        sinon.restore();
      });

      it('should add account', function() {
        const address = rpcs.rpcs[config.chain].addAccount(currencyConfig.privateKey);
        expect(address).to.equal(config.account);
      });

      it('should get account', function() {
        const address = rpcs.rpcs[config.chain].getAccount();
        expect(address).to.equal(config.account);
      });

      it('should remove account', function() {
        rpcs.rpcs[config.chain].removeAccount(config.account);
        const address = rpcs.rpcs[config.chain].getAccount();
        expect(address).to.not.exist;
      });
    
      it('should estimate fee', async () => {
        const fee = await rpcs.estimateFee({ currency, nBlocks: 4 });
        expect(fee).to.be.gte(400000000);
      });

      it('should send raw transaction', async () => {
        const nonce = await rpcs.getTransactionCount({ currency, address: config.account });
        // construct the transaction data
        const txData = {
          chainId: 1337,
          nonce,
          gasLimit: 25000,
          gasPrice: 2.1 * 10e9,
          to: config.currencyConfig.sendTo,
          value: Number(Web3.utils.toWei('123', 'wei'))
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
            chainId: 1337,
            nonce: 1,
            gasLimit: 25000,
            gasPrice: 2.1 * 10e9,
            to: config.currencyConfig.sendTo,
            value: Number(Web3.utils.toWei('123', 'wei'))
          };
          const privateKey = config.currencyConfig.privateKey;
          const signer = new ethers.Wallet(privateKey);
          const signedTx = await signer.signTransaction(txData);
          await rpcs.sendRawTransaction({
            currency,
            rawTx: signedTx
          });
        } catch (err) {
          expect(err.message).to.include('nonce too low');
        }
      });

      it('should estimate fee for type 2 transaction', async () => {
        sinon.spy(evmRPC.web3.eth, 'getBlock');
        const maxFee = await evmRPC.estimateFee({ txType: 2, priority: 5 });
        expect(maxFee).to.be.gt(5000000000n);
        expect(evmRPC.web3.eth.getBlock.callCount).to.equal(1);
      });

      it('should use fee minimums when estimating priority fee for type 2 txs', async () => {
        const maxFee = await evmRPC.estimateMaxPriorityFee({ percentile: 25 });
        const minimumFee = chainConfig[config.chain] ? chainConfig[config.chain].priorityFee : 2.5;
        expect(maxFee).to.equal(BigInt(minimumFee * 1e9));
      });
    
      it('should estimate gas price', async () => {
        const gasPrice = await evmRPC.estimateGasPrice();
        expect(gasPrice).to.be.gte(500000000);
      });

      it('should be able to get a block hash', async () => {
        const block = await rpcs.getBestBlockHash({ currency });
        blockHash = block;
        expect(ethers.isHexString(block)).to.be.true;
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
    
      it('should be able to get a specific balance', async () => {
        const balance = await rpcs.getBalance({ currency, address: config.account });
        expect(balance).to.be.gt(0);
      });
    
      it('should be able to send a transaction', async () => {
        txid = await rpcs.unlockAndSendToAddress({
          currency,
          address: config.currencyConfig.sendTo,
          amount: '10000',
          fromAccount: currencyConfig.privateKey
        });
        expect(ethers.isHexString(txid)).to.be.true;
      });

      it('should be able to send a transaction with added wallet', async () => {
        rpcs.rpcs[config.chain].addAccount(currencyConfig.privateKey);
        txid = await rpcs.unlockAndSendToAddress({
          currency,
          address: config.currencyConfig.sendTo,
          amount: '10000',
          fromAccount: config.account,
          gasPrice: 30000000000
        });
        const decodedParams = await rpcs.getTransaction({ txid });
        expect(decodedParams.gasPrice).to.equal(30000000000n);
        expect(ethers.isHexString(txid)).to.be.true;
        rpcs.rpcs[config.chain].removeAccount(config.account);
      });
    
      it('should be able to send a transaction and specify a custom gasPrice', async () => {
        txid = await rpcs.unlockAndSendToAddress({
          currency,
          address: config.currencyConfig.sendTo,
          amount: '10000',
          fromAccount: currencyConfig.privateKey,
          gasPrice: 30000000000
        });
        const decodedParams = await rpcs.getTransaction({ txid });
        expect(decodedParams.gasPrice).to.equal(30000000000n);
        expect(ethers.isHexString(txid)).to.be.true;
      });
    
      it('should be able to send many transactions', async () => {
        const address = config.currencyConfig.sendTo;
        const amount = '1000';
        const payToArray = [{ address, amount }, { address, amount }];
        const eventEmitter = rpcs.rpcs[config.chain].emitter;
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
          fromAccount: currencyConfig.privateKey,
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
        expect(outputArray[1].txid).to.not.equal(outputArray[0].txid);
      });
    
      it('should reject when one of many transactions fails', async () => {
        const address = config.currencyConfig.sendTo;
        const amount = '1000';
        const payToArray = [
          { address, amount },
          { address: 'funkyColdMedina', amount: 1 }
        ];
        const eventEmitter = rpcs.rpcs[config.chain].emitter;
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

      it('should be able to get all balances', async () => {
        rpcs.rpcs[config.chain].addAccount(currencyConfig.privateKey);
        const balance = await rpcs.getBalance({ currency });
        expect(balance[0].account).to.equal(config.account);
        expect(balance[0].balance).to.be.gt(0);
      });
    
      it('should be able to get a transaction', async () => {
        const tx = await rpcs.getTransaction({ currency, txid });
        expect(tx).to.exist;
        expect(typeof tx).to.equal('object');
      });
    
      it('should be able to decode a raw transaction', async () => {
        const { rawTx } = config.currencyConfig;
        const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
        expect(decoded).to.exist;
      });
    
      it('should get the tip', async () => {
        const tip = await rpcs.getTip({ currency });
        expect(tip.height).to.exist;
        expect(tip.hash).to.exist;
      });
    
      it('should get confirmations', async () => {
        const confirmations = await rpcs.getConfirmations({ currency, txid });
        expect(confirmations).to.be.gt(0);
      });
    
      it('should reject getConfirmations with invalid txid', async () => {
        try {
          await rpcs.getConfirmations({ currency, txid: 'wrongtxid' });
          throw new Error('should have thrown');
        } catch (err) {
          expect(err.name).to.equal('Web3ValidatorError');
          expect(err.message).to.include('value "wrongtxid" at "/0" must pass "bytes32" validation');
        }
      });
    
      it('should validate address', async () => {
        const isValid = await rpcs.validateAddress({
          currency,
          address: config.currencyConfig.sendTo
        });
        const utilVaildate = ethers.isAddress(config.currencyConfig.sendTo);
        expect(isValid).to.equal(utilVaildate);
      });
    
      it('should not validate bad address', async () => {
        const isValid = await rpcs.validateAddress({
          currency,
          address: 'NOTANADDRESS'
        });
        const utilVaildate = ethers.isAddress('NOTANADDRESS');
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
  }
});
