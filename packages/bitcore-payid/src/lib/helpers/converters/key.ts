import {
  CANNOT_PARSE_PRIVATEKEY,
  CANNOT_PARSE_PUBLICKEY,
  REQUIRE_PRIVATE_KEY,
  REQUIRE_PUBLIC_KEY
} from '../../../errors';
import PKCS1 from '../keys/pkcs1';
import PKCS8 from '../keys/pkcs8';
import SEC1 from '../keys/sec1';
import SPKI from '../keys/spki';

type PublicKeyFromat = 'PKCS1' | 'SPKI';
type PrivateKeyFormat = 'PKCS1' | 'PKCS8' | 'SEC1';
type KeyFormat = PublicKeyFromat | PrivateKeyFormat;

export const toJWK = (input: string | Buffer, domain: 'private'|'public') => {
  let encoding: 'der' | 'pem' = 'der';

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
  } else if (typeof input === 'string') {
    if (/^(0x)?[0-9a-f]+$/.test(input.toLowerCase())) {
      input = Buffer.from(input, 'hex');
    } else {
      input = Buffer.from(input, 'base64');
    }
  }

  let jwk;
  let format: KeyFormat = null;
  switch (domain) {
    case 'private':
    default:
      try {
        jwk = PKCS8.decode(input, encoding, { label: 'private key' }).toJWK();
        format = 'PKCS8';
      } catch (err) {
        try {
          jwk = SEC1.decode(input, encoding, { label: 'ec private key' }).toJWK();
          format = 'SEC1';
        } catch (err) {
          try {
            jwk = PKCS1.private.decode(input, encoding, { label: 'rsa private key' }).toJWK();
            format = 'PKCS1';
          } catch (err) {
            throw new Error(CANNOT_PARSE_PRIVATEKEY);
          }
        }
      }
      break;
    case 'public':
      try {
        jwk = SPKI.decode(input, encoding).toJWK();
        format = 'SPKI';
      } catch (err) {
        try {
          jwk = PKCS1.public.decode(input, encoding).toJWK();
          format = 'PKCS1';
        } catch (err) {
          throw new Error(CANNOT_PARSE_PUBLICKEY);
        }
      }
      break;
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