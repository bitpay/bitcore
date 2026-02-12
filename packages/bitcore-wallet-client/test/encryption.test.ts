import * as chai from 'chai';
import sjcl from 'sjcl';
import { Encryption } from '../src/lib/common/encryption';

const should = chai.should();

describe('Encryption', function() {
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
    const base64Key = 'ezDRS2NRchMJLf1IWtjL5A==';
    const message = JSON.stringify({ walletPrivKey: 'some-private-key' });
    const sjclKey = sjcl.codec.base64.toBits(base64Key);
    const ct = sjcl.encrypt(sjclKey, message, { ks: 128, iter: 1 });
    const decrypted = Encryption.decryptWithKey(ct, base64Key);
    decrypted.toString().should.equal(message);
  });

  it('should decrypt data encrypted with old sjcl using password string (backward compat)', function() {
    const password = 'testPassword';
    const data = 'xprv9s21ZrQH143K3GJpoapnV8SFfukcVBSfeCficPSGfubmSFDxo1kuHnLisriDvSnRRuL2Qrg5ggqHKNVpxR86QEC8w35uxmGoggxtQTPvfUu';
    const ct = sjcl.encrypt(password, data);
    const decrypted = Encryption.decryptWithPassword(ct, password);
    decrypted.toString().should.equal(data);
  });
});