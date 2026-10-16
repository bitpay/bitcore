import 'source-map-support/register.js';
import { createRequire } from 'module';
import { expect } from 'chai';
import { describe } from 'mocha';
import { HwProxy } from '../../src/index.js';
import CWC from '@bitpay-labs/crypto-wallet-core';

const require = createRequire(import.meta.url);
const { deviceControllerClientFactory } = require('@ledgerhq/speculos-device-controller');

const { BitcoreLibLtc } = CWC;

describe('Ledger Litecoin', function () {
  const deviceClient = deviceControllerClientFactory('http://localhost:5005');
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
      chain: 'LTC'
    });
    const address = await HwProxy.getAddress({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'LTC'
    });

    expect(publicKey, 'public key hex').to.match(/^0[23][0-9a-f]{64}$/i); // compressed secp256k1
    expect(address, 'address').to.be.a('string');

    const expected = BitcoreLibLtc.Address.fromPublicKey(
      new BitcoreLibLtc.PublicKey(publicKey),
      'livenet',
      'pubkeyhash'
    ).toString();

    expect(address).to.equal(expected);
    expect(address).to.match(/^L[1-9A-HJ-NP-Za-km-z]{33}$/); // base58check P2PKH format
    expect(BitcoreLibLtc.Address.isValid(address, 'livenet')).to.be.true;
  });

  it('should sign a transaction', async () => {
    const ledgerAddress = await HwProxy.getAddress({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'LTC'
    });
    const receivingAddress = new BitcoreLibLtc.PrivateKey().toAddress().toString();
      
    const fee = 362;
    const satoshis = 100_000;
    const fundingTx = new BitcoreLibLtc.Transaction()
      .addInput(
        new BitcoreLibLtc.Transaction.Input({
          outputIndex: 0,
          script: '',
          prevTxId: '1111111111111111111111111111111111111111111111111111111111111111',
          output: new BitcoreLibLtc.Transaction.Output({
            script: '',
            satoshis
          })
        })
      )
      .addOutput(
        new BitcoreLibLtc.Transaction.Output({
          satoshis,
          script: new BitcoreLibLtc.Script.buildPublicKeyHashOut(ledgerAddress)
        })
      );


    const utxos = [
      {
        chain: 'LTC',
        network: 'mainnet',
        coinbase: false,
        mintIndex: 0,
        spentTxid: '',
        mintTxid: fundingTx.id,
        mintHeight: -1,
        spentHeight: -2,
        address: ledgerAddress,
        script: BitcoreLibLtc.Script.fromAddress(ledgerAddress).toString(),
        value: satoshis,
        confirmations: -1
      }
    ];

    const tx: string = CWC.Transactions.create({
      chain: 'LTC',
      recipients: [{ address: receivingAddress, amount: satoshis - fee }],
      utxos,
      fee
    });

    const signPromise = HwProxy.sign({
      wallet: 'ledger',
      transport: 'speculos',
      chain: 'LTC',
      tx,
      utxos,
      prevTxs: [fundingTx.toString()]
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    for (let i = 0; i < 3; i++) {
      await deviceButtons.right();
    }
    await deviceButtons.both();
    for (let i = 0; i < 2; i++) {
      await deviceButtons.right();
    }
    await deviceButtons.both();
    const signedTransactionHex = await signPromise;

    const signedTransaction = new BitcoreLibLtc.Transaction(signedTransactionHex);
    expect(signedTransaction.inputs[0].prevTxId.toString('hex')).to.equal('481f2ddb2de5fb0f7871c34ace822e78a5282cfdbec0b23b9a4b72991a897038');
    expect(signedTransaction.outputs[0].satoshis).to.equal(satoshis - fee);
    expect(signedTransaction.verify()).to.be.true;
  });
});
