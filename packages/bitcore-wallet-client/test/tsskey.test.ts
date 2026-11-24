import * as chai from 'chai';
import sinon from 'sinon';
import sjcl from 'sjcl';
import { Deriver } from '@bitpay-labs/crypto-wallet-core';
import { Constants, Encryption } from '../src/lib/common';
import { Key } from '../src/lib/key';
import { TssKey } from '../src/lib/tsskey';

const should = chai.should();

// Synthetic shares isolate encryption/export; no real DKG is performed.
const fullShare = Buffer.from('test-only full share');
const reducedShare = Buffer.from('test-only reduced share');

function newTssKey(baseKey: Key): TssKey {
  return new TssKey({
    ...baseKey.toObj(),
    keychain: {
      // encrypt zeroes its inputs; keep the originals for round-trip checks.
      privateKeyShare: Buffer.from(fullShare),
      reducedPrivateKeyShare: Buffer.from(reducedShare),
      commonKeyChain:
        '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798' +
        '00'.repeat(32),
    },
    metadata: { id: 'test-only', m: 2, n: 3, partyId: 0 },
  });
}

function assertNoPlaintextSecrets(exported) {
  should.not.exist(exported.xPrivKey);
  should.not.exist(exported.xPrivKeyEDDSA);
  should.not.exist(exported.mnemonic);
  should.not.exist(exported.keychain.privateKeyShare);
  should.not.exist(exported.keychain.reducedPrivateKeyShare);
}

