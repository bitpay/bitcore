import {
  CANNOT_PARSE_PRIVATEKEY,
  CANNOT_PARSE_PUBLICKEY,
  EXPECTED_PEM,
  MISSING_ENCODING,
  REQUIRE_PRIVATE_KEY,
  REQUIRE_PUBLIC_KEY
} from '../../../errors';
import { KeyConverter } from '../../../index.d';
import SEC1 from '../keys/ec';
import PKCS8 from '../keys/private';
import SPKI from '../keys/public';
import PKCS1 from '../keys/rsa';

const keyMap = {
  private: {
    generic: [PKCS8],
    ec: [SEC1],
    rsa: [PKCS1.Private],
    unknown: [PKCS8, SEC1, PKCS1.Private]
  },
  public: {
    generic: [SPKI],
    ec: [],
    rsa: [PKCS1.Public],
    unknown: [SPKI, PKCS1.Public]
  }
};

const PARSE_ERRORS = {
  private: CANNOT_PARSE_PRIVATEKEY,
  public: CANNOT_PARSE_PUBLICKEY
};

/**
 * Converts EC, EdDSA (Ed25519), or RSA key to JWK.
 * @param input The key in Buffer or string format.
 * @param domain Specify whether input is a public or private key.
 * @param enc (optional) Current encoding of input. Required if input is a string.
 */
export const toJWK = (input: string | Buffer, domain: 'private'|'public', enc?: BufferEncoding) => {
  let encoding: 'der' | 'pem' = 'der';
  let keyType = 'unknown';
  let options = {};

  // Handle PEM string.
  if (/^-----BEGIN .*(PRIVATE |PUBLIC )?KEY-----/.test(input.toString())) {
    encoding = 'pem';
    // Check that the key is the expected domain
    const keyDomain = getKeyDomain(input.toString());
    if (!keyDomain || keyDomain.toLowerCase() !== domain) {
      if (domain === 'private') {
        throw new Error(REQUIRE_PRIVATE_KEY);
      } else {
        throw new Error(REQUIRE_PUBLIC_KEY);
      }
    }

    // Getting the key type can help reduce the number of errant decoding calls later.
    keyType = getKeyType(input.toString());
    if (!keyType) {
      keyType = 'generic';
    }
    keyType = keyType.toLowerCase();

    options = { label: `${keyType === 'generic' ? '' : keyType} ${keyDomain} key`.trim().toUpperCase() };
  } else if (typeof input === 'string' && !enc) {
    throw new Error(MISSING_ENCODING); // Need string encoding if it's not a PEM string.
  } else {
    input = Buffer.from(input as any, enc); // If input is already a buffer, this is harmless.
  }

  let jwk;

  // Decode the key and convert to JWK
  const converters: KeyConverter[] = keyMap[domain][keyType];
  for (let Converter of converters) {
    try {
      jwk = new Converter().decode(input, encoding, options).toJWK();
      break;
    } catch (err) {}
  }
  if (!jwk) {
    throw new Error(PARSE_ERRORS[domain]);
  }
  return jwk;
};

/**
 * Extract the key domain (public or private) from the PEM string header.
 * @param pem PEM key string.
 */
export const getKeyDomain = (pem: string) => {
  let header = pem.split('\n')[0];
  const domainStartIdx = header.search(/(PUBLIC|PRIVATE)/);

  if (domainStartIdx === -1) {
    throw new Error(EXPECTED_PEM);
  }

  header = header.substr(domainStartIdx);
  const headerDomain = header.substr(0, header.search(/\s/));
  return headerDomain;
};

/**
 * Extract the key type (EC or RSA) from the PEM string header.
 * @param pem PEM key string.
 */
export const getKeyType = (pem: string) => {
  let header = pem.split('\n')[0];
  const domainStartIdx = header.search(/(PUBLIC|PRIVATE)/);

  if (domainStartIdx === -1) {
    throw new Error(EXPECTED_PEM);
  }

  header = header.substr(0, domainStartIdx);
  header = header.replace(/-----/g, '');
  header = header.replace('BEGIN', '');
  header = header.trim();

  return header;
};