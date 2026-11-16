import * as chai from 'chai';
import { Deriver } from '@bitpay-labs/crypto-wallet-core';
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

  it('should decrypt every secret and re-encrypt with a new password', function() {
    const tssKey = newTssKey(new Key({ seedType: 'new' }));
    tssKey.encrypt(password);

    tssKey.decrypt(password);
    const decrypted = tssKey.toObj() as any;
    should.exist(decrypted.xPrivKey);
    should.exist(decrypted.xPrivKeyEDDSA);
    decrypted.keychain.privateKeyShare.should.deep.equal(fullShare);

    tssKey.encrypt('new-password');
    assertNoPlaintextSecrets(tssKey.toObj());
    tssKey.checkPassword('new-password', 'ECDSA').should.be.true;
    tssKey.checkPassword('new-password', 'EDDSA').should.be.true;
  });
});
