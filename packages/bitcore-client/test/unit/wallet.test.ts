import sinon from 'sinon';
import chai from 'chai';
import * as CWC from 'crypto-wallet-core';
import { Wallet, AddressTypes } from '../../src/wallet';
import { Client } from '../../src/client';


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
  let walletName;
  let wallet: Wallet;
  beforeEach(function() {
    sandbox.stub(Client.prototype, 'register').resolves();
  });
  afterEach(async function() {
    await Wallet.deleteWallet({ name: walletName, storageType });
    sandbox.restore();
  });
  for (const chain of ['BTC', 'BCH', 'LTC', 'DOGE', 'ETH', 'XRP', 'MATIC']) {
    for (const addressType of Object.keys(AddressTypes[chain] || { 'pubkeyhash': 1 })) {
      if (addressType === 'p2tr' || addressType === 'taproot') {
        continue;
      }
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
          storageType
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
        sandbox.stub(wallet, 'getTransactionByTxid').resolves({"_id":"65982807d85e75f781a0d56f","txid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","network":"regtest","chain":"BTC","blockHeight":-1,"blockHash":"","blockTime":"2024-01-05T16:02:15.678Z","blockTimeNormalized":"2024-01-05T16:02:15.678Z","coinbase":false,"locktime":-1,"inputCount":5,"outputCount":1,"size":780,"fee":2409,"value":950891,"confirmations":0,"coins":{"inputs":[{"_id":"659825bed85e75f781a01812","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":1,"spentTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintTxid":"330716a75c23512202e45ffee478bdce7a33f298edf7eef30a42dbde06746c48","mintHeight":154,"spentHeight":-1,"address":"n2vpyzbBPBEni9FgkeQSnXvAQAfnRmKxFZ","script":"76a914eade85745090388e64a9341a82d8f94371430d1a88ac","value":244000,"confirmations":-1,"sequenceNumber":4294967293},{"_id":"65982587d85e75f781a0046f","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":1,"spentTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintTxid":"7b83f82a22f94fc3e615743a5e6fb2345ed79aad8a2b564af2ace49da1e27ebb","mintHeight":152,"spentHeight":-1,"address":"muEU9KaNEw5doymy59ScrgEE3Eq4CQ45U9","script":"76a91496739b4ef4e793c05a78624da38d96f2c4059c6b88ac","value":239400,"confirmations":-1,"sequenceNumber":4294967293},{"_id":"65982511d85e75f7819fdd40","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":0,"spentTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintTxid":"fb4d8039024c80a655fea29e01faf202f30e936af5738e31c5841a84215ca4d6","mintHeight":149,"spentHeight":-1,"address":"muEU9KaNEw5doymy59ScrgEE3Eq4CQ45U9","script":"76a91496739b4ef4e793c05a78624da38d96f2c4059c6b88ac","value":239400,"confirmations":-1,"sequenceNumber":4294967293},{"_id":"659824d7d85e75f7819fc75d","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":0,"spentTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintTxid":"8221ed6891f6ba82ab72bb8298a661e21b47b04408861b0c3268c4a04a0435b3","mintHeight":145,"spentHeight":-1,"address":"miEzS8fSvtDjwkEjY14FEuWumFKg8nTPV9","script":"76a9141de381fc20d34d20e11a5543f536a4b74f495a9888ac","value":228000,"confirmations":-1,"sequenceNumber":4294967293},{"_id":"65982389d85e75f7819f57ff","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":0,"spentTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintTxid":"95f713c2d7e09ab57ec3016bb767b26e6ee849cf487e86d8ed6126ae1b893e0f","mintHeight":143,"spentHeight":-1,"address":"msnM9VB5usfBahZNo57ZUq9uzwRxQXksUz","script":"76a914868ad3308906626182d1c6cd703cc7ce78b3a28d88ac","value":2500,"confirmations":-1,"sequenceNumber":4294967293}],"outputs":[{"_id":"65982807d85e75f781a0d55d","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":0,"spentTxid":"","mintTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintHeight":-1,"spentHeight":-2,"address":"mwwrGzk9q8xugY97C8BiNbcgqXNyjH4kp8","script":"76a914b4376347e4cffb1e9a475b2661bbe74de3c1f86a88ac","value":950891,"confirmations":-1}]}})
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
        expect(newTx).to.equal('0200000005486c7406dedb420af3eef7ed98f2337acebd78e4fe5fe4022251235ca71607330100000000fdffffffbb7ee2a19de4acf24a562b8aad9ad75e34b26f5e3a7415e6c34ff9222af8837b0100000000fdffffffd6a45c21841a84c5318e73f56a930ef302f2fa019ea2fe55a6804c0239804dfb0000000000fdffffffb335044aa0c468320c1b860844b0471be261a69882bb72ab82baf69168ed21820000000000fdffffff0f3e891bae2661edd8867e48cf49e86e6eb267b76b01c37eb59ae0d7c213f7950000000000fdffffff01f1bf0d00000000001976a914b4376347e4cffb1e9a475b2661bbe74de3c1f86a88ac00000000');
      });

      it('should bump the fee of a transaction with feeRate', async function() {
        sandbox.stub(wallet, 'getTransactionByTxid').resolves({"_id":"65982807d85e75f781a0d56f","txid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","network":"regtest","chain":"BTC","blockHeight":-1,"blockHash":"","blockTime":"2024-01-05T16:02:15.678Z","blockTimeNormalized":"2024-01-05T16:02:15.678Z","coinbase":false,"locktime":-1,"inputCount":5,"outputCount":1,"size":780,"fee":2409,"value":950891,"confirmations":0,"coins":{"inputs":[{"_id":"659825bed85e75f781a01812","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":1,"spentTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintTxid":"330716a75c23512202e45ffee478bdce7a33f298edf7eef30a42dbde06746c48","mintHeight":154,"spentHeight":-1,"address":"n2vpyzbBPBEni9FgkeQSnXvAQAfnRmKxFZ","script":"76a914eade85745090388e64a9341a82d8f94371430d1a88ac","value":244000,"confirmations":-1,"sequenceNumber":4294967293},{"_id":"65982587d85e75f781a0046f","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":1,"spentTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintTxid":"7b83f82a22f94fc3e615743a5e6fb2345ed79aad8a2b564af2ace49da1e27ebb","mintHeight":152,"spentHeight":-1,"address":"muEU9KaNEw5doymy59ScrgEE3Eq4CQ45U9","script":"76a91496739b4ef4e793c05a78624da38d96f2c4059c6b88ac","value":239400,"confirmations":-1,"sequenceNumber":4294967293},{"_id":"65982511d85e75f7819fdd40","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":0,"spentTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintTxid":"fb4d8039024c80a655fea29e01faf202f30e936af5738e31c5841a84215ca4d6","mintHeight":149,"spentHeight":-1,"address":"muEU9KaNEw5doymy59ScrgEE3Eq4CQ45U9","script":"76a91496739b4ef4e793c05a78624da38d96f2c4059c6b88ac","value":239400,"confirmations":-1,"sequenceNumber":4294967293},{"_id":"659824d7d85e75f7819fc75d","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":0,"spentTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintTxid":"8221ed6891f6ba82ab72bb8298a661e21b47b04408861b0c3268c4a04a0435b3","mintHeight":145,"spentHeight":-1,"address":"miEzS8fSvtDjwkEjY14FEuWumFKg8nTPV9","script":"76a9141de381fc20d34d20e11a5543f536a4b74f495a9888ac","value":228000,"confirmations":-1,"sequenceNumber":4294967293},{"_id":"65982389d85e75f7819f57ff","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":0,"spentTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintTxid":"95f713c2d7e09ab57ec3016bb767b26e6ee849cf487e86d8ed6126ae1b893e0f","mintHeight":143,"spentHeight":-1,"address":"msnM9VB5usfBahZNo57ZUq9uzwRxQXksUz","script":"76a914868ad3308906626182d1c6cd703cc7ce78b3a28d88ac","value":2500,"confirmations":-1,"sequenceNumber":4294967293}],"outputs":[{"_id":"65982807d85e75f781a0d55d","chain":"BTC","network":"regtest","coinbase":false,"mintIndex":0,"spentTxid":"","mintTxid":"8b78e4d2ac2211472454f940445210b6487aaa0f889e18066eb3f623352607f5","mintHeight":-1,"spentHeight":-2,"address":"mwwrGzk9q8xugY97C8BiNbcgqXNyjH4kp8","script":"76a914b4376347e4cffb1e9a475b2661bbe74de3c1f86a88ac","value":950891,"confirmations":-1}]}})
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
        expect(newTx).to.equal('0200000005486c7406dedb420af3eef7ed98f2337acebd78e4fe5fe4022251235ca71607330100000000fdffffffbb7ee2a19de4acf24a562b8aad9ad75e34b26f5e3a7415e6c34ff9222af8837b0100000000fdffffffd6a45c21841a84c5318e73f56a930ef302f2fa019ea2fe55a6804c0239804dfb0000000000fdffffffb335044aa0c468320c1b860844b0471be261a69882bb72ab82baf69168ed21820000000000fdffffff0f3e891bae2661edd8867e48cf49e86e6eb267b76b01c37eb59ae0d7c213f7950000000000fdffffff018e850e00000000001976a914b4376347e4cffb1e9a475b2661bbe74de3c1f86a88ac00000000');
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
        sandbox.stub(wallet, 'getTransactionByTxid').resolves({"txid":"0x0cf410cfe7fb268ad06ae115edfa8a30a8dea3979336a647b09b5a789c4b53d5","network":"regtest","chain":"ETH","blockHeight":43245,"blockHash":"0x9edb8d10883a360f7ff0c26860b6a159f5b7a74226949a4365691a879fafcdfc","blockTime":"2024-01-08T16:31:46.000Z","blockTimeNormalized":"2024-01-08T16:31:46.000Z","fee":42000000000000,"value":1000000000000000000,"gasLimit":200000,"gasPrice":2000000000,"nonce":0,"to":"0x7ee308b49e36Ab516cd0186B3a47CFD31d2499A1","from":"0x5FbdD2712d05D1a73e0b3Eba5efE8c3d42a336C3","effects":[],"data":"0x","internal":[],"calls":[],"confirmations":33})
        sandbox.stub(wallet, 'getNetworkFee').resolves({ feerate: 26550000000, blocks: 2 }); // this is a real response from mainnet
        sandbox.stub(wallet.client, 'importAddresses').resolves();

        const { tx: newTx, params } = await wallet.bumpTxFee({
          txid: '0x0cf410cfe7fb268ad06ae115edfa8a30a8dea3979336a647b09b5a789c4b53d5',
          feeTarget: 2
        });
        params.gasPrice.should.equal(26550000000);
        expect(newTx).to.equal('0xed8085062e80d98083030d40947ee308b49e36ab516cd0186b3a47cfd31d2499a1880de0b6b3a764000080058080');
      });

      it('should bump the fee of a transaction with feeRate', async function() {
        sandbox.stub(wallet, 'getTransactionByTxid').resolves({"txid":"0x0cf410cfe7fb268ad06ae115edfa8a30a8dea3979336a647b09b5a789c4b53d5","network":"regtest","chain":"ETH","blockHeight":43245,"blockHash":"0x9edb8d10883a360f7ff0c26860b6a159f5b7a74226949a4365691a879fafcdfc","blockTime":"2024-01-08T16:31:46.000Z","blockTimeNormalized":"2024-01-08T16:31:46.000Z","fee":42000000000000,"value":1000000000000000000,"gasLimit":200000,"gasPrice":2000000000,"nonce":0,"to":"0x7ee308b49e36Ab516cd0186B3a47CFD31d2499A1","from":"0x5FbdD2712d05D1a73e0b3Eba5efE8c3d42a336C3","effects":[],"data":"0x","internal":[],"calls":[],"confirmations":33})
        sandbox.stub(wallet.client, 'importAddresses').resolves();
    
        const { tx: newTx, params } = await wallet.bumpTxFee({
          txid: '0x0cf410cfe7fb268ad06ae115edfa8a30a8dea3979336a647b09b5a789c4b53d5',
          feeRate: 300
        });
        params.gasPrice.should.equal(CWC.Web3.utils.toWei('300', 'gwei'));
        expect(newTx).to.equal('0xed808545d964b80083030d40947ee308b49e36ab516cd0186b3a47cfd31d2499a1880de0b6b3a764000080058080');
      });
    });
  });
});

