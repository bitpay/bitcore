import { expect, should } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { CANNOT_PARSE_PRIVATEKEY, EXPECTED_PEM, MISSING_ENCODING, REQUIRE_PUBLIC_KEY } from '../../../src/errors';
import * as KeyConverter from '../../../src/lib/helpers/converters/key';
import EC from '../../../src/lib/helpers/keys/ec';
import Private from '../../../src/lib/helpers/keys/private';
import Public from '../../../src/lib/helpers/keys/public';
import { Private as PrivateRSA, Public as PublicRSA } from '../../../src/lib/helpers/keys/rsa';
import * as TestKeys from '../../keys';

should();

describe('Key Converter', () => {
  beforeEach(() => {
    sinon.stub(EC.prototype, 'decode').returnsThis();
    sinon.stub(EC.prototype, 'toJWK');
    sinon.stub(Private.prototype, 'decode').returnsThis();
    sinon.stub(Private.prototype, 'toJWK');
    sinon.stub(Public.prototype, 'decode').returnsThis();
    sinon.stub(Public.prototype, 'toJWK');
    sinon.stub(PrivateRSA.prototype, 'decode').returnsThis();
    sinon.stub(PrivateRSA.prototype, 'toJWK');
    sinon.stub(PublicRSA.prototype, 'decode').returnsThis();
    sinon.stub(PublicRSA.prototype, 'toJWK');
  });
  afterEach(() => {
    sinon.restore();
  });

  describe('toJWK', () => {
    let getKeyDomainStub: SinonStub;
    let getKeyTypeStub: SinonStub;

    beforeEach(() => {
      getKeyDomainStub = sinon.stub(KeyConverter, 'getKeyDomain');
      getKeyTypeStub = sinon.stub(KeyConverter, 'getKeyType');
    });
    it('should convert PEM private key', () => {
      getKeyDomainStub.returns('private');
      getKeyTypeStub.returns('');
      (Private.prototype.toJWK as SinonStub).returns('VALID');
      const result = KeyConverter.toJWK(TestKeys.EC.private.pkcs8.PEM, 'private');
      result.should.equal('VALID');
    });
    it('should convert PEM public key', () => {
      getKeyDomainStub.returns('public');
      getKeyTypeStub.returns('');
      (Public.prototype.toJWK as SinonStub).returns('VALID');
      const result = KeyConverter.toJWK(TestKeys.ED25519.public.spki.PEM, 'public');
      result.should.equal('VALID');
    });
    it('should convert PEM key passed in as bytes instead of string', () => {
      getKeyDomainStub.returns('private');
      getKeyTypeStub.returns('');
      (Private.prototype.toJWK as SinonStub).returns('VALID');
      const key = Buffer.from(TestKeys.EC.private.pkcs8.PEM);
      const result = KeyConverter.toJWK(key, 'private');
      result.should.equal('VALID');
      getKeyDomainStub.callCount.should.equal(1); // Ensure that the execution entered the pem decoding/checking path
      getKeyTypeStub.callCount.should.equal(1);
    });
    it('should convert DER private key', () => {
      (EC.prototype.toJWK as SinonStub).throws(new Error('EC'));
      (Private.prototype.toJWK as SinonStub).returns('VALID');
      (PrivateRSA.prototype.toJWK as SinonStub).throws(new Error('RSA'));
      const result = KeyConverter.toJWK(TestKeys.ED25519.private.pkcs8.DER, 'private');
      result.should.equal('VALID');
      (Private.prototype.decode as SinonStub).callCount.should.equal(1); // Should be the first one called
      (EC.prototype.decode as SinonStub).callCount.should.equal(0);
      (PrivateRSA.prototype.decode as SinonStub).callCount.should.equal(0);
    });
    it('should convert DER public key', () => {
      (Public.prototype.toJWK as SinonStub).returns('VALID');
      (PublicRSA.prototype.toJWK as SinonStub).throws(new Error('RSA'));
      const result = KeyConverter.toJWK(TestKeys.EC.public.spki.DER, 'public');
      result.should.equal('VALID');
      (Public.prototype.decode as SinonStub).callCount.should.equal(1); // Should be the first one called
      (PublicRSA.prototype.decode as SinonStub).callCount.should.equal(0);
    });
    it('should convert DER key passed in as string instead of bytes', () => {
      (Public.prototype.toJWK as SinonStub).returns('VALID');
      (PublicRSA.prototype.toJWK as SinonStub).throws(new Error('RSA'));
      const key = TestKeys.EC.public.spki.DER.toString('base64');
      const result = KeyConverter.toJWK(key, 'public', 'base64');
      result.should.equal('VALID');
      (Public.prototype.decode as SinonStub).callCount.should.equal(1); // Should be the first one called
      (PublicRSA.prototype.decode as SinonStub).callCount.should.equal(0);
    });
    it('should iterate over each format until found for unknown key type', () => {
      (EC.prototype.toJWK as SinonStub).throws(new Error('EC'));
      (Private.prototype.toJWK as SinonStub).throws(new Error('General'));
      (PrivateRSA.prototype.toJWK as SinonStub).returns('VALID');
      const result = KeyConverter.toJWK(TestKeys.RSA.private.pkcs1.DER, 'private');
      result.should.equal('VALID');
      (Private.prototype.decode as SinonStub).callCount.should.equal(1);
      (EC.prototype.decode as SinonStub).callCount.should.equal(1);
      (PrivateRSA.prototype.decode as SinonStub).callCount.should.equal(1); // Should be the last one called
    });
    it('should select specific format for specific private key type', () => {
      getKeyDomainStub.returns('private');
      getKeyTypeStub.returns('EC');
      (EC.prototype.toJWK as SinonStub).returns('VALID');
      (Private.prototype.toJWK as SinonStub).throws(new Error('General'));
      (PrivateRSA.prototype.toJWK as SinonStub).throws(new Error('RSA'));
      const result = KeyConverter.toJWK(TestKeys.EC.private.sec1.PEM, 'private');
      result.should.equal('VALID');
      (EC.prototype.decode as SinonStub).callCount.should.equal(1); // Should be the only one called
      (Private.prototype.decode as SinonStub).callCount.should.equal(0);
      (PrivateRSA.prototype.decode as SinonStub).callCount.should.equal(0);
    });
    it('should select specific format for specific public key type', () => {
      getKeyDomainStub.returns('public');
      getKeyTypeStub.returns('RSA');
      (Public.prototype.toJWK as SinonStub).throws(new Error('General'));
      (PublicRSA.prototype.toJWK as SinonStub).returns('VALID');
      const result = KeyConverter.toJWK(TestKeys.RSA.public.pkcs1.PEM, 'public');
      result.should.equal('VALID');
      (Public.prototype.decode as SinonStub).callCount.should.equal(0);
      (PublicRSA.prototype.decode as SinonStub).callCount.should.equal(1); // Should be the only one called
    });
    it('should throw error if key domain does not match', () => {
      getKeyDomainStub.returns('private'); // Key is private
      getKeyTypeStub.returns('');
      try {
        KeyConverter.toJWK(TestKeys.RSA.private.pkcs1.PEM, 'public'); // Expecting public
      } catch (err) {
        err.message.should.equal(REQUIRE_PUBLIC_KEY);
      }
    });
    it('should throw error if key is not able to be parsed', () => {
      (EC.prototype.toJWK as SinonStub).throws(new Error('EC'));
      (Private.prototype.toJWK as SinonStub).throws(new Error('General'));
      (PrivateRSA.prototype.toJWK as SinonStub).throws(new Error('RSA'));
      try {
        KeyConverter.toJWK(Buffer.from(TestKeys.Symmetric), 'private');
      } catch (err) {
        err.message.should.equal(CANNOT_PARSE_PRIVATEKEY);
        // All applicable key formats should have been tested
        (Private.prototype.decode as SinonStub).callCount.should.equal(1);
        (EC.prototype.decode as SinonStub).callCount.should.equal(1);
        (PrivateRSA.prototype.decode as SinonStub).callCount.should.equal(1);
        (Public.prototype.decode as SinonStub).callCount.should.equal(0); // Sanity check. (Private domain was expected.)
      }
    });
    it('should throw error if encoding is not provided for non-PEM string input', () => {
      try {
        KeyConverter.toJWK('blablabla', 'private');
      } catch (err) {
        err.message.should.equal(MISSING_ENCODING);
      }
    });
  });

  describe('getKeyDomain', () => {
    it('should return "PUBLIC" for public key', () => {
      const result = KeyConverter.getKeyDomain(TestKeys.EC.publicKey);
      result.should.equal('PUBLIC');
    });
    it('should return "PRIVATE" for public key', () => {
      const result = KeyConverter.getKeyDomain(TestKeys.EC.privateKey);
      result.should.equal('PRIVATE');
    });
    it('should throw error if unable to parse', () => {
      try {
        KeyConverter.getKeyDomain('THIS IS NOT A PEM STRING');
      } catch (err) {
        err.message.should.equal(EXPECTED_PEM);
      }
    });
  });

  describe('getKeyType', () => {
    it('should return "EC" for an SEC1 elliptic curve key', () => {
      const result = KeyConverter.getKeyType(TestKeys.EC.private.sec1.PEM);
      result.should.equal('EC');
    });
    it('should return "RSA" for a PKCS1 private key', () => {
      const result = KeyConverter.getKeyType(TestKeys.RSA.private.pkcs1.PEM);
      result.should.equal('RSA');
    });
    it('should return "RSA" for a PKCS1 public key', () => {
      const result = KeyConverter.getKeyType(TestKeys.RSA.public.pkcs1.PEM);
      result.should.equal('RSA');
    });
    it('should return "" for a generally-formatted private key (PKCS8)', () => {
      const result = KeyConverter.getKeyType(TestKeys.ED25519.private.pkcs8.PEM);
      result.should.equal('');
    });
    it('should return "" for a generally-formatted public key (SPKI)', () => {
      const result = KeyConverter.getKeyType(TestKeys.EC.public.spki.PEM);
      result.should.equal('');
    });
    it('should throw error if unable to parse', () => {
      try {
        KeyConverter.getKeyType('THIS IS NOT A PEM STRING');
      } catch (err) {
        err.message.should.equal(EXPECTED_PEM);
      }
    });
  });
});