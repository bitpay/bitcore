import 'source-map-support/register.js';
import { createRequire } from 'module';
import { expect } from 'chai';
import { describe } from 'mocha';
import { HwProxy } from '../../src/index.js';
import CWC from '@bitpay-labs/crypto-wallet-core';

const require = createRequire(import.meta.url);
const { deviceControllerClientFactory } = require('@ledgerhq/speculos-device-controller');

const { BitcoreLibDoge } = CWC;

describe('Ledger Dogecoin', function () {
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
      vendor: 'ledger',
      connection: 'speculos',
      chain: 'DOGE'
    });
    const address = await HwProxy.getAddress({
      vendor: 'ledger',
      connection: 'speculos',
      chain: 'DOGE'
    });

    expect(publicKey, 'public key hex').to.match(/^0[23][0-9a-f]{64}$/i); // compressed secp256k1
    expect(address, 'address').to.be.a('string');

    const expected = BitcoreLibDoge.Address.fromPublicKey(
      new BitcoreLibDoge.PublicKey(publicKey),
      'livenet',
      'pubkeyhash'
    ).toString();

    expect(address).to.equal(expected);
    expect(address).to.match(/^D[1-9A-HJ-NP-Za-km-z]{33}$/); // base58check P2PKH format
    expect(BitcoreLibDoge.Address.isValid(address, 'livenet')).to.be.true;
  });

  it('should sign a transaction', async () => {
    const ledgerAddress = await HwProxy.getAddress({
      vendor: 'ledger',
      connection: 'speculos',
      chain: 'DOGE'
    });
    const receivingAddress = new BitcoreLibDoge.PrivateKey().toAddress().toString();
      
    const fee = 362;
    const satoshis = 100_000;
    const fundingTx = new BitcoreLibDoge.Transaction()
      .addInput(
        new BitcoreLibDoge.Transaction.Input({
          outputIndex: 0,
          script: '',
          prevTxId: '1111111111111111111111111111111111111111111111111111111111111111',
          output: new BitcoreLibDoge.Transaction.Output({
            script: '',
            satoshis
          })
        })
      )
      .addOutput(
        new BitcoreLibDoge.Transaction.Output({
          satoshis,
          script: new BitcoreLibDoge.Script.buildPublicKeyHashOut(ledgerAddress)
        })
      );


    const utxos = [
      {
        chain: 'DOGE',
        network: 'mainnet',
        coinbase: false,
        mintIndex: 0,
        spentTxid: '',
        mintTxid: fundingTx.id,
        mintHeight: -1,
        spentHeight: -2,
        address: ledgerAddress,
        script: BitcoreLibDoge.Script.fromAddress(ledgerAddress).toString(),
        value: satoshis,
        confirmations: -1
      }
    ];

    const tx: string = CWC.Transactions.create({
      chain: 'DOGE',
      recipients: [{ address: receivingAddress, amount: satoshis - fee }],
      utxos,
      fee
    });

    const signPromise = HwProxy.sign({
      vendor: 'ledger',
      connection: 'speculos',
      chain: 'DOGE',
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

    const signedTransaction = new BitcoreLibDoge.Transaction(signedTransactionHex);
    expect(signedTransaction.inputs[0].prevTxId.toString('hex')).to.equal('f6621a398c9db70a1a2120507108770ef3a9782c281b93a1c4161cbfdb2db116');
    expect(signedTransaction.outputs[0].satoshis).to.equal(satoshis - fee);
    expect(signedTransaction.verify()).to.be.true;
  });
});
