const BitcoreLib = require('bitcore-lib');
const BitcoreLibCash = require('bitcore-lib-cash');
import { pubToAddress } from 'ethereumjs-util';
const { Address } = require('bitcore-lib');
import { ec } from 'elliptic';
const secp = new ec('secp256k1');

interface IDeriver {
  deriveAddress(
    network: string,
    pubKey: string,
    addressIndex: number,
    isChange: boolean
  ): string;
}

export abstract class AbstractBitcoreLibDeriver implements IDeriver {
  public abstract bitcoreLib;

  deriveAddress(network, pubKey, addressIndex, isChange) {
    const xpub = new this.bitcoreLib.HDPublicKey(pubKey, network);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    return this.bitcoreLib
      .Address(xpub.derive(path).publicKey, network)
      .toString();
  }
}
export class BtcDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLib;
}

export class BchDeriver extends AbstractBitcoreLibDeriver {
  bitcoreLib = BitcoreLibCash;
}

export class EthDeriver implements IDeriver {
  padTo32(msg) {
    while (msg.length < 32) {
      msg = Buffer.concat([new Buffer([0]), msg]);
    }
    if (msg.length !== 32) {
      throw new Error(`invalid key length: ${msg.length}`);
    }
    return msg;
  }

  deriveAddress(network, pubKey, addressIndex, isChange) {
    const xpub = new BitcoreLib.HDPublicKey(pubKey, network);
    const changeNum = isChange ? 1 : 0;
    const path = `m/${changeNum}/${addressIndex}`;
    const derived = xpub.derive(path).publicKey;
    console.log(derived);
    const ecKey = secp.keyFromPublic(derived.toBuffer());
    const ecPub = ecKey.getPublic().toJSON();
    console.log(ecPub);
    const paddedBuffer = Buffer.concat([
      this.padTo32(new Buffer(ecPub[0].toArray())),
      this.padTo32(new Buffer(ecPub[1].toArray()))
    ]);
    return `0x${pubToAddress(paddedBuffer).toString('hex')}`;
  }
}

const derivers: { [chain: string]: IDeriver } = {
  BTC: new BtcDeriver(),
  BCH: new BchDeriver(),
  ETH: new EthDeriver()
};

const paths = {
  BTC: {
    mainnet: `m/44'/0'/0'`
  },
  BCH: {
    mainnet: `m/44'/145'/0'`
  },
  ETH: {
    mainnet: `m/44'/60'/0'`
  },
  default: {
    testnet: `m/44'/1'/0'`
  }
};

export class AddressProviderProxy {
  get(chain) {
    return derivers[chain];
  }

  derive(chain, network, pubKey, addressIndex, isChange) {
    return this.get(chain).deriveAddress(
      network,
      pubKey,
      addressIndex,
      isChange
    );
  }

  pathFor(chain, network) {
    if (network != 'mainnet') {
      return paths.default.testnet;
    } else {
      return paths[chain][network];
    }
  }
}

export const AddressProvider = new AddressProviderProxy();
