import 'source-map-support/register.js';
import { createRequire } from 'module';
import { expect } from 'chai';
import { describe } from 'mocha';
import Ledger from '../../src/ledger/wallet.js';

const require = createRequire(import.meta.url);
const { deviceControllerClientFactory } = require('@ledgerhq/speculos-device-controller');

describe('Ledger', function () {
  const deviceClient = deviceControllerClientFactory('http://localhost:5000');
  const deviceButtons = deviceClient.buttonFactory();
  const ledger = new Ledger();

  before(async () => {
    await ledger.connect();
  });

  after(async () => {
    await ledger.disconnect();
  });

  it('should scroll', async () => {
    await deviceButtons.right();    
    await deviceButtons.left();    
  });

  it('should be able to validate chain', async () => {
    for (const chain of ['BTC', 'BCH', 'DOGE', 'LTC', 'ETH', 'SOL']) {
      expect(Ledger.isValidChain(chain)).to.be.true;
    }
    expect(Ledger.isValidChain('not a chain name')).to.be.false;
    expect(Ledger.isValidChain('btc')).to.be.false;
    expect(Ledger.isValidChain(' BTC')).to.be.false;
  });
  
  it('should be able to get version', async () => {
    // TODO: get version
  });
});
