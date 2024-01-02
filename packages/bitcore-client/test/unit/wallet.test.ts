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
});
