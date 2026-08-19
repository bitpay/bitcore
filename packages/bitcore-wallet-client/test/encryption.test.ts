import * as chai from 'chai';
import sinon from 'sinon';
import sjcl from 'sjcl';
import { Encryption } from '../src/lib/common/encryption';

const should = chai.should();

describe('Encryption', function() {
  const sandbox = sinon.createSandbox();

  afterEach(function() {
    sandbox.restore();
  });

  it('should encrypt and decrypt object data with a password', function() {
    const password = 'testPassword';
    const data = { message: 'Hello, World!' };
    const encryptedData = Encryption.encryptWithPassword(data, password);
    const decryptedData = Encryption.decryptWithPassword(encryptedData, password);
    decryptedData.toString().should.equal(JSON.stringify(data));
  });

  it('should encrypt and decrypt string data with a password', function() {
    const password = 'testPassword';
    const data = 'Hello, World!';
    const encryptedData = Encryption.encryptWithPassword(data, password);
    const decryptedData = Encryption.decryptWithPassword(encryptedData, password);
    decryptedData.toString().should.equal(data);
  });

  it('should encrypt and decrypt buffer data with a password', function() {
    const password = 'testPassword';
    const data = Buffer.from([0xFF, 0xFE, 0x00, 0x41]); // non utf8 data
    Buffer.compare(Buffer.from(data.toString()), data).should.not.equal(0); // ensures integrity of this test
    const encryptedData = Encryption.encryptWithPassword(data, password);
    const decryptedData = Encryption.decryptWithPassword(encryptedData, password);
    Buffer.compare(decryptedData, data).should.equal(0);
  });

  it('should decrypt data encrypted with old sjcl using base64 key (backward compat)', function() {
    sandbox.spy(sjcl, 'decrypt');
    sandbox.stub(Encryption, '_baseDecrypt').throws(new Error('Native decryption failed'));

    const base64Key = 'ezDRS2NRchMJLf1IWtjL5A==';
    const message = JSON.stringify({ walletPrivKey: 'some-private-key' });
    const sjclKey = sjcl.codec.base64.toBits(base64Key);
    const ct = sjcl.encrypt(sjclKey, message, { ks: 128, iter: 1 });
    const decrypted = Encryption.decryptWithKey(ct, base64Key);
    decrypted.toString().should.equal(message);
    sjcl.decrypt.callCount.should.equal(1);
  });

  it('should decrypt data encrypted with old sjcl using password string (backward compat)', function() {
    sandbox.spy(sjcl, 'decrypt');
    sandbox.stub(Encryption, '_baseDecrypt').throws(new Error('Native decryption failed'));

    const password = 'testPassword';
    const data = 'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu';
    const ct = sjcl.encrypt(password, data);
    const decrypted = Encryption.decryptWithPassword(ct, password);
    decrypted.toString().should.equal(data);
    sjcl.decrypt.callCount.should.equal(1);
  });

  describe('encryptWithPassword', function() {
    it('should encrypt with defaults', function() {
      const password = 'testPassword';
      const data = 'Hello, World!';
      const encrypted = Encryption.encryptWithPassword(data, password);
      should.exist(encrypted.ct);
      should.exist(encrypted.iter);
      encrypted.iter.should.equal(600_000);
    });

    it('should encrypt with a specific iter', function() {
      const password = 'testPassword';
      const data = 'Hello, World!';
      const encrypted = Encryption.encryptWithPassword(data, password, { iter: 123_456 });
      should.exist(encrypted.ct);
      should.exist(encrypted.iter);
      encrypted.iter.should.equal(123_456);
    });
  });

  describe('decryptWithPassword', function() {
    const sandbox = sinon.createSandbox();
    
    afterEach(function() {
      sandbox.restore();
    });

    it('should try sjcl if native fails', function() {
      sandbox.spy(sjcl, 'decrypt');
      sandbox.stub(Encryption, '_baseDecrypt').throws(new Error('Native decryption failed'));

      const password = 'testPassword';
      const data = 'Hello, World!';
      const ct = sjcl.encrypt(password, data);

      const decrypted = Encryption.decryptWithPassword(ct, password);
      decrypted.toString().should.equal(data);
      sjcl.decrypt.callCount.should.equal(1);
    });

    it('should not try sjcl if native fails and iter > 10,000', function() {
      sandbox.spy(sjcl, 'decrypt');
      sandbox.stub(Encryption, '_baseDecrypt').throws(new Error('Native decryption failed'));

      const password = 'testPassword';
      const data = 'Hello, World!';
      const encrypted = Encryption.encryptWithPassword(data, password);
      encrypted.iter.should.be.greaterThan(10_000);
      
      (() => Encryption.decryptWithPassword(encrypted, password)).should.throw('Native decryption failed');
      sjcl.decrypt.callCount.should.equal(0);
    });

    it('should decrypt with native', function() {
      sandbox.spy(sjcl, 'decrypt');
      const password = 'testPassword';
      const data = 'Hello, World!';
      const encrypted = '{"iv":"29s7Pzi0BGPpjO44","v":1,"ts":128,"mode":"gcm","adata":"","cipher":"aes","ct":"9KK6+Ay5Uy8qfI37eMDJuCdZGDYj3s5ju2dJupc=","iter":600000,"ks":256,"salt":"xu2SC59dLsrE9ZrDQ/R7gw=="}';

      const decrypted = Encryption.decryptWithPassword(encrypted, password);
      decrypted.toString().should.equal(data);
      sjcl.decrypt.callCount.should.equal(0);
    });

    it('should decrypt with native and non-default iter', function() {
      sandbox.spy(sjcl, 'decrypt');
      const password = 'testPassword';
      const data = 'Hello, World!';
      const encrypted = '{"iv":"fKtogNpAtH/+mmwx","v":1,"ts":128,"mode":"gcm","adata":"","cipher":"aes","ct":"PZXQtwsFTpSnMSJx6SZJZOB8od9+WFfxLuZXsmA=","iter":123456,"ks":256,"salt":"l06qGURs2jidgny984uLQg=="}';

      const decrypted = Encryption.decryptWithPassword(encrypted, password);
      decrypted.toString().should.equal(data);
      sjcl.decrypt.callCount.should.equal(0);
    });
  });
});