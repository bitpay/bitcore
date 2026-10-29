import { expect } from 'chai';
import { describe } from 'mocha';
import CWC, { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import sinon from 'sinon';
import { HwProxy } from '../../src/index.js';

const { PrivateKey, crypto, Transaction, Script } = BitcoreLib;

describe('Burner Signing', function () {
  const privateKey = new PrivateKey();
  const publicKey = privateKey.toPublicKey();
  const address = publicKey.toAddress();
  const sandbox = sinon.createSandbox();

  before(async function () {
    this.timeout(5_000);
    await HwProxy.connect();
  });

  after(async function () {
    await HwProxy.disconnect();
  });

  afterEach(function () {
    sandbox.restore();
  });

  /**
   * Stub the burner so the next card scan responds to each sign command
   * with the response built for it
   */
  const stubSign = (buildResponse: (command: Record<string, any>, index: number) => Record<string, any>) => {
    return sandbox.stub(HwProxy.get('burner', 'nfc'), 'sendManyCommands').callsFake(async commands => {
      return commands.map((command, i) => {
        return {
          input: command.keyNo,
          digest: command.digest,
          ...buildResponse(command, i)
        };
      });
    });
  };

  it('should sign a BTC transaction', async function () {
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

    const stub = stubSign(command => {
      expect(command.digest).to.equal(hash);
      return {
        signature: {
          raw: {},
          der: signature.toString(),
        },
        publicKey: publicKey.toString()
      };
    });

    const signedTx = await HwProxy.sign({
      vendor: 'burner',
      chain: 'BTC',
      tx,
      utxos,
      password: 'password not relevant to test'
    });
    
    const signedTransaction = new Transaction(signedTx);
    expect(stub.calledOnce).to.be.true;
    expect(signedTransaction.inputs[0].witnesses[0].length).to.be.greaterThan(5).and.lessThan(100);
    expect(signedTransaction.inputs[0].witnesses[1].length).to.equal(33);
  });

  it('should sign an ETH transaction', async function () {
    const key = {
      address: '0xb4b9be3062b6dB6eDa78fa4b5EA80595Cfa7E655',
      privKey: '0x733d4cddb30d33f324def2bb80c6a844f7ba342a60bed06d838afb6b37ab1972',
    };
    
    const tx = CWC.Transactions.create({
      chain: 'ETH',
      recipients: [{ address: '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A', amount: 3896000000000000 }],
      nonce: 0,
      gasPrice: 20000000000,
      data: '0xb6b4af05000000000000000000000000000000000000000000000000000dd764300b800000000000000000000000000000000000000000000000000000000004a817c8000000000000000000000000000000000000000000000000000000016ada606a26050bb49a5a8228599e0dd48c1368abd36f4f14d2b74a015b2d168dbcab0773ce399393220df874bb22ca961f351e038acd2ba5cc8c764385c9f23707622cc435000000000000000000000000000000000000000000000000000000000000001c7e247d684a635813267b10a63f7f3ba88b28ca2790c909110b28236cf1b9bba03451e83d5834189f28d4c77802fc76b7c760a42bc8bebf8dd15e6ead146805630000000000000000000000000000000000000000000000000000000000000000'
    });

    const signature = CWC.Transactions.getSignature({
      chain: 'ETH',
      tx,
      key
    });

    const stub = stubSign(command => {
      expect(command.digest).to.equal(CWC.Transactions.getSighash({ chain: 'ETH', tx }));
      return {
        signature: {
          raw: {},
          ether: signature,
        }
      };
    });
    
    const signedTx = await HwProxy.sign({
      vendor: 'burner',
      chain: 'ETH',
      tx,
      password: 'password not relevant to test'
    });

    const expectedSignedTx = CWC.Transactions.sign({
      chain: 'ETH',
      tx,
      key
    });
    expect(stub.calledOnce).to.be.true;
    expect(signedTx).to.equal(expectedSignedTx);
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

    stubSign(() => ({
      signature: {
        raw: {},
        der: signature.toString(),
      },
      // random, incorrect public key
      publicKey: new PrivateKey().toPublicKey().toString()
    }));

    let error = false;
    try {
      await HwProxy.sign({
        vendor: 'burner',
        chain: 'BTC',
        tx,
        utxos,
        password: 'password not relevant to test'
      });
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

    const hash = CWC.Transactions.getSighash({
      chain: 'BTC',
      tx,
      utxos,
      index: 0
    });
    
    const signature = crypto.ECDSA.sign(Buffer.from(hash, 'hex'), privateKey);

    const stub = stubSign(command => {
      expect(command.digest).to.equal(hash);
      return {
        signature: {
          raw: {},
          der: signature.toString(),
        },
        publicKey: publicKey.toString()
      };
    });

    const signedTx = await HwProxy.sign({
      vendor: 'burner',
      chain: 'BTC',
      tx,
      password: 'password not relevant to test'
    });
    
    const signedTransaction = new Transaction(signedTx);
    expect(stub.calledOnce).to.be.true;
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

    const stub = stubSign((command, i) => {
      const hash = CWC.Transactions.getSighash({
        chain: 'BTC',
        tx,
        utxos,
        index: i
      });
      expect(command.digest).to.equal(hash);
      const signature = crypto.ECDSA.sign(Buffer.from(hash, 'hex'), privateKey);
      return {
        signature: {
          raw: {},
          der: signature.toString(),
        },
        publicKey: publicKey.toString()
      };
    });

    const signedTx = await HwProxy.sign({
      vendor: 'burner',
      chain: 'BTC',
      tx,
      utxos,
      password: 'password not relevant to test'
    });
    
    const signedTransaction = new Transaction(signedTx);
    expect(stub.calledOnce).to.be.true;
    expect(stub.firstCall.args[0].length).to.equal(utxos.length);
    for (let i = 0; i < utxos.length; i++) {
      expect(signedTransaction.inputs[i].witnesses[0].length).to.be.greaterThan(70).and.lessThan(73);
      expect(signedTransaction.inputs[i].witnesses[1].length).to.equal(33);
    }
  });
});
