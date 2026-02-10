export interface Key {
  address: string;
  privKey?: string;
  pubKey?: string;
}

export interface IDeriver {
  deriveAddress(network: string, xPub: string, addressIndex: number, isChange: boolean, addressType?: string): string;

  derivePrivateKey(network: string, xPriv: string, addressIndex: number, isChange: boolean, addressType?: string): Key;

  deriveAddressWithPath(network: string, xpubKey: string, path: string, addressType: string): string;

  derivePrivateKeyWithPath(network: string, xprivKey: string, path: string, addressType: string): Key;

  getAddress(network: string, pubKey, addressType: string): string;

  /**
   * Derive the public key for a given chain-native private key representation.
   * Used when importing plaintext private keys that may not include `pubKey`.
   * Caller should clean up buffer after use
   */
  getPublicKey(network: string, privKey: Buffer): string;

  /**
   * Used to normalize output of Key.privKey
   */
  privateKeyToBuffer(privKey: any): Buffer;

  /**
   * Temporary - converts decrypted private key buffer to lib-specific private key format
   */
  bufferToPrivateKey_TEMP(buf: Buffer, network: string): string;
}