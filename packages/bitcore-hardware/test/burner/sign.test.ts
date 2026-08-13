import sinon from 'sinon';
import { expect } from 'chai';
import { describe } from 'mocha';
import CWC, { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import Burner from '../../src/burner.js';

const { PrivateKey, crypto, Transaction, Script } = BitcoreLib;

describe('Burner Signing', function () {
  const sandbox = sinon.createSandbox();
  const burner = new Burner('BTC');
  const privateKey = new PrivateKey();
  const publicKey = privateKey.toPublicKey();
  const address = publicKey.toAddress();

  before(function () {
    this.timeout(5_000);
  });

  this.beforeEach(function () {
    burner.responses = [];
    burner.commandQueue = [];
  });
  
  afterEach(function () {
    sandbox.restore();
  });

  it('should sign a transaction', async function () {
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

  it('should throw error if signature does not match public key', async function () {
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

    const hash = CWC.Transactions.getSighash({
      chain: 'BTC',
      tx,
      utxos,
      index: 0
    });
    
    const signature = crypto.ECDSA.sign(Buffer.from(hash, 'hex'), privateKey);

    const signRequest: Promise<string> = burner.sign({
      tx,
      utxos,
      password: 'password not relevant to test',
      index: 0
    });
    
    burner.responses = [{
      input: (burner.commandQueue[0] as any).keyNo,
      digest: (burner.commandQueue[0] as any).digest,
      signature: {
        raw: {},
        der: signature.toString(),
      },
      // random, incorrect public key
      publicKey: new PrivateKey().toPublicKey().toString()
    }];

    let error = false;
    try {
      await signRequest;
    } catch {
      error = true;
    }
    expect(error, 'did not throw error with incorrect public key').to.be.true;
  });

  it('should sign a bitcore-lib transaction without separate utxos', async function () {    
    const utxos = [{
      txId: '115e8f72f39fad874cfab0deed11a80f24f967a84079fb56ddf53ea02e308986',
      outputIndex: 0,
      address: address.toString(),
      script: Script.buildWitnessV0Out(address),
      satoshis: 1100
    }];
    
    const tx = new Transaction()
      .from(utxos)
      .to('1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', 1000);

    const signRequest: Promise<string> = burner.sign({
      tx,
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

  it('should sign a transaction with bitcore-node style utxos', async function () {
    const utxos = [
      {
        chain: 'BTC',
        network: 'regtest',
        coinbase: true,
        mintIndex: 0,
        spentTxid: '517dc566fb3a82121840eecdcce4636fb776b6b64ccc4f29f74b870e6bcc44b0',
        mintTxid: 'd3667993af738c3db4033dc462ab95f9916da455c628bbf71488484e2b6803c3',
        mintHeight: 5,
        spentHeight: 111,
        address: address.toString(),
        script: Script.buildWitnessV0Out(address),
        value: 600,
        confirmations: 1,
        sequenceNumber: 4294967293,
        wallets: []
      },
      {
        chain: 'BTC',
        network: 'regtest',
        coinbase: false,
        mintIndex: 1,
        spentTxid: '',
        mintTxid: '517dc566fb3a82121840eecdcce4636fb776b6b64ccc4f29f74b870e6bcc44b0',
        mintHeight: 111,
        spentHeight: -2,
        address: address.toString(),
        script: Script.buildWitnessV0Out(address),
        value: 520,
        confirmations: 1,
        sequenceNumber: 4294967295,
        wallets: []
      }
    ];
    
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

    for (let i = 0; i < utxos.length; i++) {
      const hash = CWC.Transactions.getSighash({
        chain: 'BTC',
        tx,
        utxos,
        index: i
      });
      const signature = crypto.ECDSA.sign(Buffer.from(hash, 'hex'), privateKey);
      
      burner.responses.push({
        input: (burner.commandQueue[0] as any).keyNo,
        digest: (burner.commandQueue[0] as any).digest,
        signature: {
          raw: {},
          der: signature.toString(),
        },
        publicKey: publicKey.toString()
      });
    }
    
    const signedTransaction = new Transaction(await signRequest);
    expect(signedTransaction.inputs[0].witnesses[0].length).to.be.greaterThan(70).and.lessThan(73);
    expect(signedTransaction.inputs[0].witnesses[1].length).to.equal(33);
  });
});
