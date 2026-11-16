import { strict as assert } from 'assert';
import { Deriver } from '@bitpay-labs/crypto-wallet-core';
import { Key } from '../src/lib/key';
import { TssKey } from '../src/lib/tsskey';

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
  assert.ok(exported.xPrivKey == null);
  assert.ok(exported.xPrivKeyEDDSA == null);
  assert.ok(exported.mnemonic == null);
  assert.ok(exported.keychain.privateKeyShare == null);
  assert.ok(exported.keychain.reducedPrivateKeyShare == null);
}

describe('TssKey encryption', function() {
  this.timeout(20000);

  const password = 'test-only-password';

  it('should not export a plaintext EDDSA root after password encryption', function() {
    // Generate a fresh base Key containing both algorithms.
    const baseKey = new Key({ seedType: 'new' });
    const original = baseKey.toObj();
    assert.equal(typeof original.xPrivKeyEDDSA, 'string');

    const tssKey = newTssKey(baseKey);
    tssKey.encrypt(password); // Use default password-encryption parameters.
    const backup = JSON.parse(JSON.stringify(tssKey.toObj()));

    assertNoPlaintextSecrets(backup);
    assert.ok(backup.xPrivKeyEncrypted);
    assert.ok(backup.xPrivKeyEDDSAEncrypted);
    assert.ok(backup.mnemonicEncrypted);
    assert.ok(backup.keychain.privateKeyShareEncrypted);
    assert.ok(backup.keychain.reducedPrivateKeyShareEncrypted);

    const restored = tssKey.get(password);
    assert.ok(restored.xPrivKey === original.xPrivKey, 'ECDSA root round-trip failed');
    assert.ok(restored.mnemonic === original.mnemonic, 'Mnemonic round-trip failed');
    assert.deepEqual(restored.keychain.privateKeyShare, fullShare);
    assert.deepEqual(restored.keychain.reducedPrivateKeyShare, reducedShare);

    // The EDDSA root decrypts with the password and still derives the original SOL child key.
    const solPath = "m/44'/501'/0'/0'";
    const expected = Deriver.derivePrivateKeyWithPath('SOL', 'livenet', original.xPrivKeyEDDSA, solPath, null);
    const restoredEddsa = new TssKey(backup).get(password, 'EDDSA').xPrivKey;
    const fromBackup = Deriver.derivePrivateKeyWithPath('SOL', 'livenet', restoredEddsa, solPath, null);
    assert.equal(fromBackup.privKey, expected.privKey);
    assert.equal(fromBackup.pubKey, expected.pubKey);
  });

  it('should encrypt the keychain of a key whose roots were encrypted at construction', function() {
    const tssKey = newTssKey(new Key({ seedType: 'new', password }));

    tssKey.encrypt(password);

    assertNoPlaintextSecrets(tssKey.toObj());
    assert.ok(tssKey.isKeyChainEncrypted());
    assert.throws(() => tssKey.encrypt(password), /Keychain is already encrypted/);
  });

  it('should reject a different password than the one encrypting the roots', function() {
    const tssKey = newTssKey(new Key({ seedType: 'new', password }));

    assert.throws(() => tssKey.encrypt('other'), /different password/);

    assert.ok(!tssKey.isKeyChainEncrypted());
    assert.deepEqual(tssKey.keychain.privateKeyShare, fullShare);
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
    assert.ok(tssKey.hasPlaintextPrivKey());

    tssKey.encrypt(password);

    assert.ok(!tssKey.hasPlaintextPrivKey());
    assert.ok((tssKey.toObj() as any).xPrivKeyEDDSA == null);
    assert.equal(tssKey.checkPassword(password, 'EDDSA'), true);
    assert.equal(tssKey.keychain.privateKeyShareEncrypted, 'x', 'keychain should not be re-encrypted');
  });

  it('should decrypt every secret and re-encrypt with a new password', function() {
    const tssKey = newTssKey(new Key({ seedType: 'new' }));
    tssKey.encrypt(password);

    tssKey.decrypt(password);
    const decrypted = tssKey.toObj() as any;
    assert.ok(decrypted.xPrivKey);
    assert.ok(decrypted.xPrivKeyEDDSA);
    assert.deepEqual(decrypted.keychain.privateKeyShare, fullShare);

    tssKey.encrypt('new-password');
    assertNoPlaintextSecrets(tssKey.toObj());
    assert.equal(tssKey.checkPassword('new-password', 'ECDSA'), true);
    assert.equal(tssKey.checkPassword('new-password', 'EDDSA'), true);
  });
});
