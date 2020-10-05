import {
  AddressDetailsType,
  verifySignedAddress,
} from '@payid-org/utils';
import { JWS } from 'jose';
import { IVerifyPayId } from './index.d';

class PayId {
  constructor() {}

  /**
   * Sign a payId address with the given identityKey
   * @param {string} payId
   * @param {string} address Address to be signed
   * @param {string} currency Currency ticker (e.g. BTC, ETH, XRP)
   * @param {string} identityKey The key to be used for signing
   */
  sign(payId: string, address: string, currency: string, identityKey: string): JWS.GeneralJWS {
    // TODO
    return {} as JWS.GeneralJWS;
  }

  /**
   * Verify the address for the payId
   * @param {string} payId
   * @param {IVerifyPayId | JWS.GeneralJWS} params Verifiable address payload
   */
  verify(payId: string, params: IVerifyPayId | JWS.GeneralJWS): boolean {
    let payload: JWS.GeneralJWS = params as JWS.GeneralJWS;

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