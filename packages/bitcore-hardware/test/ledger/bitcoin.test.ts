import 'source-map-support/register.js';
import { createRequire } from 'module';
import { expect } from 'chai';
import { describe } from 'mocha';
import CWC from '@bitpay-labs/crypto-wallet-core';
import { HwProxy } from '../../src/index.js';

const require = createRequire(import.meta.url);
const { deviceControllerClientFactory } = require('@ledgerhq/speculos-device-controller');

const { BitcoreLib } = CWC;

describe('Ledger Bitcoin', function () {
  const deviceClient = deviceControllerClientFactory('http://localhost:5000');
  const deviceButtons = deviceClient.buttonFactory();

  before(async () => {
    await HwProxy.connect();
  });

  after(async () => {
    await HwProxy.disconnect();
  });

  it('should get matching address and publickey', async () => {
    const publicKey = await HwProxy.getPublicKey({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'BTC'
    });
    const address = await HwProxy.getAddress({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'BTC'
    });

    expect(publicKey, 'public key hex').to.match(/^0[23][0-9a-f]{64}$/i); // compressed secp256k1
    expect(address, 'address').to.be.a('string');

    const expected = BitcoreLib.Address.fromPublicKey(
      new BitcoreLib.PublicKey(publicKey),
      'livenet',
      'witnesspubkeyhash'
    ).toString();

    expect(address).to.equal(expected);
    expect(address).to.match(/^bc1q[02-9ac-hj-np-z]{38}$/); // bech32 P2WPKH format
    expect(BitcoreLib.Address.isValid(address, 'livenet')).to.be.true;
  });

  it('should sign a transaction', async () => {
    const satoshis = 100_000;
    const fee = 1000;
    const address = await HwProxy.getAddress({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'BTC'
    });
    const utxos = [
      {
        chain: 'BTC',
        network: 'mainnet',
        coinbase: false,
        mintIndex: 0,
        spentTxid: '',
        mintTxid: '78519a191327dfdc0c2ea64a04d09d87c3909ce8365d0e0c0dbd0bc80d0405b4',
        mintHeight: 957071,
        spentHeight: -2,
        address,
        script: BitcoreLib.Script.buildWitnessV0Out(address).toString(),
        value: satoshis,
        confirmations: -1
      }
    ];
    
    const tx: string = CWC.Transactions.create({
      chain: 'BTC',
      recipients: [{ address: 'bc1qm5anagcsad5kx2kuq3lv0j5zaxkxr7teuk9wfa', amount: satoshis - fee }],
      utxos
    });
    
    const signPromise = HwProxy.sign({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'BTC',
      tx,
      utxos
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    for (let i = 0; i < 2; i++) {
      await deviceButtons.right();
    }
    await deviceButtons.both();
    for (let i = 0; i < 4; i++) {
      await deviceButtons.right();
    }
    await deviceButtons.both();
    const signedTransactionHex = await signPromise;

    const signedTransaction = new BitcoreLib.Transaction(signedTransactionHex);
    expect(signedTransaction.inputs[0].prevTxId.toString('hex')).to.equal('78519a191327dfdc0c2ea64a04d09d87c3909ce8365d0e0c0dbd0bc80d0405b4');
    expect(signedTransaction.outputs[0].satoshis).to.equal(satoshis - fee);
    expect(signedTransaction.verify()).to.be.true;
  });
});
