import {
  AddressDetailsType,
  verifySignedAddress,
} from '@payid-org/utils';
import { GeneralJWS, IVerifyPayId } from './index.d';

class PayId {
  constructor() {}

  /**
   * Sign a payId address with the given identityKey
   * @param {string} payId e.g.: "alice.smith$bitpay.com", "bob.acosta$example.com"
   * @param {string} address BTC, ETH, or XRP address to be signed
   * @param {string} currency Currency ticker (e.g. "BTC", "ETH", "XRP")
   * @param {string} identityKey The key to be used for signing.
   *      Must be an ASN.1 formattable key. https://en.wikipedia.org/wiki/ASN.1
   *      Can be a asynchronous (RSA, EC) private key or a synchronous (Oct, OTP) key and can have any length.
   */
  sign(payId: string, address: string, currency: string, identityKey: string): GeneralJWS {
    // TODO
    return {} as GeneralJWS;
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
  verify(payId: string, params: IVerifyPayId | GeneralJWS): boolean {
    let payload: GeneralJWS = params as GeneralJWS;

    if ((params as IVerifyPayId).address) {
      params = params as IVerifyPayId;
      payload = {
        payload: JSON.stringify({
          payId,
          payIdAddress: {
            paymentNetwork: params.currency,
            addressDetailsType: AddressDetailsType.CryptoAddress,
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

    const retval = verifySignedAddress(payId, JSON.stringify(payload));
    return retval;
  }
}

export default new PayId();