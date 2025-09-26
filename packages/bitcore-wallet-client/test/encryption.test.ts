import chai from 'chai';
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
});