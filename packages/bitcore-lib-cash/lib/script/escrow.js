const _ = require('lodash');

const Hash = require('../crypto/hash');
const Opcode = require('../opcode');
const PublicKey = require('../publickey');

// This file implements the Zero-Confirmation Escrow scripts defined here: 
// https://ide.bitauth.com/import-gist/104baff7503d6a7ad619ad814153b059

const Escrow = {};

const pushOpcodeFromNumber = function(n) {
  return {
    0: Opcode.OP_0,
    1: Opcode.OP_1,
    2: Opcode.OP_2,
    3: Opcode.OP_3,
    4: Opcode.OP_4,
    5: Opcode.OP_5,
    6: Opcode.OP_6,
    7: Opcode.OP_7,
    8: Opcode.OP_8,
    9: Opcode.OP_9,
    10: Opcode.OP_10,
    11: Opcode.OP_11,
    12: Opcode.OP_12,
    13: Opcode.OP_13,
    14: Opcode.OP_14,
    15: Opcode.OP_15,
    16: Opcode.OP_16
  }[n];
};

const getNumMerkleLevels = function(numPublicKeys) {
  return Math.ceil(Math.log2(numPublicKeys));
};

Escrow.getMerkleRoot = function getMerkleRoot(hashes) {
  if (hashes.length === 1) {
    return hashes[0];
  }
  const parentHashes = _.chunk(hashes, 2).map(hashPair => Hash.sha256ripemd160(Buffer.concat(hashPair)));
  return getMerkleRoot(parentHashes);
};

Escrow.generateMerkleRootFromPublicKeys = function(publicKeys) {
  const numLevels = getNumMerkleLevels(publicKeys.length);
  const numItems = Math.pow(2, numLevels);
  const sortedPublicKeys = publicKeys
    .map(publicKey => publicKey.toString('hex'))
    .sort()
    .map(publicKeyString => PublicKey.fromString(publicKeyString).toBuffer());
  const zeros = Array(numItems - publicKeys.length).fill(Buffer.alloc(0));
  const leaves = sortedPublicKeys.concat(zeros).map(value => Hash.sha256ripemd160(value));
  return Escrow.getMerkleRoot(leaves);
};

const generateSingleInputPublicKeyValidationOperations = function(inputPublicKey) {
  const inputPublicKeyHash = Hash.sha256ripemd160(inputPublicKey.toBuffer());
  return [Opcode.OP_DUP, Opcode.OP_HASH160, inputPublicKeyHash, Opcode.OP_EQUALVERIFY];
};

const generateMerkleBasedInputPublicKeyValidationOperations = function(inputPublicKeys) {
  const numLevels = getNumMerkleLevels(inputPublicKeys.length);
  const rootHash = Escrow.generateMerkleRootFromPublicKeys(inputPublicKeys);
  const merkleTreeConstructionOperationsForEachLevel = Array(numLevels)
    .fill([
      Opcode.OP_FROMALTSTACK,
      Opcode.OP_IF,
      Opcode.OP_SWAP,
      Opcode.OP_ENDIF,
      Opcode.OP_CAT,
      Opcode.OP_HASH160
    ])
    .reduce((arr, item) => arr.concat(item), []);
  return [
    ...Array(numLevels).fill(Opcode.OP_TOALTSTACK),
    pushOpcodeFromNumber(numLevels),
    Opcode.OP_PICK,
    Opcode.OP_HASH160,
    ...merkleTreeConstructionOperationsForEachLevel,
    rootHash,
    Opcode.OP_EQUALVERIFY
  ];
};

Escrow.generateInputPublicKeyValidationOperations = function(inputPublicKeys) {
  if (inputPublicKeys.length === 1) {
    return generateSingleInputPublicKeyValidationOperations(inputPublicKeys[0]);
  }
  return generateMerkleBasedInputPublicKeyValidationOperations(inputPublicKeys);
};

Escrow.generateRedeemScriptOperations = function(inputPublicKeys, reclaimPublicKey) {
  const checkCustomerReclaimPublicKey = [
    Opcode.OP_DUP,
    Opcode.OP_HASH160,
    Hash.sha256ripemd160(reclaimPublicKey.toBuffer()),
    Opcode.OP_EQUAL,
    Opcode.OP_IF,
    Opcode.OP_CHECKSIG,
    Opcode.OP_ELSE
  ];
  const checkInputPublicKey = Escrow.generateInputPublicKeyValidationOperations(inputPublicKeys);
  const ensureTransactionsAreUnique = [
    Opcode.OP_OVER,
    Opcode.OP_4,
    Opcode.OP_PICK,
    Opcode.OP_EQUAL,
    Opcode.OP_NOT,
    Opcode.OP_VERIFY
  ];
  const ensureBothSignaturesAreValid = [
    Opcode.OP_DUP,
    Opcode.OP_TOALTSTACK,
    Opcode.OP_CHECKDATASIGVERIFY,
    Opcode.OP_FROMALTSTACK,
    Opcode.OP_CHECKDATASIG,
    Opcode.OP_ENDIF
  ];
  const allOperations = [
    ...checkCustomerReclaimPublicKey,
    ...checkInputPublicKey,
    ...ensureTransactionsAreUnique,
    ...ensureBothSignaturesAreValid
  ];
  return allOperations;
};

module.exports = Escrow;
