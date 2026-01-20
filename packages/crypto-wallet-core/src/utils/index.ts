import BitcoreLib from 'bitcore-lib';
import { Constants } from '../constants';


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

/**
 * Evaluates if the given string is a valid hex string (with or without 0x prefix)
 * @param {string} str The string to evaluate
 * @returns {boolean} True if the string is a valid hex string (with or without 0x prefix)
 */
export function isHexString(str: string): boolean {
  if (typeof str !== 'string' || str === '') {
    return false;
  }
  const normalizedStr = str.toLowerCase().slice(0, 2) === '0x' ? str.toLowerCase().slice(2) : str.toLowerCase();
  return Buffer.from(normalizedStr, 'hex').toString('hex') === normalizedStr;
}

/**
 * Converts a number, string, or bigint to a hex string with 0x prefix
 * This function makes the following assumption(s):
 * 1. If the input is a non-prefixed numeric string (e.g. '123'), it is assumed to be a decimal number
 * 2. If the input is a non-prefixed hex string (e.g. '123a'), it is assumed to be a hex number (as opposed to a utf8 string to be converted to hex)
 * @param {number|string|bigint} input The input number, string, or bigint
 * @returns {string} The hex string with 0x prefix
 */
export function toHex(input: number | string | bigint): string {
  if ((typeof input !== 'number' && typeof input !== 'string' && typeof input !== 'bigint') || input === '') {
    throw new Error(`Input for toHex must be a number, string (non-empty), or bigint. Got ${!input ? JSON.stringify(input) : `typeof ${typeof input}`}`);
  }
  try {
    return '0x' + BigInt(input).toString(16);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    if (typeof input === 'string' && isHexString(input)) {
      // BigInt() fails on non-prefixed hex strings (e.g. 'abc123')
      return toHex('0x' + input);
    }
    throw new Error(`Invalid input for toHex: ${input === '' ? "''" : input}`);
  }
}


