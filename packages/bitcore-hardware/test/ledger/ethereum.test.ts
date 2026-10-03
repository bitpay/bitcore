import 'source-map-support/register.js';
import { createRequire } from 'module';
import { expect } from 'chai';
import { describe } from 'mocha';
import Ledger from '../../src/ledger/wallet.js';
import CWC from '@bitpay-labs/crypto-wallet-core';

const require = createRequire(import.meta.url);
const { deviceControllerClientFactory } = require('@ledgerhq/speculos-device-controller');

const { ethers } = CWC;

describe('Ledger Ethereum', function () {
  const ledger = new Ledger({ transport: 'speculos', apiPort: 5001 });
  const deviceClient = deviceControllerClientFactory('http://localhost:5001');
  const deviceButtons = deviceClient.buttonFactory();

  before(async () => {
    await ledger.connect();
  });

  after(async () => {
    await ledger.disconnect();
  });

  it('should get address and publickey', async () => {
    const publicKey = await ledger.getPublicKey({ chain: 'ETH' });
    const address = await ledger.getAddress({ chain: 'ETH' });
  
    expect(ethers.computeAddress('0x' + publicKey)).to.equal(address);
    expect(ethers.isAddress(address)).to.be.true;
  });

  it('should sign a transaction', async () => {
    const tx = CWC.Transactions.create({
      chain: 'ETH',
      recipients: [{ address: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A', amount: 3896000000000000 }],
      nonce: 0,
      gasPrice: 21000,
      data: '0x'
    });
    
    const signedTransactionHex = await ledger.sign({
      chain: 'ETH',
      tx
    }).then(new Promise(resolve => setTimeout(resolve, 1500))
      .then(async () => {
        for (let i = 0; i < 5; i++) {
          await deviceButtons.right();
        }
        await deviceButtons.both();
      })
    );

    const signedTransaction = ethers.Transaction.from(signedTransactionHex);
    expect(signedTransaction.to).to.equal('0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A');
    expect(signedTransaction.data).to.equal('0x');
    expect(signedTransaction.nonce).to.equal(0);
    expect(signedTransaction.gasLimit).to.equal(0n);
    expect(signedTransaction.gasPrice).to.equal(21000n);
    expect(signedTransaction.value).to.equal(3896000000000000n);
    expect(signedTransaction.chainId).to.equal(1n);

    const address = signedTransaction.from;
    const expectedAddress = await ledger.getAddress({ chain: 'ETH' });

    expect(address).to.equal(expectedAddress);
  });
});
