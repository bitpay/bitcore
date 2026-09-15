import 'source-map-support/register.js';
import { expect } from 'chai';
import { describe } from 'mocha';
import Ledger from '../../src/ledger/wallet.js';
import CWC from '@bitpay-labs/crypto-wallet-core';

const { ethers } = CWC;

describe('Ledger Ethereum', function () {
  const ledger = new Ledger({ transport: 'speculos', apiPort: 5001 });

  before(async () => {
    await ledger.connect();
  });

  after(async () => {
    await ledger.disconnect();
  });

  it('should get address and publickey ethereum', async () => {
    const publicKey = await ledger.getPublicKey({ chain: 'ETH' });
    const address = await ledger.getAddress({ chain: 'ETH' });
  
    expect(ethers.computeAddress('0x' + publicKey)).to.equal(address);
  });
});
