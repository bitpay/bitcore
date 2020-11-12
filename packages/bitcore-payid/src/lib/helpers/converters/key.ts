import {
  CANNOT_PARSE_PRIVATEKEY,
  CANNOT_PARSE_PUBLICKEY,
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

export const toJWK = (input: string | Buffer, domain: 'private'|'public') => {
  let encoding: 'der' | 'pem' = 'der';
  let keyType = 'unknown';
  let options = {};

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

    keyType = getKeyType(input.toString());
    if (!keyType) {
      keyType = 'generic';
    }

    options = { label: `${keyType === 'generic' ? '' : keyType} ${keyDomain} key`.trim().toUpperCase() };
  } else if (typeof input === 'string') {
    // We can pretty safely assume it'll be either hex or base64.
    // Possibly could add base58 support later on, but that's probably an unnecessary edge case.
    if (/^(0x)?[0-9a-f]+$/.test(input.toLowerCase())) {
      input = Buffer.from(input, 'hex');
    } else {
      input = Buffer.from(input, 'base64');
    }
  }

  let jwk;

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

const getKeyDomain = (pem: string) => {
  let header = pem.split('\n')[0];
  const domainStartIdx = header.search(/(PUBLIC|PRIVATE)/);

  // If not an asymmetric key
  if (domainStartIdx === -1) {
    return null;
  }
  header = header.substr(domainStartIdx);
  const headerDomain = header.substr(0, header.search(/\s/));
  return headerDomain.toLowerCase();
};

const getKeyType = (pem: string) => {
  let header = pem.split('\n')[0];
  const domainStartIdx = header.search(/(PUBLIC|PRIVATE)/);

  header = header.substr(0, domainStartIdx);
  header = header.replace(/-----/g, '');
  header = header.replace('BEGIN', '');
  header = header.trim();

  return header.toLowerCase();
};