import sinon from 'sinon';
import { expect } from 'chai';
import CWC, { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import Burner from '../../src/burner.js';

const { PrivateKey, crypto, Transaction, Script } = BitcoreLib;

describe('Burner Signing', function () {
  const sandbox = sinon.createSandbox();
  const burner = new Burner('BTC');
  const privateKey = new PrivateKey();
  const publicKey = privateKey.toPublicKey();

  before(function () {
    this.timeout(5_000);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('should sign a transaction', async function () {
    const address = publicKey.toAddress();
    
    const utxos = [{
      txId: '115e8f72f39fad874cfab0deed11a80f24f967a84079fb56ddf53ea02e308986',
      outputIndex: 0,
      address: address.toString(),
      script: Script.buildWitnessV0Out(address),
      satoshis: 1100
    }];
    
    const tx = CWC.Transactions.create({
      chain: 'BTC',
      recipients: [{ address: '1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', amount: 1000 }],
      utxos
    });

    const signRequest: Promise<string> = burner.sign({
      tx,
      utxos,
      password: 'password not relevant to test',
      index: 0
    });

    const hash = CWC.Transactions.getSighash({
      chain: 'BTC',
      tx,
      utxos,
      index: 0
    });
    
    const signature = crypto.ECDSA.sign(Buffer.from(hash, 'hex'), privateKey);
    
    burner.responses = [{
      input: (burner.commandQueue[0] as any).keyNo,
      digest: (burner.commandQueue[0] as any).digest,
      signature: {
        raw: {},
        der: signature.toString(),
      },
      publicKey: publicKey.toString()
    }];
    
    const signedTransaction = new Transaction(await signRequest);
    expect(signedTransaction.inputs[0].witnesses[0].length).to.be.greaterThan(70).and.lessThan(73);
    expect(signedTransaction.inputs[0].witnesses[1].length).to.equal(33);
  });
});
