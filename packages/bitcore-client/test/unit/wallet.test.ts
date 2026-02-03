import * as chai from 'chai';
import * as CWC from 'crypto-wallet-core';
import { AddressTypes, Wallet } from '../../src/wallet';
import { Encryption } from '../../src/encryption';
import { Api as bcnApi } from '../../../bitcore-node/build/src/services/api';
import { Storage as bcnStorage } from '../../../bitcore-node/build/src/services/storage';
import crypto from 'crypto';
import { Modules } from '../../../bitcore-node/build/src/modules';
import request from 'request-promise-native';
import requestStream from 'request';
import { Server } from 'http';
import sinon from 'sinon';
import { StorageType } from '../../src/types/storage';
import supertest from 'supertest';
import { utils } from '../../src/utils';


const should = chai.should();
const expect = chai.expect;

const libMap = {
  BTC: CWC.BitcoreLib,
  BCH: CWC.BitcoreLibCash,
  LTC: CWC.BitcoreLibLtc,
  DOGE: CWC.BitcoreLibDoge
};

describe('Wallet', function() {
  const sandbox = sinon.createSandbox();
  const storageType = 'Level';
  const baseUrl = 'http://127.0.0.1:3000/api';
  let walletName;
  let wallet: Wallet;
  let api;
  before(async function() {
    this.timeout(20000);
    await bcnStorage.start({
      dbHost: process.env.DB_HOST || 'localhost',
      dbPort: process.env.DB_PORT || '27017',
      dbName: process.env.DB_NAME || 'bitcore-client-tests'
    });
    Modules.loadConfigured();
    const httpServer: Server = await bcnApi.start();
    api = supertest(httpServer);
  });
  after(async function() {
    this.timeout(20000);
    await bcnApi.stop();
    await bcnStorage.stop();
  });
  beforeEach(function() {
    sandbox.stub(request, 'Request').callsFake(function(args) {
      args.url = args.url.replace('https://api.bitcore.io/api', baseUrl);
      args.url = args.url.replace(baseUrl, '/api');
      const req = api[args.method.toLowerCase()](args.url);
      for (const [key, value] of Object.entries(args.headers)) {
        req.set(key, value);
      }
      req.send(args.body);
      return req;
    });
    sandbox.stub(requestStream, 'defaults').callsFake(function(args) {
      console.log(args);
      throw new Error('Need to implement requestStream stub in tests');
    });
  });
  afterEach(async function() {
    await Wallet.deleteWallet({ name: walletName, storageType });
    sandbox.restore();
  });
  for (const chain of ['BTC', 'BCH', 'LTC', 'DOGE', 'ETH', 'XRP', 'MATIC']) {
    for (const addressType of Object.keys(AddressTypes[chain] || { 'pubkeyhash': 1 })) {

      it(`should create a wallet for chain and addressType: ${chain} ${addressType}`, async function() {
        walletName = 'BitcoreClientTest' + chain + addressType;

        wallet = await Wallet.create({
          chain,
          network: 'mainnet',
          name: walletName,
          phrase: 'snap impact summer because must pipe weasel gorilla actor acid web whip',
          password: 'abc123',
          lite: false,
          addressType,
          storageType,
          baseUrl,
          version: 0
        });

        expect(wallet.addressType).to.equal(AddressTypes[chain]?.[addressType] || 'pubkeyhash');
      });

      it(`should generate an address for chain and addressType: ${chain} ${addressType}`, function() {
        const address = wallet.deriveAddress(0, false);
        expect(address).to.exist;
        switch (chain) {
          case 'BTC':
          case 'BCH':
          case 'DOGE':
          case 'LTC':
            const a = new libMap[chain].Address(address);
            expect(a.toString(true)).to.equal(address);
            expect(a.type).to.equal(wallet.addressType);
            break;
          case 'XRP':
            // TODO verify XRP address
            break;
          default:
            expect(CWC.Web3.utils.isAddress(address)).to.equal(true);
            break;
        }
      });
    }
  }

  describe('bumpTxFee', function() {
    describe('UTXO', function() {
      walletName = 'BitcoreClientTestBumpFee-UTXO';

      beforeEach(async function() {
        wallet = await Wallet.create({
          name: walletName,
          chain: 'BTC',
          network: 'testnet',
          phrase: 'snap impact summer because must pipe weasel gorilla actor acid web whip',
          password: 'abc123',
          storageType,
          baseUrl,
          version: 0
        });
        await wallet.unlock('abc123');
      });

      it('should throw an error if changeIdx is null for UTXO chains', async () => {
        try {
          await wallet.bumpTxFee({});
          expect.fail('Expected method to throw');
        } catch (err) {
          expect(err.message).to.equal('Must provide changeIdx for UTXO chains');
        }
      });
  
      it('should throw an error if neither rawTx nor txid is provided', async () => {
        try {
          await wallet.bumpTxFee({ changeIdx: 0 });
          expect.fail('Expected method to throw');
        } catch (err) {
          expect(err.message).to.equal('Must provide either rawTx or txid');
        }
      });

      it('should bump the fee of a transaction with feeTarget', async function() {
        sandbox.stub(wallet, 'getTransactionByTxid').resolves({ '_id': '65982807d85e75f781a0d56f', 'txid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'network': 'regtest', 'chain': 'BTC', 'blockHeight': -1, 'blockHash': '', 'blockTime': '2024-01-05T16:02:15.678Z', 'blockTimeNormalized': '2024-01-05T16:02:15.678Z', 'coinbase': false, 'locktime': -1, 'inputCount': 5, 'outputCount': 1, 'size': 780, 'fee': 2409, 'value': 950891, 'confirmations': 0, 'coins': { 'inputs': [{ '_id': '659825bed85e75f781a01812', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 1, 'spentTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintTxid': '330716a75c23512202e45ffee478bdce7a33f298edf7eef30a42dbde06746c48', 'mintHeight': 154, 'spentHeight': -1, 'address': 'n2vpyzbBPBEni9FgkeQSnXvAQAfnRmKxFZ', 'script': '76a914eade85745090388e64a9341a82d8f94371430d1a88ac', 'value': 244000, 'confirmations': -1, 'sequenceNumber': 4294967293 }, { '_id': '65982587d85e75f781a0046f', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 1, 'spentTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintTxid': '7b83f82a22f94fc3e615743a5e6fb2345ed79aad8a2b564af2ace49da1e27ebb', 'mintHeight': 152, 'spentHeight': -1, 'address': 'muEU9KaNEw5doymy59ScrgEE3Eq4CQ45U9', 'script': '76a91496739b4ef4e793c05a78624da38d96f2c4059c6b88ac', 'value': 239400, 'confirmations': -1, 'sequenceNumber': 4294967293 }, { '_id': '65982511d85e75f7819fdd40', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 0, 'spentTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintTxid': 'fb4d8039024c80a655fea29e01faf202f30e936af5738e31c5841a84215ca4d6', 'mintHeight': 149, 'spentHeight': -1, 'address': 'muEU9KaNEw5doymy59ScrgEE3Eq4CQ45U9', 'script': '76a91496739b4ef4e793c05a78624da38d96f2c4059c6b88ac', 'value': 239400, 'confirmations': -1, 'sequenceNumber': 4294967293 }, { '_id': '659824d7d85e75f7819fc75d', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 0, 'spentTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintTxid': '8221ed6891f6ba82ab72bb8298a661e21b47b04408861b0c3268c4a04a0435b3', 'mintHeight': 145, 'spentHeight': -1, 'address': 'miEzS8fSvtDjwkEjY14FEuWumFKg8nTPV9', 'script': '76a9141de381fc20d34d20e11a5543f536a4b74f495a9888ac', 'value': 228000, 'confirmations': -1, 'sequenceNumber': 4294967293 }, { '_id': '65982389d85e75f7819f57ff', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 0, 'spentTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintTxid': '95f713c2d7e09ab57ec3016bb767b26e6ee849cf487e86d8ed6126ae1b893e0f', 'mintHeight': 143, 'spentHeight': -1, 'address': 'msnM9VB5usfBahZNo57ZUq9uzwRxQXksUz', 'script': '76a914868ad3308906626182d1c6cd703cc7ce78b3a28d88ac', 'value': 2500, 'confirmations': -1, 'sequenceNumber': 4294967293 }], 'outputs': [{ '_id': '65982807d85e75f781a0d55d', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 0, 'spentTxid': '', 'mintTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintHeight': -1, 'spentHeight': -2, 'address': 'mwwrGzk9q8xugY97C8BiNbcgqXNyjH4kp8', 'script': '76a914b4376347e4cffb1e9a475b2661bbe74de3c1f86a88ac', 'value': 950891, 'confirmations': -1 }] } });
        sandbox.stub(wallet, 'getNetworkFee').resolves({ feerate: 0.00064803, blocks: 2 }); // this is a real response from mainnet
        sandbox.stub(wallet.client, 'importAddresses').resolves();
        sandbox.spy(CWC.BitcoreLib.Transaction.prototype, 'feePerByte');

        await wallet.generateAddressPair(1310066242, true);
        await wallet.generateAddressPair(1087984800, true);
        await wallet.generateAddressPair(1310064953, true);
        await wallet.generateAddressPair(1310062823, true);

        const { tx: newTx } = await wallet.bumpTxFee({
          txid: '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5',
          changeIdx: 0,
          feeTarget: 2
        });
        CWC.BitcoreLib.Transaction.prototype.feePerByte.callCount.should.equal(1);
        CWC.BitcoreLib.Transaction.prototype.feePerByte.args[0][0].should.equal(65);
        expect(newTx).to.equal('0200000005486c7406dedb420af3eef7ed98f2337acebd78e4fe5fe4022251235ca71607330100000000fdffffffbb7ee2a19de4acf24a562b8aad9ad75e34b26f5e3a7415e6c34ff9222af8837b0100000000fdffffffd6a45c21841a84c5318e73f56a930ef302f2fa019ea2fe55a6804c0239804dfb0000000000fdffffffb335044aa0c468320c1b860844b0471be261a69882bb72ab82baf69168ed21820000000000fdffffff0f3e891bae2661edd8867e48cf49e86e6eb267b76b01c37eb59ae0d7c213f7950000000000fdffffff01c4c40d00000000001976a914b4376347e4cffb1e9a475b2661bbe74de3c1f86a88ac00000000');
      });

      it('should bump the fee of a transaction with feeRate', async function() {
        sandbox.stub(wallet, 'getTransactionByTxid').resolves({ '_id': '65982807d85e75f781a0d56f', 'txid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'network': 'regtest', 'chain': 'BTC', 'blockHeight': -1, 'blockHash': '', 'blockTime': '2024-01-05T16:02:15.678Z', 'blockTimeNormalized': '2024-01-05T16:02:15.678Z', 'coinbase': false, 'locktime': -1, 'inputCount': 5, 'outputCount': 1, 'size': 780, 'fee': 2409, 'value': 950891, 'confirmations': 0, 'coins': { 'inputs': [{ '_id': '659825bed85e75f781a01812', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 1, 'spentTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintTxid': '330716a75c23512202e45ffee478bdce7a33f298edf7eef30a42dbde06746c48', 'mintHeight': 154, 'spentHeight': -1, 'address': 'n2vpyzbBPBEni9FgkeQSnXvAQAfnRmKxFZ', 'script': '76a914eade85745090388e64a9341a82d8f94371430d1a88ac', 'value': 244000, 'confirmations': -1, 'sequenceNumber': 4294967293 }, { '_id': '65982587d85e75f781a0046f', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 1, 'spentTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintTxid': '7b83f82a22f94fc3e615743a5e6fb2345ed79aad8a2b564af2ace49da1e27ebb', 'mintHeight': 152, 'spentHeight': -1, 'address': 'muEU9KaNEw5doymy59ScrgEE3Eq4CQ45U9', 'script': '76a91496739b4ef4e793c05a78624da38d96f2c4059c6b88ac', 'value': 239400, 'confirmations': -1, 'sequenceNumber': 4294967293 }, { '_id': '65982511d85e75f7819fdd40', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 0, 'spentTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintTxid': 'fb4d8039024c80a655fea29e01faf202f30e936af5738e31c5841a84215ca4d6', 'mintHeight': 149, 'spentHeight': -1, 'address': 'muEU9KaNEw5doymy59ScrgEE3Eq4CQ45U9', 'script': '76a91496739b4ef4e793c05a78624da38d96f2c4059c6b88ac', 'value': 239400, 'confirmations': -1, 'sequenceNumber': 4294967293 }, { '_id': '659824d7d85e75f7819fc75d', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 0, 'spentTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintTxid': '8221ed6891f6ba82ab72bb8298a661e21b47b04408861b0c3268c4a04a0435b3', 'mintHeight': 145, 'spentHeight': -1, 'address': 'miEzS8fSvtDjwkEjY14FEuWumFKg8nTPV9', 'script': '76a9141de381fc20d34d20e11a5543f536a4b74f495a9888ac', 'value': 228000, 'confirmations': -1, 'sequenceNumber': 4294967293 }, { '_id': '65982389d85e75f7819f57ff', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 0, 'spentTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintTxid': '95f713c2d7e09ab57ec3016bb767b26e6ee849cf487e86d8ed6126ae1b893e0f', 'mintHeight': 143, 'spentHeight': -1, 'address': 'msnM9VB5usfBahZNo57ZUq9uzwRxQXksUz', 'script': '76a914868ad3308906626182d1c6cd703cc7ce78b3a28d88ac', 'value': 2500, 'confirmations': -1, 'sequenceNumber': 4294967293 }], 'outputs': [{ '_id': '65982807d85e75f781a0d55d', 'chain': 'BTC', 'network': 'regtest', 'coinbase': false, 'mintIndex': 0, 'spentTxid': '', 'mintTxid': '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5', 'mintHeight': -1, 'spentHeight': -2, 'address': 'mwwrGzk9q8xugY97C8BiNbcgqXNyjH4kp8', 'script': '76a914b4376347e4cffb1e9a475b2661bbe74de3c1f86a88ac', 'value': 950891, 'confirmations': -1 }] } });
        sandbox.stub(wallet.client, 'importAddresses').resolves();
        sandbox.spy(CWC.BitcoreLib.Transaction.prototype, 'feePerByte');
  
        await wallet.generateAddressPair(1310066242, true);
        await wallet.generateAddressPair(1087984800, true);
        await wallet.generateAddressPair(1310064953, true);
        await wallet.generateAddressPair(1310062823, true);
  
        const { tx: newTx } = await wallet.bumpTxFee({
          txid: '8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5',
          changeIdx: 0,
          feeRate: 2
        });
        CWC.BitcoreLib.Transaction.prototype.feePerByte.callCount.should.equal(1);
        CWC.BitcoreLib.Transaction.prototype.feePerByte.args[0][0].should.equal(2);
        expect(newTx).to.equal('0200000005486c7406dedb420af3eef7ed98f2337acebd78e4fe5fe4022251235ca71607330100000000fdffffffbb7ee2a19de4acf24a562b8aad9ad75e34b26f5e3a7415e6c34ff9222af8837b0100000000fdffffffd6a45c21841a84c5318e73f56a930ef302f2fa019ea2fe55a6804c0239804dfb0000000000fdffffffb335044aa0c468320c1b860844b0471be261a69882bb72ab82baf69168ed21820000000000fdffffff0f3e891bae2661edd8867e48cf49e86e6eb267b76b01c37eb59ae0d7c213f7950000000000fdffffff01b4850e00000000001976a914b4376347e4cffb1e9a475b2661bbe74de3c1f86a88ac00000000');
      });
    });

    describe('EVM', function() {
      walletName = 'BitcoreClientTestBumpFee-EVM';

      beforeEach(async function() {
        wallet = await Wallet.create({
          name: walletName,
          chain: 'ETH',
          network: 'testnet',
          phrase: 'snap impact summer because must pipe weasel gorilla actor acid web whip',
          password: 'abc123',
          storageType,
          baseUrl,
          version: 0
        });
        await wallet.unlock('abc123');
      });

  
      it('should throw an error if neither rawTx nor txid is provided', async () => {
        try {
          await wallet.bumpTxFee({ changeIdx: 0 });
          expect.fail('Expected method to throw');
        } catch (err) {
          expect(err.message).to.equal('Must provide either rawTx or txid');
        }
      });

      it('should bump the fee of a transaction with feeTarget', async function() {
        sandbox.stub(wallet, 'getTransactionByTxid').resolves({ 'txid': '0x0cf410cfe7fb268ad06ae115edfa8a30a8dea3979336a647b09b5a789c4b53d5', 'network': 'regtest', 'chain': 'ETH', 'blockHeight': 43245, 'blockHash': '0x9edb8d10883a360f7ff0c26860b6a159f5b7a74226949a4365691a879fafcdfc', 'blockTime': '2024-01-08T16:31:46.000Z', 'blockTimeNormalized': '2024-01-08T16:31:46.000Z', 'fee': 42000000000000, 'value': 1000000000000000000, 'gasLimit': 200000, 'gasPrice': 2000000000, 'nonce': 0, 'to': '0x7ee308b49e36Ab516cd0186B3a47CFD31d2499A1', 'from': '0x5FbdD2712d05D1a73e0b3Eba5efE8c3d42a336C3', 'effects': [], 'data': '0x', 'internal': [], 'calls': [], 'confirmations': 33 });
        sandbox.stub(wallet, 'getNetworkFee').resolves({ feerate: 26550000000, blocks: 2 }); // this is a real response from mainnet
        sandbox.stub(wallet.client, 'importAddresses').resolves();

        const { tx: newTx, params } = await wallet.bumpTxFee({
          txid: '0x0cf410cfe7fb268ad06ae115edfa8a30a8dea3979336a647b09b5a789c4b53d5',
          feeTarget: 2
        });
        params.gasPrice.should.equal(26550000000);
        expect(newTx).to.equal('0xf08085062e80d98083030d40947ee308b49e36ab516cd0186b3a47cfd31d2499a1880de0b6b3a76400008083aa36a78080');
      });

      it('should bump the fee of a transaction with feeRate', async function() {
        sandbox.stub(wallet, 'getTransactionByTxid').resolves({ 'txid': '0x0cf410cfe7fb268ad06ae115edfa8a30a8dea3979336a647b09b5a789c4b53d5', 'network': 'regtest', 'chain': 'ETH', 'blockHeight': 43245, 'blockHash': '0x9edb8d10883a360f7ff0c26860b6a159f5b7a74226949a4365691a879fafcdfc', 'blockTime': '2024-01-08T16:31:46.000Z', 'blockTimeNormalized': '2024-01-08T16:31:46.000Z', 'fee': 42000000000000, 'value': 1000000000000000000, 'gasLimit': 200000, 'gasPrice': 2000000000, 'nonce': 0, 'to': '0x7ee308b49e36Ab516cd0186B3a47CFD31d2499A1', 'from': '0x5FbdD2712d05D1a73e0b3Eba5efE8c3d42a336C3', 'effects': [], 'data': '0x', 'internal': [], 'calls': [], 'confirmations': 33 });
        sandbox.stub(wallet.client, 'importAddresses').resolves();
    
        const { tx: newTx, params } = await wallet.bumpTxFee({
          txid: '0x0cf410cfe7fb268ad06ae115edfa8a30a8dea3979336a647b09b5a789c4b53d5',
          feeRate: 300
        });
        params.gasPrice.should.equal(CWC.Web3.utils.toWei('300', 'gwei'));
        expect(newTx).to.equal('0xf0808545d964b80083030d40947ee308b49e36ab516cd0186b3a47cfd31d2499a1880de0b6b3a76400008083aa36a78080');
      });
    });
  });

  describe('getLocalAddress', function() {
    for (const storageType of ['Level', 'Mongo', 'TextFile'] as StorageType[]) {
      describe(storageType, function() {
        let wallet;
        const walletName = 'BitcoreClientTestGetLocalAddress' + storageType;
        let address1, caddress1, address2, caddress2, address3, caddress3;
        let path;
        if (storageType === 'Mongo' && (process.env.DB_NAME || process.env.DB_HOST || process.env.DB_PORT)) {
          path = `mongodb://${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME || 'bitcoreWallets-test'}`;
        }

        before(async function() {
          this.timeout(5000);
          try {
            wallet = await Wallet.create({
              name: walletName,
              chain: 'BTC',
              network: 'regtest',
              password: 'abc123',
              storageType,
              path,
              baseUrl,
              version: 0
            });
            await wallet.unlock('abc123');
            // 3 address pairs
            [address1, caddress1] = await wallet.nextAddressPair(true);
            [address2, caddress2] = await wallet.nextAddressPair(true);
            [address3, caddress3] = await wallet.nextAddressPair(true);
          } catch (e) {
            wallet?.storage.close();
            throw e;
          }
        });

        after(async function() {
          await Wallet.deleteWallet({ name: walletName, storageType, path });
          wallet?.storage.close();
        });

        it('should return the local address', async function() {
          const localAddress = await wallet.getLocalAddress(address2);
          expect(localAddress.address).to.equal(address2);
          expect(localAddress.path).to.equal('m/0/1');
          expect(localAddress.pubKey).to.exist;
        });
      });
    }
  });

  describe('importKeys', function() {
    walletName = 'BitcoreClientTestImportKeys';
    let requestStub;
    let sleepStub;

    beforeEach(async function() {
      wallet = await Wallet.create({
        name: walletName,
        chain: 'BTC',
        network: 'testnet',
        phrase: 'snap impact summer because must pipe weasel gorilla actor acid web whip',
        password: 'abc123',
        storageType,
        baseUrl,
        version: 0
      });
      await wallet.unlock('abc123');
      requestStub = sandbox.stub(wallet.client, '_request').resolves();
      sleepStub = sandbox.stub(utils, 'sleep').resolves();
    });

    it('should import 1 key', async function() {
      const keys = [];
      for (let i = 0; i < 1; i++) {
        const pk = crypto.randomBytes(32).toString('hex');
        keys.push({
          privKey: pk,
          address: libMap.BTC.PrivateKey(pk).toAddress().toString()
        });
      }
      await wallet.importKeys({
        keys,
        rederiveAddys: false
      });

      requestStub.callCount.should.equal(1);
      sleepStub.callCount.should.equal(0);
      requestStub.args.flatMap(arg => arg[0].body).should.deep.equal(keys.map(k => ({ address: k.address })));
    });

    it('should import <100 keys', async function() {
      const keys = [];
      for (let i = 0; i < 100; i++) {
        const pk = crypto.randomBytes(32).toString('hex');
        keys.push({
          privKey: pk,
          address: libMap.BTC.PrivateKey(pk).toAddress().toString()
        });
      }
      await wallet.importKeys({
        keys,
        rederiveAddys: false
      });

      requestStub.callCount.should.equal(1);
      sleepStub.callCount.should.equal(0);
      requestStub.args.flatMap(arg => arg[0].body).should.deep.equal(keys.map(k => ({ address: k.address })));
    });

    it('should import >100 keys', async function() {
      const keys = [];
      for (let i = 0; i < 101; i++) {
        const pk = crypto.randomBytes(32).toString('hex');
        keys.push({
          privKey: pk,
          address: libMap.BTC.PrivateKey(pk).toAddress().toString()
        });
      }
      await wallet.importKeys({
        keys,
        rederiveAddys: false
      });

      requestStub.callCount.should.equal(2);
      sleepStub.callCount.should.equal(1);
      requestStub.args.flatMap(arg => arg[0].body).should.deep.equal(keys.map(k => ({ address: k.address })));
    });
  });

  describe('signTx v2 key handling', function() {
    let txStub: sinon.SinonStub;
    afterEach(async function() {
      txStub?.restore();
    });

    describe('BTC (UTXO) decrypts ciphertext to WIF', function() {
      walletName = 'BitcoreClientTestSignTxV2-BTC';
      let wallet: Wallet;

      beforeEach(async function() {
        wallet = await Wallet.create({
          name: walletName,
          chain: 'BTC',
          network: 'testnet',
          phrase: 'snap impact summer because must pipe weasel gorilla actor acid web whip',
          password: 'abc123',
          storageType,
          baseUrl
        });
        await wallet.unlock('abc123');
      });

      afterEach(async function() {
        await Wallet.deleteWallet({ name: walletName, storageType });
      });

      it('should decrypt stored ciphertext and hand WIF to Transactions.sign', async function() {
        const pk = new CWC.BitcoreLib.PrivateKey(undefined, 'testnet');
        const address = pk.toAddress().toString();
        const privBuf = CWC.Deriver.privateKeyToBuffer('BTC', pk.toString());
        // v2 key encryption uses the key's pubKey as the IV salt (not the wallet pubKey)
        const encPriv = Encryption.encryptBuffer(privBuf, pk.publicKey.toString(), wallet.unlocked.encryptionKey).toString('hex');
        privBuf.fill(0);

        sandbox.stub(wallet.storage, 'getStoredKeys').resolves([
          {
            address,
            privKey: encPriv,
            pubKey: pk.publicKey.toString()
          }
        ]);
        sandbox.stub(wallet, 'derivePrivateKey').resolves({
          address: 'change',
          privKey: pk.toString(),
          pubKey: pk.publicKey.toString(),
          path: 'm/1/0'
        });
        sandbox.stub(wallet, 'importKeys').resolves();

        let capturedPayload;
        txStub = sandbox.stub(CWC.Transactions, 'sign').callsFake(payload => {
          capturedPayload = payload;
          return 'signed';
        });

        const utxos = [{ address, value: 1 }];
        await wallet.signTx({ tx: 'raw', utxos });

        txStub.calledOnce.should.equal(true);
        capturedPayload.keys[0].privKey.should.equal(pk.toWIF());
        capturedPayload.key.privKey.should.equal(pk.toWIF());
      });
    });

    describe('ETH (account) decrypts ciphertext to hex and skips plaintext', function() {
      walletName = 'BitcoreClientTestSignTxV2-ETH';
      let wallet: Wallet;

      beforeEach(async function() {
        wallet = await Wallet.create({
          name: walletName,
          chain: 'ETH',
          network: 'testnet',
          phrase: 'snap impact summer because must pipe weasel gorilla actor acid web whip',
          password: 'abc123',
          storageType,
          baseUrl
        });
        await wallet.unlock('abc123');
      });

      afterEach(async function() {
        await Wallet.deleteWallet({ name: walletName, storageType });
      });

      it('should decrypt stored ciphertext and hand hex privKey to Transactions.sign', async function() {
        const privHex = crypto.randomBytes(32).toString('hex');
        const privBufForPubKey = CWC.Deriver.privateKeyToBuffer('ETH', privHex);
        const pubKey = CWC.Deriver.getPublicKey('ETH', wallet.network, privBufForPubKey);
        privBufForPubKey.fill(0);
        const privBuf = CWC.Deriver.privateKeyToBuffer('ETH', privHex);
        // v2 key encryption uses the key's pubKey as the IV salt (not the wallet pubKey)
        const encPriv = Encryption.encryptBuffer(privBuf, pubKey, wallet.unlocked.encryptionKey).toString('hex');
        privBuf.fill(0);

        let capturedPayload;
        txStub = sandbox.stub(CWC.Transactions, 'sign').callsFake(payload => {
          capturedPayload = payload;
          return 'signed';
        });

        const signingKeys = [{ address: '0xabc', privKey: encPriv, pubKey }];
        await wallet.signTx({ tx: 'raw', signingKeys });

        txStub.calledOnce.should.equal(true);
        capturedPayload.keys[0].privKey.should.equal(privHex);
      });
    });
  });

  describe('getBalance', function() {
    walletName = 'BitcoreClientTestGetBalance';
    beforeEach(async function() {
      wallet = await Wallet.create({
        name: walletName,
        chain: 'MATIC',
        network: 'testnet',
        phrase: 'snap impact summer because must pipe weasel gorilla actor acid web whip',
        password: 'abc123',
        storageType: 'Level',
        version: 0,
      });
      await wallet.unlock('abc123');
    });

    it('should get correct token balance with conflicting token objects and old token object', async function() {
      // Old token object (no name)
      wallet.tokens.push({
        symbol: 'USDC',
        address: '0x123',
        decimals: '6',
      });
      wallet.tokens.push({
        symbol: 'USDC',
        address: '0xabc',
        decimals: '6',
        name: 'USDCn_m'
      });
      sinon.stub(wallet.client, 'getBalance').callsFake(async function(params) {
        switch (params.payload.tokenContractAddress) {
          case '0x123':
            return 1;
          case '0xabc':
            return 2;
          default:
            return 0;
        }
      });

      const balance1 = await wallet.getBalance({ token: 'USDC' });
      const balance2 = await wallet.getBalance({ token: 'USDC', tokenName: 'USDC_m' });
      const balance3 = await wallet.getBalance({ tokenName: 'USDCn_m' });
      const balance4 = await wallet.getBalance({ token: 'USDC', tokenName: 'USDCn_m' });
      balance1.should.equal(1);
      balance2.should.equal(1);
      balance3.should.equal(2);
      balance4.should.equal(2);
    });
  });

  describe('getTokenObj', function() {
    walletName = 'BitcoreClientTestGetTokenObj';
    beforeEach(async function() {
      wallet = await Wallet.create({
        name: walletName,
        chain: 'MATIC',
        network: 'testnet',
        phrase: 'snap impact summer because must pipe weasel gorilla actor acid web whip',
        password: 'abc123',
        storageType: 'Level',
        version: 0,
      });
      await wallet.unlock('abc123');
    });

    it('should get correct token object', async function() {
      // Old token object (no name)
      wallet.tokens.push({
        symbol: 'USDC',
        address: '0x123',
        decimals: '6',
      });
      wallet.tokens.push({
        symbol: 'USDC',
        address: '0xabc',
        decimals: '6',
        name: 'USDC.e'
      });
      const obj1 = wallet.getTokenObj({ token: 'USDC' });
      const obj2 = wallet.getTokenObj({ token: 'USDC', tokenName: 'USDC.other' }); // no object with "USDC.other"
      const obj3 = wallet.getTokenObj({ token: 'USDC', tokenName: 'USDC.e' });
      const obj4 = wallet.getTokenObj({ tokenName: 'USDC.e' });
      obj1.address.should.equal('0x123');
      obj2.address.should.equal('0x123');
      obj3.address.should.equal('0xabc');
      obj4.address.should.equal('0xabc');
    });

    it('should fallback to old token object if matching `token` is given', async function() {
      // Old token object (no name)
      wallet.tokens.push({
        symbol: 'USDC',
        address: '0x123',
        decimals: '6',
      });

      const obj1 = wallet.getTokenObj({ token: 'USDC' });
      obj1.address.should.equal('0x123');
      const obj2 = wallet.getTokenObj({ token: 'USDC', tokenName: 'USDC.e' }); // falls back
      obj2.address.should.equal('0x123');
      try {
        const obj3 = wallet.getTokenObj({ tokenName: 'USDC.e' }); // token not given, so cannot fall back
        should.not.exist(obj3);
      } catch (err) {
        err.message.should.equal('USDC.e not found on wallet ' + walletName);
      }
    });
  });

  describe('rmToken', function() {
    walletName = 'BitcoreClientTestRmToken';
    const usdcLegacyObj = {
      symbol: 'USDC',
      address: '0x123',
      decimals: '6',
    };

    const usdcObj = {
      symbol: 'USDC',
      address: '0xabc',
      decimals: '6',
      name: 'USDCn'
    };

    const daiObj = {
      symbol: 'DAI',
      address: '0x1a2b3c',
      decimals: '6',
      name: 'DAIn'
    };

    beforeEach(async function() {
      wallet = await Wallet.create({
        chain: 'ETH',
        network: 'mainnet',
        name: walletName,
        phrase: 'snap impact summer because must pipe weasel gorilla actor acid web whip',
        password: 'abc123',
        lite: false,
        storageType,
        baseUrl,
        version: 0
      });

      wallet.tokens = [
        usdcLegacyObj,
        usdcObj,
        daiObj
      ];
    });

    it('should remove a legacy token object', function() {
      wallet.rmToken({ tokenName: 'USDC' });
      wallet.tokens.length.should.equal(2);
      wallet.tokens.filter(t => t.symbol === 'USDC').length.should.equal(1);
      wallet.tokens.filter(t => t.symbol === 'USDC')[0].should.deep.equal(usdcObj);
    });

    it('should remove a token object', function() {
      wallet.rmToken({ tokenName: 'USDCn' });
      wallet.tokens.length.should.equal(2);
      wallet.tokens.filter(t => t.symbol === 'USDC').length.should.equal(1);
      wallet.tokens.filter(t => t.symbol === 'USDC')[0].should.deep.equal(usdcLegacyObj);
    });

    it('should remove the correct token object regardless of order', function() {
      wallet.tokens = [
        usdcObj,
        daiObj,
        usdcLegacyObj // this should be ordered after usdcObj
      ];

      wallet.rmToken({ tokenName: 'USDC' });
      wallet.tokens.length.should.equal(2);
      wallet.tokens.filter(t => t.symbol === 'USDC').length.should.equal(1);
      wallet.tokens.filter(t => t.symbol === 'USDC')[0].should.deep.equal(usdcObj);
    });

    it('should not remove any unmatched token object', function() {
      wallet.rmToken({ tokenName: 'BOGUS' });
      wallet.tokens.length.should.equal(3);
    });
  });
});

