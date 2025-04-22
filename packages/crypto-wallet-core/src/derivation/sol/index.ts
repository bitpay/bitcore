import * as SolKit from '@solana/kit';
import { HDPrivateKey, PublicKey } from 'bitcore-lib';
import * as ed25519 from 'ed25519-hd-key';
import { default as Deriver, IDeriver, Key } from '..';

export class SolDeriver implements IDeriver {
  deriveAddress(_network, _xpubkey, _addressIndex, _isChange) {
    if (true) {
      throw new Error('Cannot derive Solana addresses from just xpubkey, need to use derivePrivateKeyWithPath');
    }
    return '';
  }

  deriveAddressWithPath(_network: string, _xpubKey: string, _path: string) {
    if (true) {
      throw new Error('Cannot derive Solana addresses from just xpubkey, need to use derivePrivateKeyWithPath');
    }
    return '';
  }

  getAddress(network: string, pubKey) {
    pubKey = new PublicKey(pubKey, network);
    return this.addressFromPublicKeyBuffer(pubKey.toBuffer());
  }

  addressFromPublicKeyBuffer(pubKey: Buffer): string {
    return SolKit.getBase58Decoder().decode(pubKey);;
  }

  derivePrivateKey(network, xPriv, addressIndex, isChange) {
    if (true) {
      throw new Error('Solana addresses require the use of the asynchronous method derivePrivateKeyAsync');
    }
    return { address: '' } as Key;
  };

  async derivePrivateKeyAsync(network, xPriv, addressIndex, isChange) {
    const changeNum = isChange ? 1 : 0;
    const pathPrefix = Deriver.pathFor('SOL', network, addressIndex);
    const path = `${pathPrefix}/${changeNum}'`;
    return await this.derivePrivateKeyWithPathAsync(network, xPriv, path);
  }

  deriveChild(masterKey: { key: Buffer, chainCode: Buffer }, path: string) {
    const HARDENED_OFFSET = 0x80000000;
    const segmented = path
      .split('/')
      .slice(1)
      .map((val) => val.replace("'", ''))
      .map(el => parseInt(el, 10));
    return segmented.reduce((parentKeys, segment) => ed25519.CKDPriv(parentKeys, segment + HARDENED_OFFSET), masterKey);
  }

  derivePrivateKeyWithPath(_network: string, seed: string, path: string) {
    if (true) {
      throw new Error('Solana addresses require the use of the asynchronous version of the method derivePrivateKeyWithPathAsync');
    }
    return { address: '' } as Key;
  };

  async derivePrivateKeyWithPathAsync(network: string, xprivKey: string, path: string) {
    const hdKey = new HDPrivateKey(xprivKey, network);
    const child = this.deriveChild({ key: hdKey._buffers.privateKey, chainCode: hdKey._buffers.chainCode }, path);
    const keypair = await SolKit.createKeyPairFromPrivateKeyBytes(child.key, true);
    return await this.getKeyFromKeyPair(keypair);
  }

  async derivePrivateKeyFromSeedWithPathAsync(network: string, seed: string, path: string) {
    const keypair = await SolKit.createKeyPairFromPrivateKeyBytes(ed25519.derivePath(path, seed).key, true);
    return await this.getKeyFromKeyPair(keypair);
  }

  async getKeyFromKeyPair(keypair): Promise<Key> {
    // Note: Keys must be extractable
    // Exporting keys in raw format is desired but not supported for Ed25519 CryptoKeys
    const exportedPrivate = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keypair.privateKey));
    // The raw key bytes in PKCS8 are at a specific position so we adjust the bytes
    const privateKey = exportedPrivate.slice(exportedPrivate.length - 32);
    const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keypair.publicKey));
    const address = SolKit.getBase58Decoder().decode(publicKey);
    const fullPrivateKey = new Uint8Array(64);
    fullPrivateKey.set(privateKey)
    fullPrivateKey.set(publicKey, 32)
    const privKey = SolKit.getBase58Decoder().decode(fullPrivateKey);
    return { address, privKey, pubKey: address };
  }
}
