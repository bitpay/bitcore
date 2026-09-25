import { expect } from 'chai';
import { describe } from 'mocha';
import CWC, { BitcoreLib, ethers } from '@bitpay-labs/crypto-wallet-core';
import Burner from '../../src/burner.js';

const { PrivateKey, Address } = BitcoreLib;

describe('Burner Data', function () {
  const burner = new Burner();
  const privateKey = new PrivateKey();
  const publicKey = privateKey.toPublicKey();
  const address = Address.fromPublicKey(publicKey, 'livenet', 'witnesspubkeyhash');
  const etherAddress = ethers.computeAddress('0x' + publicKey.toString());

  before(function () {
    this.timeout(5_000);
  });

  beforeEach(function () {
    burner.responses.clear();
    burner.commandQueue.clear();
  });

  afterEach(function () {
    expect(burner.responses.size).to.equal(0, 'response queue not cleaning properly');
    expect(burner.commandQueue.size).to.equal(0, 'command queue not cleaning properly');
  });

  it('should get public key', async function () {
    const publicKeyRequest: Promise<string> = burner.getPublicKey({ index: 9 });

    burner.responses.set(
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
    const addressRequest: Promise<string> = burner.getAddress({ chain: 'BTC', index: 9 });
    burner.responses.set(
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
    const addressRequest: Promise<string> = burner.getAddress({ chain: 'BTC', index: 9 });
    burner.responses.set(
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
    const addressRequest: Promise<string> = burner.getAddress({ chain: 'ETH', index: 9 });
    burner.responses.set(
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
    const addressRequest: Promise<string> = burner.getAddress({ chain: 'ETH', index: 9 });
    burner.responses.set(
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

  it('should get firmware version', async function () {
    const versionRequest: Promise<string> = burner.getVersion();
    const expectedVersion = '30312e43382e3030303034332e3930333943363334';
    burner.responses.set(
      'get_data_struct_v20',
      {
        firmwareVersion: {
          1: {
            value: expectedVersion
          }
        }
      }
    );
    const version = await versionRequest;
    expect(version).to.equal(expectedVersion);
  });

  it('should validate chain names', async function () {
    expect(Burner.isValidChain('BTC')).to.be.true;
    expect(Burner.isValidChain('ETH')).to.be.true;
    expect(Burner.isValidChain('not a chain name')).to.be.false;
    expect(Burner.isValidChain('btc')).to.be.false;
  });
});
