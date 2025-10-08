import BitcoreLib from 'bitcore-lib';
import { Constants } from '../constants'


export * as BI from './bigint';

export function isNativeSegwit(addressType) {
  return [
    Constants.SCRIPT_TYPES.P2WPKH,
    Constants.SCRIPT_TYPES.P2WSH,
    Constants.SCRIPT_TYPES.P2TR,
  ].includes(addressType);
}

export function getSegwitVersion(addressType) {
  switch (addressType) {
    case Constants.SCRIPT_TYPES.P2WPKH:
    case Constants.SCRIPT_TYPES.P2WSH:
      return 0;
    case Constants.SCRIPT_TYPES.P2TR:
      return 1;
    default:
      return undefined; // non-segwit addressType
  }
}

export function isUtxoChain(chain: string): boolean {
  return Constants.UTXO_CHAINS.includes(chain.toLowerCase());
}

export function isSvmChain(chain: string): boolean {
  return Constants.SVM_CHAINS.includes(chain.toLowerCase());
}

export function isEvmChain(chain: string): boolean {
  return Constants.EVM_CHAINS.includes(chain.toLowerCase());
}

export function isXrpChain(chain: string): boolean {
  return ['xrp'].includes(chain.toLowerCase());
}

export function isSingleAddressChain(chain: string): boolean {
  return !isUtxoChain(chain);
}

export function encodeBuffer(buffer: Buffer, encoding: BufferEncoding | 'base58'): Buffer | string {
  if (!encoding) {
    return buffer;
  } else if (encoding === 'base58') {
    return BitcoreLib.encoding.Base58.encode(buffer);
  } else {
    return buffer.toString(encoding);
  }
}