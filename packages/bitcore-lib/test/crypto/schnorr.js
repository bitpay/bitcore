const testVectors = require('../data/bip340');
const Schnorr = require('../../lib/crypto/schnorr');

describe('Schnorr', () => {
  describe('verify', () => {
    for (let vector of testVectors) {
      it(`should verify schnorr - vector ${vector.index}`, () => {
        const pubKeyBuf = Buffer.from(vector.public_key, 'hex');
        const verified = Schnorr.verify(pubKeyBuf, vector.message, vector.signature);
        verified.should.equal(vector.verification_result);
      });
    }
  });

  describe(('sign'), () => {
    for (let vector of testVectors) {
      if (vector.secret_key) {
        it(`should sign schnorr - vector ${vector.index}`, () => {
          const privKeyBuf = Buffer.from(vector.secret_key, 'hex');
          const sig = Schnorr.sign(privKeyBuf, vector.message, vector.aux_rand);
          sig.toString('hex').toUpperCase().should.equal(vector.signature);
        });
      }
    }
  });
});