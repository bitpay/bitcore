import EventEmitter from 'events';
import { expect } from 'chai';
import { describe } from 'mocha';
import CWC, { ethers } from '@bitpay-labs/crypto-wallet-core';
import sinon from 'sinon';
import Burner from '../../src/burner/adapter.js';
import { HwProxy } from '../../src/index.js';

const { PrivateKey, Address } = CWC.BitcoreLib;

describe('Burner Data', function () {
  const privateKey = new PrivateKey();
  const publicKey = privateKey.toPublicKey();
  const address = Address.fromPublicKey(publicKey, 'livenet', 'witnesspubkeyhash');
  const etherAddress = ethers.computeAddress('0x' + publicKey.toString());
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
   * Stub the burner so the next card scan responds with the given data
   */
  const stubData = (data: Record<string, any>) => {
    return sandbox.stub(HwProxy.get('burner'), 'sendManyCommands').resolves([data]);
  };

  it('should get public key', async function () {
    const stub = stubData({
      publicKey: {
        9: {
          value: publicKey.toString()
        }
      }
    });

    const fetchedPublicKey = await HwProxy.getPublicKey({ vendor: 'burner' });
    expect(fetchedPublicKey).to.equal(publicKey.toString());
    expect(stub.calledOnceWith([{
      name: 'get_data_struct_v2',
      spec: [{ type: 'publicKey', index: 9 }]
    }])).to.be.true;
  });

  it('should get bitcoin address', async function () {
    const stub = stubData({
      compressedPublicKey: {
        9: {
          value: publicKey.toString()
        }
      }
    });

    const fetchedAddress = await HwProxy.getAddress({
      vendor: 'burner',
      chain: 'BTC'
    });
    expect(fetchedAddress).to.equal(address.toString());
    expect(stub.calledOnceWith([{
      name: 'get_data_struct_v2',
      spec: [{ type: 'compressedPublicKey', index: 9 }]
    }])).to.be.true;
  });

  it('should get return undefined for invalid bitcoin address', async function () {
    stubData({
      compressedPublicKey: {
        9: {
          value: 'invalid bitcoin address'
        }
      }
    });
    sandbox.stub(console, 'error');

    const fetchedAddress = await HwProxy.getAddress({
      vendor: 'burner',
      chain: 'BTC'
    });
    expect(fetchedAddress).to.be.undefined;
  });

  it('should get ethereum address', async function () {
    const stub = stubData({
      publicKey: {
        9: {
          value: publicKey.toString()
        }
      }
    });

    const fetchedAddress = await HwProxy.getAddress({
      vendor: 'burner',
      chain: 'ETH'
    });
    expect(fetchedAddress).to.equal(etherAddress.toString());
    expect(stub.calledOnceWith([{
      name: 'get_data_struct_v2',
      spec: [{ type: 'publicKey', index: 9 }]
    }])).to.be.true;
  });

  it('should get return undefined for invalid ethereum address', async function () {
    stubData({
      publicKey: {
        9: {
          value: 'invalid ethereum address'
        }
      }
    });
    sandbox.stub(console, 'error');

    const fetchedAddress = await HwProxy.getAddress({
      vendor: 'burner',
      chain: 'ETH'
    });
    expect(fetchedAddress).to.be.undefined;
  });

  it('should validate chain names', async function () {
    expect(Burner.isValidChain('BTC')).to.be.true;
    expect(Burner.isValidChain('ETH')).to.be.true;
    expect(Burner.isValidChain('not a chain name')).to.be.false;
    expect(Burner.isValidChain('btc')).to.be.false;
  });

  it('should reject when the nfc, reader, or card fails', async function () {
    const burner = HwProxy.get('burner');
    const expectReject = async (request: Promise<unknown>, message: string) => {
      let error: Error | undefined;
      try {
        await request;
      } catch (e) {
        error = e as Error;
      }
      expect(error, `did not reject: ${message}`).to.be.instanceOf(Error);
      expect(error!.message).to.include(message);
    };

    // nfc error
    sandbox.replace(burner, 'nfc', new EventEmitter());
    let request = HwProxy.getPublicKey({ vendor: 'burner' });
    burner.nfc.emit('error', new Error('nfc failure'));
    await expectReject(request, 'nfc failure');
    sandbox.restore();

    // reader error
    sandbox.replace(burner, 'nfc', new EventEmitter());
    request = HwProxy.getPublicKey({ vendor: 'burner' });
    let reader: any = new EventEmitter();
    burner.nfc.emit('reader', reader);
    expect(reader.autoProcessing).to.be.false;
    reader.emit('error', new Error('reader failure'));
    await expectReject(request, 'reader failure');
    sandbox.restore();

    // card scanned, but communicating with it fails
    sandbox.replace(burner, 'nfc', new EventEmitter());
    request = HwProxy.getPublicKey({ vendor: 'burner' });
    reader = new EventEmitter();
    reader.transmit = sinon.stub().rejects(new Error('card failure'));
    burner.nfc.emit('reader', reader);
    reader.emit('card', {});
    await expectReject(request, 'card failure');
    expect(reader.transmit.called).to.be.true;
  });
});
