import { MISSING_ENCODING } from '../../../errors';

/**
 * Encodes input to a URL-friendly base64 string.
 * @param input Input to encode.
 * @param enc (optional) Current encoding of input (hex, base64, etc.). Required if input is a string.
 */
export const toUrlBase64 = (input: string | ArrayBuffer, enc?: BufferEncoding): string => {
  if (typeof input === 'string') {
    if (!enc) {
      throw new Error(MISSING_ENCODING);
    }
    input = Buffer.from(input, enc);
  } else {
    input = Buffer.from(input as any, enc);
  }

  input = (input as Buffer).toString('base64');

  return input.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};
