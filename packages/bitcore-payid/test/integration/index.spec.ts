import { AddressDetailsType, IdentityKeySigningParams, sign } from '@payid-org/utils';
import { expect } from 'chai';
import crypto from 'crypto';
import { JWK } from 'jose';
import sinon from 'sinon';
import PayId from '../../src/index';

describe('PayId', () => {
  let keys;
  let addressBTC;
  let addressETH;
  let addressXRP;
  const payId = 'test$example.com';

  before(() => {
    keys = crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' });

    addressBTC = {
      paymentNetwork: 'BTC',
      addressDetailsType: AddressDetailsType.CryptoAddress,
      addressDetails: {
        address: 'mhjPjyyFgdMQwyhf2CnzEqfLS3LdAqkvkF'
      }
    };

    addressETH = {
      paymentNetwork: 'ETH',
      addressDetailsType: AddressDetailsType.CryptoAddress,
      addressDetails: {
        address: '0x6c42f5bafcccdd517750d8c8bdcd9918fd1364ee'
      }
    };

    addressXRP = {
      paymentNetwork: 'XRP',
      addressDetailsType: AddressDetailsType.CryptoAddress,
      addressDetails: {
        address: 'rGpbChk5UvgMSZFYmJzQcbh7DShEBbjcng'
      }
    };
  });

  describe('verify', () => {
    let signingParams;

    beforeEach(() => {
      const pk = JWK.asKey(keys.privateKey);
      signingParams = new IdentityKeySigningParams(pk, pk.alg || 'ES256K');
    });

    describe('JWK.GeneralJWS', () => {
      it('should verify BTC', () => {
        const signed = sign(payId, addressBTC, signingParams);

        const verified = PayId.verify(payId, signed);
        expect(verified).be.true;
      });

      it('should verify XRP', () => {
        const signed = sign(payId, addressXRP, signingParams);

        const verified = PayId.verify(payId, signed);
        expect(verified).be.true;
      });

      it('should verify ETH', () => {
        const signed = sign(payId, addressETH, signingParams);

        const verified = PayId.verify(payId, signed);
        expect(verified).be.true;
      });
    });

    describe('IVerifyPayId', () => {
      it('should verify BTC', () => {
        const signed = sign(payId, addressBTC, signingParams);

        const address = {
          address: addressBTC.addressDetails.address,
          currency: addressBTC.paymentNetwork,
          signature: signed.signatures[0].signature,
          protected: signed.signatures[0].protected,
          header: signed.signatures[0].header
        };
        const verified = PayId.verify(payId, address);
        expect(verified).be.true;
      });

      it('should verify XRP', () => {
        const signed = sign(payId, addressXRP, signingParams);

        const address = {
          address: addressXRP.addressDetails.address,
          currency: addressXRP.paymentNetwork,
          signature: signed.signatures[0].signature,
          protected: signed.signatures[0].protected,
          header: signed.signatures[0].header
        };
        const verified = PayId.verify(payId, address);
        expect(verified).be.true;
      });

      it('should verify ETH', () => {
        const signed = sign(payId, addressETH, signingParams);

        const address = {
          address: addressETH.addressDetails.address,
          currency: addressETH.paymentNetwork,
          signature: signed.signatures[0].signature,
          protected: signed.signatures[0].protected,
          header: signed.signatures[0].header
        };
        const verified = PayId.verify(payId, address);
        expect(verified).be.true;
      });
    });

  });
});