import 'source-map-support/register.js';
import { createRequire } from 'module';
import { expect } from 'chai';
import { describe } from 'mocha';
import { HwProxy } from '../../src/index.js';
import CWC from '@bitpay-labs/crypto-wallet-core';

const require = createRequire(import.meta.url);
const { deviceControllerClientFactory } = require('@ledgerhq/speculos-device-controller');

const { ethers } = CWC;

describe('Ledger Ethereum', function () {
  const deviceClient = deviceControllerClientFactory('http://localhost:5001');
  const deviceButtons = deviceClient.buttonFactory();

  before(async () => {
    await HwProxy.connect();
  });

  after(async () => {
    await HwProxy.disconnect();
  });

  it('should get address and publickey', async () => {
    const publicKey = await HwProxy.getPublicKey({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'ETH'
    });
    const address = await HwProxy.getAddress({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'ETH'
    });

    expect(publicKey, 'public key hex').to.match(/^04[0-9a-f]{128}$/i); // uncompressed secp256k1 (65 bytes)
    expect(address, 'address').to.match(/^0x[0-9a-fA-F]{40}$/);
    expect(ethers.getAddress(address), 'EIP-55 checksum').to.equal(address);

    expect(ethers.computeAddress('0x' + publicKey)).to.equal(address);
    expect(ethers.isAddress(address)).to.be.true;
  });

  it('should sign a transaction', async () => {
    const amount = 3896000000000000;
    const tx = CWC.Transactions.create({
      chain: 'ETH',
      recipients: [{ address: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A', amount }],
      nonce: 0,
      gasPrice: 21000,
      data: '0x'
    });
    
    const signPromise = HwProxy.sign({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'ETH',
      tx
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    for (let i = 0; i < 5; i++) {
      await deviceButtons.right();
    }
    await deviceButtons.both();
    const signedTransactionHex = await signPromise;

    const signedTransaction = ethers.Transaction.from(signedTransactionHex);
    expect(signedTransaction.to).to.equal('0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A');
    expect(signedTransaction.data).to.equal('0x');
    expect(signedTransaction.nonce).to.equal(0);
    expect(signedTransaction.gasLimit).to.equal(0n);
    expect(signedTransaction.gasPrice).to.equal(21000n);
    expect(signedTransaction.value).to.equal(BigInt(amount));
    expect(signedTransaction.chainId).to.equal(1n);

    const address = signedTransaction.from;
    const expectedAddress = await HwProxy.getAddress({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'ETH'
    });

    expect(address).to.equal(expectedAddress);
  });
});
