import {
  AddressDetailsType,
  IdentityKeySigningParams,
  sign,
  toKey
} from '@payid-org/utils';
import Bitcore from 'bitcore-lib';
import { expect } from 'chai';
import crypto from 'crypto';
import sinon from 'sinon';
import * as errors from '../../src/errors';
import PayId from '../../src/index';

describe('PayId', () => {
  let keys;
  let addressBTC;
  let addressETH;
  let addressXRP;
  const payId = 'test$example.com';

  before(() => {
    keys = {
      bitcoreHD: new Bitcore.HDPrivateKey(),
      bitcore: new Bitcore.PrivateKey(),
      ec: crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1', privateKeyEncoding: { format: 'pem', type: 'pkcs8' }, publicKeyEncoding: { format: 'pem', type: 'spki' } }),
      rsa: crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { format: 'pem', type: 'pkcs8' }, publicKeyEncoding: { format: 'pem', type: 'spki' } }),
      sym: crypto.createSecretKey(crypto.randomBytes(32)).export()
    };

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

  describe('sign', () => {
    it('should sign with Bitcore HD key', () => {
      const signed = PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.bitcoreHD.toString());

      expect(signed).to.exist;
      expect(signed).to.have.property('payload');
      expect(signed.payload).to.be.a.string;
      expect(signed).to.have.property('signatures');
      expect(signed.signatures.length).to.equal(1);
    });

    it('should sign with Bitcore non-HD key', () => {
      const signed = PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.bitcore.toString());

      expect(signed).to.exist;
      expect(signed).to.have.property('payload');
      expect(signed.payload).to.be.a.string;
      expect(signed).to.have.property('signatures');
      expect(signed.signatures.length).to.equal(1);
    });

    it('should sign with crypto-created EC key', () => {
      const signed = PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.ec.privateKey);

      expect(signed).to.exist;
      expect(signed).to.have.property('payload');
      expect(signed.payload).to.be.a.string;
      expect(signed).to.have.property('signatures');
      expect(signed.signatures.length).to.equal(1);
    });

    it('should sign with crypto-created RSA key', () => {
      const signed = PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.rsa.privateKey);

      expect(signed).to.exist;
      expect(signed).to.have.property('payload');
      expect(signed.payload).to.be.a.string;
      expect(signed).to.have.property('signatures');
      expect(signed.signatures.length).to.equal(1);
    });

    it('should fail signing with Bitcore HD public key', () => {
      try {
        const pk = new Bitcore.HDPublicKey(keys.bitcoreHD);
        PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', pk.toString());
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
      }
    });

    it('should fail signing with Bitcore non-HD public key', () => {
      try {
        const pk = new Bitcore.PublicKey(keys.bitcore);
        PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', pk.toString());
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
      }
    });

    it('should fail signing with EC public key', () => {
      try {
        PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.ec.publicKey);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
      }
    });

    it('should fail signing with RSA public key', () => {
      try {
        PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.rsa.publicKey);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
      }
    });

    it('should fail signing with symmetric key', () => {
      try {
        PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.sym);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.NO_SYNC_KEY__PRIVATE);
      }
    });
  });

  describe('verify', () => {
    let signingParams;

    beforeEach(() => {
      const pk = toKey(keys.ec.privateKey);
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

  describe('sign & verify', () => {
    it('should work with Bitcore HD key', () => {
      const signed = PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.bitcoreHD.toString());
      expect(signed).to.exist;

      const verified = PayId.verify(payId, signed);
      expect(verified).be.true;
    });

    it('should work with Bitcore non-HD key', () => {
      const signed = PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.bitcore.toString());
      expect(signed).to.exist;

      const verified = PayId.verify(payId, signed);
      expect(verified).be.true;
    });

    it('should work with crypto-created EC key', () => {
      const signed = PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.ec.privateKey);
      expect(signed).to.exist;

      const verified = PayId.verify(payId, signed);
      expect(verified).be.true;
    });

    it('should work with crypto-created RSA key', () => {
      const signed = PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.rsa.privateKey);
      expect(signed).to.exist;

      const verified = PayId.verify(payId, signed);
      expect(verified).be.true;
    });
  });

  describe('_convertIdentityKeyToJWK', () => {
    let _buildJWKFromBitcore;
    beforeEach(() => {
      _buildJWKFromBitcore = sinon.spy(PayId, '_buildJWKFromBitcore');
    });
    afterEach(() => {
      sinon.restore();
    });
    it('should convert Bitcore HD private key', () => {
      const jwk = PayId['_convertIdentityKeyToJWK'](keys.bitcoreHD.toString());
      expect(jwk).to.exist;
      expect(jwk.kty).to.equal('EC');
      expect(jwk.private).to.be.true;
      expect(_buildJWKFromBitcore.callCount).to.equal(1);
    });

    it('should convert Bitcore non-HD private key', () => {
      const jwk = PayId['_convertIdentityKeyToJWK'](keys.bitcore.toString());
      expect(jwk).to.exist;
      expect(jwk.kty).to.equal('EC');
      expect(jwk.private).to.be.true;
      expect(_buildJWKFromBitcore.callCount).to.equal(1);
    });

    it('should convert EC private key', () => {
      const jwk = PayId['_convertIdentityKeyToJWK'](keys.ec.privateKey);
      expect(jwk).to.exist;
      expect(jwk.kty).to.equal('EC');
      expect(jwk.private).to.be.true;
      expect(_buildJWKFromBitcore.callCount).to.equal(0);
    });

    it('should convert RSA private key', () => {
      const jwk = PayId['_convertIdentityKeyToJWK'](keys.rsa.privateKey);
      expect(jwk).to.exist;
      expect(jwk.kty).to.equal('RSA');
      expect(jwk.private).to.be.true;
      expect(_buildJWKFromBitcore.callCount).to.equal(0);
    });

    it('should fail to convert Bitcore HD public key', () => {
      try {
        const pk = new Bitcore.HDPublicKey(keys.bitcoreHD);
        PayId['_convertIdentityKeyToJWK'](pk.toString());
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
        expect(_buildJWKFromBitcore.callCount).to.equal(0);
      }
    });

    it('should fail to convert Bitcore non-HD public key', () => {
      try {
        const pk = new Bitcore.PublicKey(keys.bitcore);
        PayId['_convertIdentityKeyToJWK'](pk.toString());
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
        expect(_buildJWKFromBitcore.callCount).to.equal(0);
      }
    });

    it('should fail to convert EC public key', () => {
      try {
        PayId['_convertIdentityKeyToJWK'](keys.ec.publicKey);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
        expect(_buildJWKFromBitcore.callCount).to.equal(0);
      }
    });

    it('should fail to convert RSA public key', () => {
      try {
        PayId['_convertIdentityKeyToJWK'](keys.rsa.publicKey);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
        expect(_buildJWKFromBitcore.callCount).to.equal(0);
      }
    });

    it('should fail to convert symmetric key', () => {
      try {
        PayId['_convertIdentityKeyToJWK'](keys.sym);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.NO_SYNC_KEY__PRIVATE);
        expect(_buildJWKFromBitcore.callCount).to.equal(0);
      }
    });

  });
});