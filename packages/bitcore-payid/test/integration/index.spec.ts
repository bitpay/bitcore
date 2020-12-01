import Bitcore from 'bitcore-lib';
import { expect } from 'chai';
import sinon from 'sinon';
import * as errors from '../../src/errors';
import PayId from '../../src/index';
import * as utils from '../../src/lib/utils';
import Verify from '../../src/lib/verify';
import * as TestKeys from '../keys';
import TestSignatures from '../signatures';

describe('PayId', () => {
  let keys;
  let addressBTC;
  let addressETH;
  let addressXRP;
  const payId = 'test$example.com';

  before(() => {
    keys = {
      bitcoreHD: Bitcore.HDPrivateKey.fromString(TestKeys.BitcoreHD),
      bitcore: Bitcore.PrivateKey.fromString(TestKeys.Bitcore),
      ec: TestKeys.EC,
      ed25519: TestKeys.ED25519,
      rsa: TestKeys.RSA,
      sym: TestKeys.Symmetric
    };

    addressBTC = {
      paymentNetwork: 'BTC',
      addressDetailsType: 'CryptoAddressDetails',
      addressDetails: {
        address: 'mhjPjyyFgdMQwyhf2CnzEqfLS3LdAqkvkF'
      }
    };

    addressETH = {
      paymentNetwork: 'ETH',
      addressDetailsType: 'CryptoAddressDetails',
      addressDetails: {
        address: '0x6c42f5bafcccdd517750d8c8bdcd9918fd1364ee'
      }
    };

    addressXRP = {
      paymentNetwork: 'XRP',
      addressDetailsType: 'CryptoAddressDetails',
      addressDetails: {
        address: 'rGpbChk5UvgMSZFYmJzQcbh7DShEBbjcng'
      }
    };
  });

  describe('sign', () => {
    it('should sign with Bitcore HD key', async () => {
      const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.bitcoreHD.toString());

      expect(signed).to.exist;
      expect(signed).to.have.property('payload');
      expect(typeof signed.payload).to.equal('string');
      expect(signed).to.have.property('signatures');
      expect(signed.signatures.length).to.equal(1);
    });

    it('should sign with Bitcore non-HD key', async () => {
      const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.bitcore.toString());

      expect(signed).to.exist;
      expect(signed).to.have.property('payload');
      expect(typeof signed.payload).to.equal('string');
      expect(signed).to.have.property('signatures');
      expect(signed.signatures.length).to.equal(1);
    });

    it('should sign with crypto-created EC key', async () => {
      const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.ec.privateKey);

      expect(signed).to.exist;
      expect(signed).to.have.property('payload');
      expect(typeof signed.payload).to.equal('string');
      expect(signed).to.have.property('signatures');
      expect(signed.signatures.length).to.equal(1);
    });

    it('should sign with crypto-created ED25519 key', async () => {
      const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.ed25519.privateKey);

      expect(signed).to.exist;
      expect(signed).to.have.property('payload');
      expect(typeof signed.payload).to.equal('string');
      expect(signed).to.have.property('signatures');
      expect(signed.signatures.length).to.equal(1);
    });

    it('should sign with crypto-created RSA key', async () => {
      const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.rsa.privateKey);

      expect(signed).to.exist;
      expect(signed).to.have.property('payload');
      expect(typeof signed.payload).to.equal('string');
      expect(signed).to.have.property('signatures');
      expect(signed.signatures.length).to.equal(1);
    });

    it('should fail signing with Bitcore HD public key', async () => {
      try {
        const pk = new Bitcore.HDPublicKey(keys.bitcoreHD);
        await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', pk.toString());
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
      }
    });

    it('should fail signing with Bitcore non-HD public key', async () => {
      try {
        const pk = new Bitcore.PublicKey(keys.bitcore);
        await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', pk.toString());
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
      }
    });

    it('should fail signing with EC public key', async () => {
      try {
        await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.ec.publicKey);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
      }
    });

    it('should fail signing with RSA public key', async () => {
      try {
        await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.rsa.publicKey);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.REQUIRE_PRIVATE_KEY);
      }
    });

    it('should fail signing with symmetric key', async () => {
      try {
        await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.sym);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).to.equal(errors.CANNOT_PARSE_PRIVATEKEY);
      }
    });
  });

  describe('verify', () => {
    describe('PayId.org utils signatures', () => {
      let signatures;
      before(() => {
        // These signatures were created with PayId official utils
        signatures = TestSignatures.payIdOrgUtils;
      });

      it('should fail verification if payId doesn\'t match', async () => {
        const verified = await PayId.verify('malicious$example.com', signatures.bitcoreHD.BTC);
        expect(verified).be.false;
      });

      it('should fail verification if signature doesn\'t match', async () => {
        const address = {
          address: addressETH.addressDetails.address,
          currency: addressETH.paymentNetwork,
          signature: 'NfhVzyoQmTv_tAo1QhFYN8GDSBRm-AvA9OzsVUmtaGr8hS-Or9k1dZVPUFvIW6E6rBt2BSngR54d2LdEPiW-2Q',
          protected: signatures.secp256k1.ETH.signatures[0].protected,
          header: signatures.secp256k1.ETH.signatures[0].header
        };

        const verified = await PayId.verify(payId, address);
        expect(verified).be.false;
      });

      it('should fail verification if protected doesn\'t contain correct public key', async () => {
        const address = {
          address: addressETH.addressDetails.address,
          currency: addressETH.paymentNetwork,
          signature: signatures.secp256k1.ETH.signatures[0].signature,
          protected: 'eyJuYW1lIjoiaWRlbnRpdHlLZXkiLCJhbGciOiJFUzI1NksiLCJ0eXAiOiJKT1NFK0pTT04iLCJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCIsIm5hbWUiXSwiandrIjp7ImNydiI6InNlY3AyNTZrMSIsIngiOiI3dFpzS0h6SDZtSWJ1UnRaS1FLbE1LR1hFY1plbmlGTkVqQTM0TXc5eDk4IiwieSI6ImRDb0R2QnhpV3RJVDk0M3FtYU1TdDQyR0cyTFdsMkp2MzhaRGpCYmI5ekEiLCJrdHkiOiJFQyIsImtpZCI6Im00NldjeHN0Z29iTGR2NGpJbTNhcl9pUmJVa280QnZyU3FMR1NKM1pBSWMifX0',
          header: signatures.secp256k1.ETH.signatures[0].header
        };

        const verified = await PayId.verify(payId, address);
        expect(verified).be.false;
      });

      describe('keys', () => {
        it('should verify signature signed with EC key', async () => {
          const verified = await PayId.verify(payId, signatures.secp256k1.BTC);
          expect(verified).be.true;
        });
        it('should verify signature signed with ED25519 key', async () => {
          const verified = await PayId.verify(payId, signatures.ed25519.BTC);
          expect(verified).be.true;
        });
        it('should verify signature signed with RSA key', async () => {
          const inBrowserSpy = sinon.spy(utils, 'inBrowser');
          const _inBrowserVerifySpy = sinon.spy(Verify, '_verifyInBrowserRSA' as any); // use 'as any' to bypass sinon's typescript restriction to public class members
          const _nodeVerifySpy = sinon.spy(Verify, '_verifyNodeRSA' as any);

          const verified = await PayId.verify(payId, signatures.rsa.BTC);
          expect(verified).be.true;

          expect(inBrowserSpy.callCount).to.equal(1);
          if (utils.inBrowser()) {
            expect(_inBrowserVerifySpy.callCount).to.equal(1);
            expect(_nodeVerifySpy.callCount).to.equal(0);
          } else {
            expect(_inBrowserVerifySpy.callCount).to.equal(0);
            expect(_nodeVerifySpy.callCount).to.equal(1);
          }
        });
      });

      describe('GeneralJWS', () => {
        it('should verify BTC', async () => {
          const verified = await PayId.verify(payId, signatures.bitcoreHD.BTC);
          expect(verified).be.true;
        });

        it('should verify XRP', async () => {
          const verified = await PayId.verify(payId, signatures.secp256k1.XRP);
          expect(verified).be.true;
        });

        it('should verify ETH', async () => {
          const verified = await PayId.verify(payId, signatures.secp256k1.ETH);
          expect(verified).be.true;
        });
      });

      describe('IVerifyPayId', () => {
        it('should verify BTC', async () => {
          const address = {
            address: addressBTC.addressDetails.address,
            currency: addressBTC.paymentNetwork,
            signature: signatures.bitcoreHD.BTC.signatures[0].signature,
            protected: signatures.bitcoreHD.BTC.signatures[0].protected,
            header: signatures.bitcoreHD.BTC.signatures[0].header
          };
          const verified = await PayId.verify(payId, address);
          expect(verified).be.true;
        });

        it('should verify XRP', async () => {
          const address = {
            address: addressXRP.addressDetails.address,
            currency: addressXRP.paymentNetwork,
            signature: signatures.secp256k1.XRP.signatures[0].signature,
            protected: signatures.secp256k1.XRP.signatures[0].protected,
            header: signatures.secp256k1.XRP.signatures[0].header
          };
          const verified = await PayId.verify(payId, address);
          expect(verified).be.true;
        });

        it('should verify ETH', async () => {
          const address = {
            address: addressETH.addressDetails.address,
            currency: addressETH.paymentNetwork,
            signature: signatures.secp256k1.ETH.signatures[0].signature,
            protected: signatures.secp256k1.ETH.signatures[0].protected,
            header: signatures.secp256k1.ETH.signatures[0].header
          };
          const verified = await PayId.verify(payId, address);
          expect(verified).be.true;
        });
      });
    });
  });

  describe('sign & verify', () => {
    it('should work with Bitcore HD key', async () => {
      const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.bitcoreHD.toString());
      expect(signed).to.exist;

      const verified = await PayId.verify(payId, signed);
      expect(verified).be.true;
    });

    it('should work with Bitcore non-HD key', async () => {
      const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.bitcore.toString());
      expect(signed).to.exist;

      const verified = await PayId.verify(payId, signed);
      expect(verified).be.true;
    });

    it('should work with crypto-created EC key', async () => {
      const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.ec.privateKey);
      expect(signed).to.exist;

      const verified = await PayId.verify(payId, signed);
      expect(verified).be.true;
    });

    it('should work with crypto-created RSA key', async () => {
      const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.rsa.privateKey);
      expect(signed).to.exist;

      const verified = await PayId.verify(payId, signed);
      expect(verified).be.true;
    });
    if (!utils.inBrowser()) {
      describe('Verify with PayId.org official utils', () => {
        const { verifySignedAddress } = require('@payid-org/utils');

        it('should verify BitcoreHD signature created with this lib', async () => {
          const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.bitcoreHD.toString());
          const verified = verifySignedAddress(payId, signed);
          expect(verified).to.be.true;
        });

        it('should verify Bitcore signature created with this lib', async () => {
          const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.bitcore.toString());
          const verified = verifySignedAddress(payId, signed);
          expect(verified).to.be.true;
        });

        it('should verify EC signature created with this lib', async () => {
          const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.ec.privateKey);
          const verified = verifySignedAddress(payId, signed);
          expect(verified).to.be.true;
        });

        it('should verify ED25519 signature created with this lib', async () => {
          const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.ed25519.privateKey);
          const verified = verifySignedAddress(payId, signed);
          expect(verified).to.be.true;
        });

        it('should verify RSA signature created with this lib', async () => {
          const signed = await PayId.sign(payId, addressBTC.addressDetails.address, 'BTC', keys.rsa.privateKey);
          const verified = verifySignedAddress(payId, signed);
          expect(verified).to.be.true;
        });

      });
    }
  });

  describe('_convertIdentityKeyToJWK', () => {
    let _buildJWKFromBitcore;
    beforeEach(() => {
      _buildJWKFromBitcore = sinon.spy(PayId, '_buildJWKFromBitcore' as any); // use 'as any' to bypass sinon's typescript restriction to public class members
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
        expect(err.message).to.equal(errors.CANNOT_PARSE_PRIVATEKEY);
        expect(_buildJWKFromBitcore.callCount).to.equal(0);
      }
    });
  });

  describe('getThumbprint', () => {
    it('should return thumbprint', () => {
      const hex = PayId.getThumbprint(TestSignatures.payIdOrgUtils.bitcoreHD.BTC.signatures[0].protected);
      hex.should.equal('93b533499a6040c03a0bb1ee80ef1da29483666af56a662698b2a2ecda11d54a');
    });
    it('should return base64 thumbprint', () => {
      const b64 = PayId.getThumbprint(TestSignatures.payIdOrgUtils.secp256k1.XRP.signatures[0].protected, 'base64');
      b64.should.equal('ZxahBqJcANxKDSwlLcdhFv0l5UXjgk9NXD5l6Y2Bkfg');
    });
  });
});