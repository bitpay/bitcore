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
   * Used to normalize output of Key.privKey
   */
  privateKeyToBuffer(privKey: any): Buffer;

  /**
   * Temporary - converts decrypted private key buffer to chain-native private key format
   */
  privateKeyBufferToNativePrivateKey(buf: Buffer, network: string): any;
}