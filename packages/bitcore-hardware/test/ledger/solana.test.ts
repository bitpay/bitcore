import 'source-map-support/register.js';
import { expect } from 'chai';
import { describe } from 'mocha';
import Ledger from '../../src/ledger/wallet.js';
import CWC from '@bitpay-labs/crypto-wallet-core';

const { SolKit } = CWC;

describe('Ledger Solana', function () {
  const ledger = new Ledger({ transport: 'speculos', apiPort: 5002 });

  before(async () => {
    await ledger.connect();
  });

  after(async () => {
    await ledger.disconnect();
  });

  it('should get address and publickey', async () => {
    const publicKey = await ledger.getPublicKey({ chain: 'SOL' });
    const address = await ledger.getAddress({ chain: 'SOL' });

    expect(publicKey).to.equal(address);
    expect(SolKit.isAddress(address)).to.be.true;
  });
});
