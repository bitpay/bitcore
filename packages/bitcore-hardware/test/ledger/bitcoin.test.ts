import 'source-map-support/register.js';
import { createRequire } from 'module';
import { expect } from 'chai';
import { describe } from 'mocha';
import Ledger from '../../src/ledger/wallet.js';
import CWC from '@bitpay-labs/crypto-wallet-core';

const require = createRequire(import.meta.url);
const { deviceControllerClientFactory } = require('@ledgerhq/speculos-device-controller');

const { BitcoreLib } = CWC;

describe('Ledger Bitcoin', function () {
  const deviceClient = deviceControllerClientFactory('http://localhost:5000');
  const deviceButtons = deviceClient.buttonFactory();
  const ledger = new Ledger({ transport: 'speculos' });

  before(async () => {
    await ledger.connect();
  });

  after(async () => {
    await ledger.disconnect();
  });

  it('should get address and publickey', async () => {
    const publicKey = await ledger.getPublicKey({ chain: 'BTC' });
    const address = await ledger.getAddress({ chain: 'BTC' });

    expect(BitcoreLib.Address.fromPublicKey(new BitcoreLib.PublicKey(publicKey), 'livenet', 'witnesspubkeyhash').toString()).to.equal(address);
  });

  it('should sign a transaction', async () => {
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
        address: await ledger.getAddress({ chain: 'BTC' }),
        script: BitcoreLib.Script.buildWitnessV0Out(new BitcoreLib.Address('bc1qqtl9jlrwcr3fsfcjj2du7pu6fcgaxl5dsw2vyg')).toString(),
        value: 1562,
        confirmations: -1
      }
    ];
    
    const tx: string = CWC.Transactions.create({
      chain: 'BTC',
      recipients: [{ address: 'bc1qm5anagcsad5kx2kuq3lv0j5zaxkxr7teuk9wfa', amount: 1200 }],
      utxos
    });
    
    const signedTransactionHex = await ledger.sign({
      chain: 'BTC',
      tx,
      utxos
    }).then(new Promise(resolve => setTimeout(resolve, 1500))
      .then(async () => {
        for (let i = 0; i < 2; i++) {
          await deviceButtons.right();
        }
        await deviceButtons.both();
        for (let i = 0; i < 4; i++) {
          await deviceButtons.right();
        }
        await deviceButtons.both();
      })
    );

    const signedTransaction = new BitcoreLib.Transaction(signedTransactionHex);
    expect(signedTransaction.inputs[0].prevTxId.toString('hex')).to.equal('78519a191327dfdc0c2ea64a04d09d87c3909ce8365d0e0c0dbd0bc80d0405b4');
    expect(signedTransaction.outputs[0].satoshis).to.equal(1200);
    expect(signedTransaction.verify()).to.be.true;
  });
});
