import Bitcore from 'bitcore-lib';
import * as errors from './errors';
import { BaseJWK, ECPrivateJWK, GeneralJWS, IAddress, IVerifyPayId, PrivateJWK, PublicJWK } from './index.d';
import { toUrlBase64 } from './lib/helpers/converters/base64';
import { toJWK } from './lib/helpers/converters/key';
import JsonWebKey from './lib/helpers/keys/jwk';
import Signer from './lib/sign';
import Verifier from './lib/verify';

class PayId {
  constructor() {}

  /**
   * Sign a payId address with the given identityKey
   * @param {string} payId e.g.: "alice.smith$bitpay.com", "bob123$example.com"
   * @param {string} address BTC, ETH, or XRP address to be signed
   * @param {string} currency Currency ticker (e.g. "BTC", "ETH", "XRP")
   * @param {string | Buffer} identityKey The private key to be used for signing.
   *      Must be an asynchronous (RSA, EC) key and can have any length.
   *      **If not from bitcore-lib and is a string, it must be a PEM string**
   * @param {string} environment (Optional) Specify the chain environment. Default: 'mainnet'
   */
  async sign(payId: string, address: string, currency: string, identityKey: string | Buffer, environment: string = 'mainnet'): Promise<GeneralJWS> {
    let jwk: PrivateJWK = this._convertIdentityKeyToJWK(identityKey);

    const addy: IAddress = {
      paymentNetwork: currency,
      environment,
      addressDetailsType: 'CryptoAddressDetails',
      addressDetails: {
        address
      }
    };

    const sig = await Signer.sign({ payId, payIdAddress: addy }, jwk);
    return sig;
  }

  /**
   * Verify the address for the payId
   * @param {string} payId e.g.: "alice.smith$bitpay.com", "bob.acosta$example.com"
   * @param {IVerifyPayId | GeneralJWS} params Verifiable address payload.
   *    e.g. {
   *      address: 'rGpbChk5UvgMSZFYmJzQcbh7DShEBbjcng',
   *      currency: 'XRPL',
   *      signature: 'somefancysignature',
   *      protected: 'base64StringGeneratedAtTheSignatureRunTime'
   *    }
   */
  async verify(payId: string, params: IVerifyPayId | GeneralJWS): Promise<boolean> {
    let payload: GeneralJWS = this._paramsToJWS(payId, params);

    const retval = await Verifier.verify(payId, payload);
    return retval;
  }

  /**
   * Get the thumbprint of the public key used to verify signature.
   * @param {string} protectedHeader Protected header from JWS.
   * @param {BufferEncoding} thumbprintEncoding (optional) String encoding for thumbprint. Default: hex
   */
  getThumbprint(protectedHeader: string, thumbprintEncoding?: BufferEncoding) {
    const parsedProt = JSON.parse(Buffer.from(protectedHeader, 'base64').toString());

    const jwk: PublicJWK = new JsonWebKey(parsedProt.jwk, 'public');
    return jwk.getThumbprint(thumbprintEncoding);
  }

  /**
   * Convert simple input (IVerifyPayId) to JWS.
   * @param {string} payId e.g.: "alice.smith$bitpay.com", "bob.acosta$example.com"
   * @param {IVerifyPayId | GeneralJWS} params Verifiable address payload.
   */
  private _paramsToJWS(payId: string, params: IVerifyPayId | GeneralJWS): GeneralJWS {
    let payload: GeneralJWS = params as GeneralJWS;

    if ((params as IVerifyPayId).address) {
      params = params as IVerifyPayId;
      payload = {
        payload: JSON.stringify({
          payId,
          payIdAddress: {
            paymentNetwork: params.currency,
            addressDetailsType: 'CryptoAddressDetails',
            addressDetails: {
              address: params.address
            }
          }
        }),
        signatures: [{
          protected: params.protected,
          signature: params.signature,
        }]
      };
    }
    return payload;
  }

  /**
   * Converts identity key string to JWK for signing
   * @param {string | Buffer} key Key to use for signing. Must be the private key of an asynchronous pair.
   *      Strings needs to be in PEM format unless it's a bitcore-lib ECDSA key
   */
  private _convertIdentityKeyToJWK(key: string | Buffer): PrivateJWK {
    let _key;

    // 1. First test if it's a Bitcore hierarchically derived private key

    // Is a public key?
    // Need to check this first b/c the private key check will return true for a pub key and create an entirely new priv key seeded from the pub key
    if (Bitcore.HDPublicKey.isValidSerialized(key)) {
      throw new Error(errors.REQUIRE_PRIVATE_KEY);
    } else if (Bitcore.HDPrivateKey.isValidSerialized(key)) {
      try {
        _key = key.toString('hex');
        _key = Bitcore.HDPrivateKey.fromString(key);
        _key = _key.privateKey;
        return this._buildJWKFromBitcore(_key);
      } catch (err) {
        _key = null; // Reset to nothing
        // Continue flow in case the key can successfully be converted below.
      }
    }

    // 2. Test if it's a Bitcore regular private key

    // Is it a public key?
    if (Bitcore.PublicKey.isValid(key)) {
      throw new Error(errors.REQUIRE_PRIVATE_KEY);
    } else if (Bitcore.PrivateKey.isValid(key)) {
      try {
        _key = key.toString('hex');
        _key = Bitcore.PrivateKey.fromString(key);
        return this._buildJWKFromBitcore(_key);
      } catch (err) {
        _key = null; // Reset to nothing
        // Continue flow in case the key can successfully be converted below.
      }
    }

    // No try-catch b/c if this doesn't succeed then the key won't be able to sign and it needs to blow up
    _key = toJWK(key as any, 'private');

    // if (_key.type === 'secret') {
    //   throw new Error(errors.NO_SYNC_KEY__PRIVATE);
    // } else if (_key.type !== 'private') {
    //   throw new Error(errors.REQUIRE_PRIVATE_KEY);
    // }

    return _key;
  }

  /**
   * Builds a JWK from a bitcore-lib ECDSA private key
   * @param bitcoreKey Private key generated by bitcore-lib. Should not be an HD key, but an HD key can pass in it's 'privateKey' property.
   */
  private _buildJWKFromBitcore(bitcoreKey: Bitcore.PrivateKey): ECPrivateJWK {
      // Need to extract and format the curve points to base64...
      const toBase64 = (input) => {
        input = input.toString(16);
        input = input.length % 2 === 1 ? '0' + input : input; // Ensure it's padded
        const buf = Buffer.from(input, 'hex');
        return toUrlBase64(buf);
      };
      const d = toBase64(bitcoreKey.toBigNumber());
      const x = toBase64(bitcoreKey.publicKey.point.getX());
      const y = toBase64(bitcoreKey.publicKey.point.getY());

      // ...then convert to JWK.
      const jwk: BaseJWK.ECPrivate = {
        kty: 'EC',
        use: 'sig',
        crv: 'secp256k1',
        x,
        y,
        d
      };
      return new JsonWebKey(jwk, 'private');
  }
}

export default new PayId();