describe('TssKey encryption', function() {
  this.timeout(20000);

  const password = 'test-only-password';
  const sandbox = sinon.createSandbox();

  afterEach(function() {
    sandbox.restore();
  });

  it('should not export a plaintext EDDSA root after password encryption', function() {
    // Generate a fresh base Key containing both algorithms.
    const baseKey = new Key({ seedType: 'new' });
    const original = baseKey.toObj();
    original.xPrivKeyEDDSA.should.be.a('string');

    const tssKey = newTssKey(baseKey);
    tssKey.encrypt(password); // Use default password-encryption parameters.
    const backup = JSON.parse(JSON.stringify(tssKey.toObj()));

    assertNoPlaintextSecrets(backup);
    should.exist(backup.xPrivKeyEncrypted);
    should.exist(backup.xPrivKeyEDDSAEncrypted);
    should.exist(backup.mnemonicEncrypted);
    should.exist(backup.keychain.privateKeyShareEncrypted);
    should.exist(backup.keychain.reducedPrivateKeyShareEncrypted);

    const restored = tssKey.get(password);
    restored.xPrivKey.should.equal(original.xPrivKey);
    restored.mnemonic.should.equal(original.mnemonic);
    restored.keychain.privateKeyShare.should.deep.equal(fullShare);
    restored.keychain.reducedPrivateKeyShare.should.deep.equal(reducedShare);

    // The EDDSA root decrypts with the password and still derives the original SOL child key.
    const solPath = "m/44'/501'/0'/0'";
    const expected = Deriver.derivePrivateKeyWithPath('SOL', 'livenet', original.xPrivKeyEDDSA, solPath, null);
    const restoredEddsa = new TssKey(backup).get(password, 'EDDSA').xPrivKey;
    const fromBackup = Deriver.derivePrivateKeyWithPath('SOL', 'livenet', restoredEddsa, solPath, null);
    fromBackup.privKey.should.equal(expected.privKey);
    fromBackup.pubKey.should.equal(expected.pubKey);
  });

  it('should encrypt and decrypt a key that has no EDDSA root', function() {
    const baseKey = new Key({ seedType: 'new', algo: 'ECDSA' });
    const original = baseKey.toObj();
    const tssKey = newTssKey(baseKey);

    tssKey.encrypt(password);

    assertNoPlaintextSecrets(tssKey.toObj());
    should.not.exist((tssKey.toObj() as any).xPrivKeyEDDSAEncrypted);

    tssKey.decrypt(password);

    const restored = tssKey.get(null);
    restored.xPrivKey.should.equal(original.xPrivKey);
    restored.mnemonic.should.equal(original.mnemonic);
    restored.keychain.privateKeyShare.should.deep.equal(fullShare);
    restored.keychain.reducedPrivateKeyShare.should.deep.equal(reducedShare);
  });

  it('should encrypt the keychain of a key whose roots were encrypted at construction', function() {
    const tssKey = newTssKey(new Key({ seedType: 'new', password }));

    tssKey.encrypt(password);

    assertNoPlaintextSecrets(tssKey.toObj());
    tssKey.isKeyChainEncrypted().should.be.true;
    (() => tssKey.encrypt(password)).should.throw('Keychain is already encrypted');
  });

  it('should reject a different password than the one encrypting the roots', function() {
    const tssKey = newTssKey(new Key({ seedType: 'new', password }));

    (() => tssKey.encrypt('other')).should.throw('different password');

    tssKey.isKeyChainEncrypted().should.be.false;
    tssKey.keychain.privateKeyShare.should.deep.equal(fullShare);
  });

  it('should encrypt a plaintext EDDSA root left beside an encrypted keychain', function() {
    // Shape of a key encrypted before TssKey.encrypt covered the EDDSA root.
    const baseKey = new Key({ seedType: 'new' });
    baseKey.encrypt(password, null, 'ECDSA');
    const tssKey = newTssKey(baseKey);
    tssKey.keychain.privateKeyShareEncrypted = 'x';
    tssKey.keychain.reducedPrivateKeyShareEncrypted = 'x';
    tssKey.keychain.privateKeyShare = null;
    tssKey.keychain.reducedPrivateKeyShare = null;
    tssKey.hasPlaintextPrivKey().should.be.true;

    tssKey.encrypt(password);

    tssKey.hasPlaintextPrivKey().should.be.false;
    should.not.exist((tssKey.toObj() as any).xPrivKeyEDDSA);
    tssKey.checkPassword(password, 'EDDSA').should.be.true;
    tssKey.keychain.privateKeyShareEncrypted.should.equal('x');
  });

  it('should preserve an EDDSA root encrypted under an older password', function() {
    const baseKey = new Key({ seedType: 'new', password: 'old-password' });
    baseKey.decrypt('old-password', 'ECDSA');
    baseKey.encrypt(password, null, 'ECDSA');
    const tssKey = newTssKey(baseKey);
    tssKey.encrypt(password);

    tssKey.decrypt(password);

    tssKey.get(null).xPrivKey.should.equal(baseKey.get(password).xPrivKey);
    tssKey.keychain.privateKeyShare.should.deep.equal(fullShare);
    tssKey.checkPassword('old-password', 'EDDSA').should.be.true;

    tssKey.encrypt('new-password');

    assertNoPlaintextSecrets(tssKey.toObj());
    tssKey.checkPassword('new-password', 'ECDSA').should.be.true;
    tssKey.checkPassword('old-password', 'EDDSA').should.be.true;
  });

  it('should decrypt every secret and re-encrypt with a new password', function() {
    const tssKey = newTssKey(new Key({ seedType: 'new' }));
    tssKey.encrypt(password);
    const decryptSpy = sandbox.spy(Encryption, 'decryptWithPassword');

    tssKey.decrypt(password);
    const decrypted = tssKey.toObj() as any;
    should.exist(decrypted.xPrivKey);
    should.exist(decrypted.xPrivKeyEDDSA);
    decrypted.keychain.privateKeyShare.should.deep.equal(fullShare);
    decrypted.keychain.reducedPrivateKeyShare.should.deep.equal(reducedShare);
    decryptSpy.returnValues.should.not.include(tssKey.keychain.privateKeyShare);
    decryptSpy.returnValues.should.not.include(tssKey.keychain.reducedPrivateKeyShare);
    for (const value of decryptSpy.returnValues) {
      Buffer.isBuffer(value).should.be.true;
      value.every(b => b === 0).should.be.true;
    }

    tssKey.encrypt('new-password');
    assertNoPlaintextSecrets(tssKey.toObj());
    tssKey.checkPassword('new-password', 'ECDSA').should.be.true;
    tssKey.checkPassword('new-password', 'EDDSA').should.be.true;
  });

  it('should accept SJCL string results and retain the decrypted shares as buffers', function() {
    const original = newTssKey(new Key({ seedType: 'new' })).toObj() as any;
    const obj = {
      ...original,
      keychain: { ...original.keychain }
    };
    for (const field of ['xPrivKey', 'xPrivKeyEDDSA', 'mnemonic']) {
      obj[`${field}Encrypted`] = sjcl.encrypt(password, obj[field], { iter: 1000 });
      obj[field] = null;
    }
    for (const field of ['privateKeyShare', 'reducedPrivateKeyShare']) {
      obj.keychain[`${field}Encrypted`] = sjcl.encrypt(password, obj.keychain[field].toString(), { iter: 1000 });
      obj.keychain[field] = null;
    }
    const tssKey = new TssKey(obj);
    sandbox.stub(Encryption, '_baseDecrypt').throws(new Error('force SJCL fallback'));

    tssKey.checkPassword(password).should.be.true;
    tssKey.decrypt(password);

    const decrypted = tssKey.toObj() as any;
    decrypted.xPrivKey.should.equal(original.xPrivKey);
    decrypted.xPrivKeyEDDSA.should.equal(original.xPrivKeyEDDSA);
    decrypted.mnemonic.should.equal(original.mnemonic);
    Buffer.isBuffer(tssKey.keychain.privateKeyShare).should.be.true;
    Buffer.isBuffer(tssKey.keychain.reducedPrivateKeyShare).should.be.true;
    tssKey.keychain.privateKeyShare.should.deep.equal(fullShare);
    tssKey.keychain.reducedPrivateKeyShare.should.deep.equal(reducedShare);
  });

  for (const secret of ['xPrivKeyEDDSA', 'mnemonic', 'reducedPrivateKeyShare']) {
    it(`should leave every secret unchanged when encrypting ${secret} fails`, function() {
      const tssKey = newTssKey(new Key({ seedType: 'new' }));
      const before = tssKey.toObj() as any;
      const plaintext = before[secret] || before.keychain[secret];
      const encryptStub = sandbox.stub(Encryption, 'encryptWithPassword').callThrough();
      encryptStub.withArgs(sinon.match(value => Buffer.isBuffer(plaintext)
        ? Buffer.isBuffer(value) && value.equals(plaintext)
        : value === plaintext)).throws(new Error('encryption failed'));

      (() => tssKey.encrypt(password, { iter: 1 })).should.throw('encryption failed');

      tssKey.toObj().should.deep.equal(before);
    });
  }

  for (const secret of ['xPrivKeyEncrypted', 'mnemonicEncrypted', 'reducedPrivateKeyShareEncrypted']) {
    it(`should leave every secret unchanged and clear buffers when decrypting ${secret} fails`, function() {
      const tssKey = newTssKey(new Key({ seedType: 'new' }));
      tssKey.encrypt(password, { iter: 1 });
      const before = tssKey.toObj() as any;
      const ciphertext = before[secret] || before.keychain[secret];
      const decryptStub = sandbox.stub(Encryption, 'decryptWithPassword').callThrough();
      decryptStub.withArgs(ciphertext).throws(new Error('decryption failed'));

      (() => tssKey.decrypt(password)).should.throw();

      tssKey.toObj().should.deep.equal(before);
      for (const value of decryptStub.returnValues.filter(Buffer.isBuffer)) {
        value.every(b => b === 0).should.be.true;
      }
    });
  }

  it('should leave both roots unchanged and clear buffers when EDDSA is tried before a failing ECDSA root', function() {
    const baseKey = new Key({ seedType: 'new', password: 'old-password', encryptionOpts: { iter: 1 } });
    baseKey.decrypt('old-password', 'ECDSA');
    baseKey.encrypt(password, { iter: 1 }, 'ECDSA');
    const tssKey = newTssKey(baseKey);
    const before = tssKey.toObj();
    sandbox.stub(Constants, 'SUPPORTED_SIG_ALGOS').value([...Constants.SUPPORTED_SIG_ALGOS].reverse());
    const decryptSpy = sandbox.spy(Encryption, 'decryptWithPassword');

    (() => tssKey.decrypt('old-password')).should.throw('Could not decrypt');

    tssKey.toObj().should.deep.equal(before);
    for (const value of decryptSpy.returnValues.filter(Buffer.isBuffer)) {
      value.every(b => b === 0).should.be.true;
    }
  });
});
