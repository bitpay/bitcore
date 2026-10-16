import 'source-map-support/register.js';
import { createRequire } from 'module';
import { expect } from 'chai';
import { describe } from 'mocha';
import { HwProxy } from '../../src/index.js';
import CWC from '@bitpay-labs/crypto-wallet-core';

const require = createRequire(import.meta.url);
const { deviceControllerClientFactory } = require('@ledgerhq/speculos-device-controller');

const { SolKit } = CWC;

describe('Ledger Solana', function () {
  const deviceClient = deviceControllerClientFactory('http://localhost:5002');
  const deviceButtons = deviceClient.buttonFactory();

  before(async () => {
    await HwProxy.connect();
  });

  after(async () => {
    await HwProxy.disconnect();
  });

  it('should get address/publickey', async () => {
    const publicKey = await HwProxy.getPublicKey({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'SOL'
    });
    const address = await HwProxy.getAddress({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'SOL'
    });

    expect(publicKey).to.equal(address);
    expect(address, 'address').to.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/); // base58
    expect(SolKit.getBase58Encoder().encode(address).byteLength, 'decoded key length').to.equal(32); // ed25519 public key
    expect(SolKit.isAddress(address)).to.be.true;
  });

  it('should sign a transaction', async () => {
    const address = await HwProxy.getAddress({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'SOL'
    });
    const tx = CWC.Transactions.create({
      network: 'livenet',
      chain: 'SOL',
      recipients: [{ address: 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY', amount: 3896000000000000 }],
      from: address,
      blockHeight: 531_575,
      blockHash: 'GtV1Hb3FvP3HURHAsj8mGwEqCumvP3pv3i6CVCzYNj3d',
      category: 'transfer'
    });
    
    const signPromise = HwProxy.sign({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'SOL',
      tx
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    for (let i = 0; i < 3; i++) {
      await deviceButtons.right();
    }
    await deviceButtons.both();
    const signedTransactionBase64 = await signPromise;

    const wireTransactionBytes = SolKit.getBase64Encoder().encode(signedTransactionBase64);
    const transaction = SolKit.getTransactionDecoder().decode(wireTransactionBytes);
    const signature = SolKit.getSignatureFromTransaction(transaction);
    
    expect(SolKit.isSignature(signature)).to.be.true;
  });
});
