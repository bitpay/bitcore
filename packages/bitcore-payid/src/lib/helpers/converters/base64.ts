export const toUrlBase64 = (input: string | Buffer | Uint8Array | Array<any>, enc?: BufferEncoding): string => {
  if (typeof input === 'string') {
    if (!enc) {
      if (/^(0x)?[0-9a-f]+$/.test(input.toLowerCase())) {
        input = Buffer.from(input, 'hex');
      } else {
        input = Buffer.from(input, 'base64');
      }
    } else {
      input = Buffer.from(input, enc);
    }
  } else {
    input = Buffer.from(input);
  }

  input = (input as Buffer).toString('base64');

  return input.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};
