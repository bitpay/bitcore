import { expect } from 'chai';
import { describe } from 'mocha';
import CWC, { BitcoreLib, ethers } from '@bitpay-labs/crypto-wallet-core';
import Burner from '../../src/burner/adapter.js';
import { HwProxy } from '../../src/index.js';

const { PrivateKey, Address } = BitcoreLib;

describe('Burner Data', function () {
  const privateKey = new PrivateKey();
  const publicKey = privateKey.toPublicKey();
  const address = Address.fromPublicKey(publicKey, 'livenet', 'witnesspubkeyhash');
  const etherAddress = ethers.computeAddress('0x' + publicKey.toString());

  before(async function () {
    this.timeout(5_000);
    await HwProxy.connect();
  });

  after(async function () {
    await HwProxy.disconnect();
  });

  beforeEach(function () {
    HwProxy.get('burner').responses.clear();
    HwProxy.get('burner').commandQueue.clear();
  });

  afterEach(function () {
    expect(HwProxy.get('burner').responses.size).to.equal(0, 'response queue not cleaning properly');
    expect(HwProxy.get('burner').commandQueue.size).to.equal(0, 'command queue not cleaning properly');
  });

  it('should get public key', async function () {
    const publicKeyRequest: Promise<string> = HwProxy.getPublicKey({
      vendor: 'burner',
      connection: 'nfc'
    });

    HwProxy.get('burner').responses.set(
      'get_data_struct_v20',
      {
        publicKey: {
          9: {
            value: publicKey.toString()
          }
        }
      }
    );
    
    const fetchedPublicKey = await publicKeyRequest;
    expect(fetchedPublicKey).to.equal(publicKey.toString());
  });

  it('should get bitcoin address', async function () {
    const addressRequest: Promise<string> = HwProxy.getAddress({
      vendor: 'burner',
      connection: 'nfc',
      chain: 'BTC'
    });
    HwProxy.get('burner').responses.set(
      'get_data_struct_v20',
      {
        compressedPublicKey: {
          9: {
            value: publicKey.toString()
          }
        },
      }
    );
    const fetchedAddress = await addressRequest;
    expect(fetchedAddress).to.equal(address.toString());
  });

  it('should get return undefined for invalid bitcoin address', async function () {
    const addressRequest: Promise<string> = HwProxy.getAddress({
      vendor: 'burner',
      connection: 'nfc',
      chain: 'BTC'
    });
    HwProxy.get('burner').responses.set(
      'get_data_struct_v20',
      {
        compressedPublicKey: {
          9: {
            value: 'invalid bitcoin address'
          }
        },
      }
    );
    const fetchedAddress = await addressRequest;
    expect(fetchedAddress).to.be.undefined;
  });
  
  it('should get ethereum address', async function () {
    const addressRequest: Promise<string> = HwProxy.getAddress({
      vendor: 'burner',
      connection: 'nfc',
      chain: 'ETH'
    });
    HwProxy.get('burner').responses.set(
      'get_data_struct_v20',
      {
        publicKey: {
          9: {
            value: publicKey.toString()
          }
        },
      }
    );
    const fetchedAddress = await addressRequest;
    expect(fetchedAddress).to.equal(etherAddress.toString());
  });

  it('should get return undefined for invalid ethereum address', async function () {
    const addressRequest: Promise<string> = HwProxy.getAddress({
      vendor: 'burner',
      connection: 'nfc',
      chain: 'ETH'
    });
    HwProxy.get('burner').responses.set(
      'get_data_struct_v20',
      {
        publicKey: {
          9: {
            value: 'invalid bitcoin address'
          }
        },
      }
    );
    const fetchedAddress = await addressRequest;
    expect(fetchedAddress).to.be.undefined;
  });

  it('should validate chain names', async function () {
    expect(Burner.isValidChain('BTC')).to.be.true;
    expect(Burner.isValidChain('ETH')).to.be.true;
    expect(Burner.isValidChain('not a chain name')).to.be.false;
    expect(Burner.isValidChain('btc')).to.be.false;
  });
  
  it('should throw error when filling queue', async function () {
    for (let i = 0; i < 100; i++) {
      HwProxy.get('burner').commandQueue.set(
        'get_data_struct_v2' + i,
        {
          name: 'get_data_struct_v2',
          spec: [ { type: 'publicKey', index: 9 } ]
        }
      );
    }
    let error = false;
    try {
      await HwProxy.getPublicKey({ vendor: 'burner', connection: 'nfc' });
    } catch (e) {
      error = true;
    }
    expect(error, 'did not throw error when filling queue').to.be.true;
    HwProxy.get('burner').commandQueue.clear();
  });
});
