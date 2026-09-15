import 'source-map-support/register.js';
import { createRequire } from 'module';
import { expect } from 'chai';
import { describe } from 'mocha';
import Ledger from '../../src/ledger/wallet.js';
import CWC from '@bitpay-labs/crypto-wallet-core';

const require = createRequire(import.meta.url);
const { deviceControllerClientFactory } = require('@ledgerhq/speculos-device-controller');

const { SolKit } = CWC;

describe('Ledger Solana', function () {
  const ledger = new Ledger({ transport: 'speculos', apiPort: 5002 });
  const deviceClient = deviceControllerClientFactory('http://localhost:5002');
  const deviceButtons = deviceClient.buttonFactory();

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

  it('should sign a transaction', async () => {
    const address = await ledger.getAddress({ chain: 'SOL' });
    const tx = CWC.Transactions.create({
      network: 'livenet',
      chain: 'SOL',
      recipients: [{ address: 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY', amount: 3896000000000000 }],
      from: address,
      blockHeight: 531_575,
      blockHash: 'GtV1Hb3FvP3HURHAsj8mGwEqCumvP3pv3i6CVCzYNj3d',
      category: 'transfer'
    });
    
    const signedTransactionBase64 = await ledger.sign({
      chain: 'SOL',
      tx
    }).then(new Promise(resolve => setTimeout(resolve, 1500))
      .then(async () => {
        for (let i = 0; i < 3; i++) {
          await deviceButtons.right();
        }
        await deviceButtons.both();
      })
    );

    const wireTransactionBytes = SolKit.getBase64Encoder().encode(signedTransactionBase64);
    const transaction = SolKit.getTransactionDecoder().decode(wireTransactionBytes);
    const signature = SolKit.getSignatureFromTransaction(transaction);
    
    expect(SolKit.isSignature(signature)).to.be.true;
  });
});
