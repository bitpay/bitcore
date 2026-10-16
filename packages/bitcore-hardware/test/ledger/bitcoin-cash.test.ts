import 'source-map-support/register.js';
import { createRequire } from 'module';
import { expect } from 'chai';
import { describe } from 'mocha';
import Ledger from '../../src/ledger/wallet.js';
import CWC from '@bitpay-labs/crypto-wallet-core';

const require = createRequire(import.meta.url);
const { deviceControllerClientFactory } = require('@ledgerhq/speculos-device-controller');

const { BitcoreLibCash } = CWC;

describe('Ledger Bitcoin Cash', function () {
  const deviceClient = deviceControllerClientFactory('http://localhost:5003');
  const deviceButtons = deviceClient.buttonFactory();
  const ledger = new Ledger({ transport: 'speculos' });
  
  before(async () => {
    await ledger.connect();
  });
  
  after(async () => {
    await ledger.disconnect();
  });


  it('should get address and publickey', async () => {
    const publicKey = await ledger.getPublicKey({ chain: 'BCH' });
    const address = await ledger.getAddress({ chain: 'BCH' });

    expect(BitcoreLibCash.Address.fromPublicKey(new BitcoreLibCash.PublicKey(publicKey), 'livenet', 'pubkeyhash').toString()).to.equal(address);
  });

  it('should sign a transaction', async () => {
    const ledgerAddress = await ledger.getAddress({ chain: 'BCH' });
    const receivingAddress = new BitcoreLibCash.PrivateKey().toAddress().toString();
      
    const fee = 362;
    const satoshis = 100_000;
    const fundingTx = new BitcoreLibCash.Transaction()
      .addInput(
        new BitcoreLibCash.Transaction.Input({
          outputIndex: 0,
          script: '',
          prevTxId: '1111111111111111111111111111111111111111111111111111111111111111',
          output: new BitcoreLibCash.Transaction.Output({
            script: '',
            satoshis
          })
        })
      )
      .addOutput(
        new BitcoreLibCash.Transaction.Output({
          satoshis,
          script: new BitcoreLibCash.Script.buildPublicKeyHashOut(ledgerAddress)
        })
      );


    const utxos = [
      {
        chain: 'BCH',
        network: 'mainnet',
        coinbase: false,
        mintIndex: 0,
        spentTxid: '',
        mintTxid: fundingTx.id,
        mintHeight: -1,
        spentHeight: -2,
        address: ledgerAddress,
        script: BitcoreLibCash.Script.fromAddress(ledgerAddress).toString(),
        value: satoshis,
        confirmations: -1
      }
    ];

    const tx: string = CWC.Transactions.create({
      chain: 'BCH',
      recipients: [{ address: receivingAddress, amount: satoshis - fee }],
      utxos,
      fee
    });

    const signedTransactionHex = await ledger.sign({
      chain: 'BCH',
      tx,
      utxos,
      prevTxs: [fundingTx.toString()]
    }).then(new Promise(resolve => setTimeout(resolve, 1500))
      .then(async () => {
        for (let i = 0; i < 3; i++) {
          await deviceButtons.right();
        }
        await deviceButtons.both();
        for (let i = 0; i < 2; i++) {
          await deviceButtons.right();
        }
        await deviceButtons.both();
      })
    );

    const signedTransaction = new BitcoreLibCash.Transaction(signedTransactionHex);
    expect(signedTransaction.inputs[0].prevTxId.toString('hex')).to.equal('6e4f2edc3bdcccca1846bb4cdd9436f7f760bac7dcefb70ae7c3bcc11a0e7ec2');
    expect(signedTransaction.outputs[0].satoshis).to.equal(satoshis - fee);
    expect(signedTransaction.verify()).to.be.true;
  });
});
