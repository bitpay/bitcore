// const { describe, it } = require('node:test');
const assert = require('assert');
const CWC = require('crypto-wallet-core');
const bitcoreLib = require('bitcore-lib');
const { KeyGen } = require('../ecdsa/keygen');
const { Sign } = require('../ecdsa/sign');
const { vectors } = require('./data/vectors.ecdsa');


describe('ECDSA', function() {
  for (const vector of vectors) {
    if (vector.skip) { continue; }

    describe(`${vector.m}-of-${vector.n}`, function() {
      
      const keychains = {};
      for (let i = 0; i < vector.n; i++) {
        keychains[`party${i}`] = vector[`party${i}`].keychain;
      }

      const authKeys = {};
      for (let i = 0; i < vector.n; i++) {
        authKeys[`party${i}`] = bitcoreLib.PrivateKey(vector[`party${i}`].authKey);
      }

      describe('KeyGen', function() {
        const seeds = {};
        for (let i = 0; i < vector.n; i++) {
          seeds[`party${i}`] = vector[`party${i}`].seed;
        }

        const keygens = {};
        const messages = vector.keygen.messages;

        describe('instantiation', function() {
          for (let i = 0; i < vector.n; i++) {
            const party = `party${i}`;

            it(`should instantiate KeyGen for ${party}`, async function() {
              const keygen = new KeyGen({ n: vector.n, m: vector.m, partyId: i, seed: seeds[party], authKey: authKeys[party] });
              assert.notEqual(keygen, null);

              // set the keygen for the rest of the tests
              keygens[party] = keygen;
            });

            it(`should not export a brand new session for ${party}`, function() {
              assert.throws(keygens[party].export.bind(keygens[party]), { message: 'Invalid state: Cannot export a session that has not started' });
            });
          }
        });

        describe('init/join', function() {
          for (let i = 0; i < vector.n; i++) {
            const party = `party${i}`;
            const round = 0;

            it(`should init/join for ${party}`, async function() {
              const msg = await keygens[party].initJoin();
              assert.notEqual(msg, null);
              assert.strictEqual(msg.round, round);
              assert.strictEqual(msg.partyId, i);
              assert.strictEqual(msg.publicKey, authKeys[party].publicKey.toString());
              assert.strictEqual(msg.p2pMessages.length, 0);
              assert.strictEqual(msg.broadcastMessages.length, 1);
              assert.strictEqual(msg.broadcastMessages[0].from, i);
              assert.strictEqual(msg.broadcastMessages[0].payload.message, messages[`round${round}`][party].broadcastMessages[0].payload.message);
              assert.strictEqual(msg.broadcastMessages[0].payload.signature, messages[`round${round}`][party].broadcastMessages[0].payload.signature);
              messages[`round${round}`][party] = msg;
            });

            it(`should export & restore the session after init/join for ${party}`, async function() {
              const session = keygens[party].export();
              assert.strictEqual(typeof session, 'string');

              const keygen = await KeyGen.restore({
                seed: seeds[party],
                authKey: authKeys[party],
                session
              });
              assert.notEqual(keygen, null);
              keygens[party] = keygen;
            });
          }
        });

        describe('round 1', function() {
          const round = 1;

          for (let i = 0; i < vector.n; i++) {
            const party = `party${i}`;

            it(`should generate message for round ${round} ${party}`, async function() {
              const prevRound = round - 1;
              const prevRoundMessages = Object.values(messages[`round${prevRound}`]).filter(m => m.partyId !== i);

              const msg = keygens[party].nextRound(prevRoundMessages);
              assert.notEqual(msg, null);
              assert.strictEqual(msg.round, round);
              assert.strictEqual(msg.partyId, i);
              assert.strictEqual(msg.publicKey, authKeys[party].publicKey.toString());
              assert.strictEqual(msg.p2pMessages.length, vector.n - 1);
              assert.strictEqual(msg.broadcastMessages.length, 0);
              for (let j = 0; j < msg.p2pMessages.length; j++) {
                const p2pMessage = msg.p2pMessages[j];
                assert.strictEqual(p2pMessage.from, i);
                assert.strictEqual(p2pMessage.to, messages[`round${round}`][party].p2pMessages[j].to);
                assert.strictEqual(p2pMessage.commitment, messages[`round${round}`][party].p2pMessages[j].commitment);
                assert.notEqual(p2pMessage.payload.encryptedMessage, null);
                assert.notEqual(p2pMessage.payload.signature, null);
              }
              // set the payload for the next round
              messages[`round${round}`][party] = msg;
            });

            it(`should export & restore the session after round ${round} for ${party}`, async function() {
              const session = keygens[party].export();
              assert.strictEqual(typeof session, 'string');

              const keygen = await KeyGen.restore({
                seed: seeds[party],
                authKey: authKeys[party],
                session
              });
              assert.notEqual(keygen, null);
              keygens[party] = keygen;
            });
          }
        });

        describe('round 2', function() {
          const round = 2;

          for (let i = 0; i < vector.n; i++) {
            const party = `party${i}`;

            it(`should generate message for round ${round} ${party}`, async function() {
              const prevRound = round - 1;
              const prevRoundMessages = JSON.parse(JSON.stringify(Object.values(messages[`round${prevRound}`]).filter(m => m.partyId !== i)));

              for (const prevRoundMessage of prevRoundMessages) {
                prevRoundMessage.p2pMessages = prevRoundMessage.p2pMessages.filter(m => m.to === i);
              }

              const msg = keygens[party].nextRound(prevRoundMessages);
              assert.notEqual(msg, null);
              assert.strictEqual(msg.round, round);
              assert.strictEqual(msg.partyId, i);
              assert.strictEqual(msg.publicKey, authKeys[party].publicKey.toString());
              assert.strictEqual(msg.p2pMessages.length, vector.n - 1);
              assert.strictEqual(msg.broadcastMessages.length, 0);
              for (let j = 0; j < msg.p2pMessages.length; j++) {
                const p2pMessage = msg.p2pMessages[j];
                assert.strictEqual(p2pMessage.from, i);
                assert.strictEqual(p2pMessage.to, messages[`round${round}`][party].p2pMessages[j].to);
                assert.strictEqual(p2pMessage.commitment, messages[`round${round}`][party].p2pMessages[j].commitment);
                assert.notEqual(p2pMessage.payload.encryptedMessage, null);
                assert.notEqual(p2pMessage.payload.signature, null);
              }
              // set the payload for the next round
              messages[`round${round}`][party] = msg;
            });

            it(`should export & restore the session after round ${round} for ${party}`, async function() {
              const session = keygens[party].export();
              assert.strictEqual(typeof session, 'string');

              const keygen = await KeyGen.restore({
                seed: seeds[party],
                authKey: authKeys[party],
                session
              });
              assert.notEqual(keygen, null);
              keygens[party] = keygen;
            });
          }
        });

        describe('round 3', function() {
          const round = 3;

          for (let i = 0; i < vector.n; i++) {
            const party = `party${i}`;

            it(`should generate message for round ${round} ${party}`, async function() {
              const prevRound = round - 1;
              const prevRoundMessages = JSON.parse(JSON.stringify(Object.values(messages[`round${prevRound}`]).filter(m => m.partyId !== i)));

              for (const prevRoundMessage of prevRoundMessages) {
                prevRoundMessage.p2pMessages = prevRoundMessage.p2pMessages.filter(m => m.to === i);
              }

              const msg = keygens[party].nextRound(prevRoundMessages);
              assert.notEqual(msg, null);
              assert.strictEqual(msg.round, round);
              assert.strictEqual(msg.partyId, i);
              assert.strictEqual(msg.publicKey, authKeys[party].publicKey.toString());
              assert.strictEqual(msg.p2pMessages.length, 0);
              assert.strictEqual(msg.broadcastMessages.length, 1);
              assert.strictEqual(msg.broadcastMessages[0].from, i);
              assert.notEqual(msg.broadcastMessages[0].payload.message, null);
              assert.notEqual(msg.broadcastMessages[0].payload.signature, null);
              // set the payload for the next round
              messages[`round${round}`][party] = msg;
            });

            it(`should export & restore the session after round ${round} for ${party}`, async function() {
              const session = keygens[party].export();
              assert.strictEqual(typeof session, 'string');

              const keygen = await KeyGen.restore({
                seed: seeds[party],
                authKey: authKeys[party],
                session
              });
              assert.notEqual(keygen, null);
              keygens[party] = keygen;
            });
          }
        });

        describe('round 4', function() {
          const round = 4;
          for (let i = 0; i < vector.n; i++) {
            const party = `party${i}`;

            it(`should generate message for round ${round} ${party}`, async function() {
              const prevRound = round - 1;
              const prevRoundMessages = JSON.parse(JSON.stringify(Object.values(messages[`round${prevRound}`]).filter(m => m.partyId !== i)));

              for (const prevRoundMessage of prevRoundMessages) {
                prevRoundMessage.p2pMessages = prevRoundMessage.p2pMessages.filter(m => m.to === i);
              }

              const msg = keygens[party].nextRound(prevRoundMessages);
              assert.notEqual(msg, null);
              assert.strictEqual(msg.round, round);
              assert.strictEqual(msg.partyId, i);
              assert.strictEqual(msg.publicKey, authKeys[party].publicKey.toString());
              assert.strictEqual(msg.p2pMessages.length, 0);
              assert.strictEqual(msg.broadcastMessages.length, 0);
            });

            it(`should not export a completed session after round ${round} for ${party}`, async function() {
              assert.throws(keygens[party].export.bind(keygens[party]), { message: 'Invalid state: Cannot export a completed session. The keychain is ready with getKeyChain()' });
            });
          }
        });

        describe('getKeyChain', function() {
          for (let i = 0; i < vector.n; i++) {
            const party = `party${i}`;

            it(`should create key for ${party}`, async function() {
              const keyChain = keygens[party].getKeyChain();
              assert.notEqual(keyChain, null);
              assert.strictEqual(keyChain.commonKeyChain, keychains[party].commonKeyChain.toString('hex'));
              // set the keys for the signing
              keychains[party].privateKeyShare = keyChain.privateKeyShare;
              keychains[party].reducedPrivateKeyShare = keyChain.reducedPrivateKeyShare;

              const pubkey = keychains[party].commonKeyChain.toString('hex').substring(0, 66);
              const chaincode = keychains.party0.commonKeyChain.toString('hex').substring(66);
              if (vector.evmAddress) {
                const evmAddress = CWC.Deriver.getAddress('ETH', 'mainnet', pubkey);
                assert.strictEqual(evmAddress, vector.evmAddress.address);
              }
            });
          }
        });
      });


      describe('Sign', function() {
        const m = vector.m;
        const n = vector.n;
        const signers = {};
        for (let i = 0; i < n; i++) {
          signers[`party${i}`] = {}
          for (let j = 1; j < n; j++) {
            signers[`party${i}`][`party${(i + j) % n}`] = null;
          }
        }

        const messages = {};
        for (let i = 0; i <= 4; i++) {
          messages[`round${i}`] = {};
          for (let j = 0; j < n; j++) {
            messages[`round${i}`][`party${j}`] = {};
          }
        }

        for (const signingVector of vector.signing) {
          if (signingVector.skip) { continue; }

          describe(signingVector.description, function() {
            describe('instantiation', function() {
              for (let i = 0; i < n; i++) {
                const party = `party${i}`;

                it(`should instantiate Sign for ${party}`, async function() {
                  signers[party] = new Sign({
                    keychain: keychains[party],
                    partyId: i,
                    m,
                    n,
                    derivationPath: signingVector.derivationPath,
                    messageHash: Buffer.from(signingVector.messageHash, 'hex'),
                    authKey: authKeys[party]
                  });
                });

                it(`should not export a brand new session for ${party}`, function() {
                  assert.throws(signers[party].export.bind(signers[party]), { message: 'Invalid state: Cannot export a session that has not started' });
                });
              }
            });


            describe('init/join', function() {
              for (let i = 0; i < m; i++) {
                const party = `party${i}`;

                it(`should sign - init/join by ${party}`, async function() {
                  const msg = await signers[party].initJoin();
                  assert.notEqual(msg, null);
                  assert.strictEqual(msg.round, 0);
                  assert.strictEqual(msg.partyId, i);
                  assert.strictEqual(msg.publicKey, authKeys[party].publicKey.toString());
                  assert.strictEqual(msg.p2pMessages.length, 0);
                  assert.strictEqual(msg.broadcastMessages.length, 1);
                  assert.strictEqual(msg.broadcastMessages[0].from, i);
                  assert.notEqual(msg.broadcastMessages[0].payload.message, null);
                  assert.notEqual(msg.broadcastMessages[0].payload.signature, null);
                  // set the payload for the next round
                  messages.round0[party] = msg;
                });

                it(`should export & restore the session after init/join for ${party}`, async function() {
                  const session = signers[party].export();
                  assert.strictEqual(typeof session, 'string');

                  const signer = await Sign.restore({
                    session,
                    keychain: keychains[party],
                    authKey: authKeys[party]
                  });
                  assert.notEqual(signer, null);
                  signers[party] = signer;
                });
              }
            });

            describe('round 1', function() {
              const round = 1;

              for (let i = 0; i < m; i++) {
                const party = `party${i}`;

                it(`should sign - round ${round} by ${party}`, async function() {
                  const otherSigners = Array.from({ length: m - 1 }, (_, idx) => idx < i ? idx : (i + Math.abs(i - idx - 1)));
                  const prevRound = round - 1;
                  const prevRoundMsgs = otherSigners.map(signer => 
                    JSON.parse(JSON.stringify(messages[`round${prevRound}`][`party${signer}`]))
                  );
                  for (const prevRoundMsg of prevRoundMsgs) {
                    prevRoundMsg.p2pMessages = prevRoundMsg.p2pMessages.filter(m => m.to === i);
                  }

                  const msg = signers[party].nextRound(prevRoundMsgs);
                  assert.notEqual(msg, null);
                  assert.strictEqual(msg.round, round);
                  assert.strictEqual(msg.partyId, i);
                  assert.strictEqual(msg.publicKey, authKeys[party].publicKey.toString());
                  assert.strictEqual(msg.p2pMessages.length, m - 1);
                  assert.strictEqual(msg.broadcastMessages.length, 0);
                  for (const otherSigner of otherSigners) {
                    const p2pMsg = msg.p2pMessages.find(m => m.to === otherSigner);
                    assert.notEqual(p2pMsg, null);
                    assert.strictEqual(p2pMsg.from, i);
                    assert.notEqual(p2pMsg.payload.encryptedMessage, null);
                    assert.notEqual(p2pMsg.payload.signature, null);
                  }
                  // set the payload for the next round
                  messages[`round${round}`][party] = msg;
                });

                it(`should export & restore the session after round ${round} for ${party}`, async function() {
                  const session = signers[party].export();
                  assert.strictEqual(typeof session, 'string');

                  const signer = await Sign.restore({
                    session,
                    keychain: keychains[party],
                    authKey: authKeys[party]
                  });
                  assert.notEqual(signer, null);
                  signers[party] = signer;
                });
              }
            });

            describe('round 2', function() {
              const round = 2;

              for (let i = 0; i < m; i++) {
                const party = `party${i}`;

                it(`should sign - round ${round} by ${party}`, async function() {
                  const otherSigners = Array.from({ length: m - 1 }, (_, idx) => idx < i ? idx : (i + Math.abs(i - idx - 1)));
                  const prevRound = round - 1;
                  const prevRoundMsgs = otherSigners.map(signer => 
                    JSON.parse(JSON.stringify(messages[`round${prevRound}`][`party${signer}`]))
                  );
                  for (const prevRoundMsg of prevRoundMsgs) {
                    prevRoundMsg.p2pMessages = prevRoundMsg.p2pMessages.filter(m => m.to === i);
                  }

                  const msg = signers[party].nextRound(prevRoundMsgs);
                  assert.notEqual(msg, null);
                  assert.strictEqual(msg.round, round);
                  assert.strictEqual(msg.partyId, i);
                  assert.strictEqual(msg.publicKey, authKeys[party].publicKey.toString());
                  assert.strictEqual(msg.p2pMessages.length, m - 1);
                  assert.strictEqual(msg.broadcastMessages.length, 0);
                  for (const otherSigner of otherSigners) {
                    const p2pMsg = msg.p2pMessages.find(m => m.to === otherSigner);
                    assert.notEqual(p2pMsg, null);
                    assert.strictEqual(p2pMsg.from, i);
                    assert.notEqual(p2pMsg.payload.encryptedMessage, null);
                    assert.notEqual(p2pMsg.payload.signature, null);
                  }
                  // set the payload for the next round
                  messages[`round${round}`][party] = msg;
                });

                it(`should export & restore the session after round ${round} for ${party}`, async function() {
                  const session = signers[party].export();
                  assert.strictEqual(typeof session, 'string');

                  const signer = await Sign.restore({
                    session,
                    keychain: keychains[party],
                    authKey: authKeys[party]
                  });
                  assert.notEqual(signer, null);
                  signers[party] = signer;
                });
              }
            });

            describe('round 3', function() {
              const round = 3;

              for (let i = 0; i < m; i++) {
                const party = `party${i}`;

                it(`should sign - round ${round} by ${party}`, async function() {
                  const otherSigners = Array.from({ length: m - 1 }, (_, idx) => idx < i ? idx : (i + Math.abs(i - idx - 1)));
                  const prevRound = round - 1;
                  const prevRoundMsgs = otherSigners.map(signer => 
                    JSON.parse(JSON.stringify(messages[`round${prevRound}`][`party${signer}`]))
                  );
                  for (const prevRoundMsg of prevRoundMsgs) {
                    prevRoundMsg.p2pMessages = prevRoundMsg.p2pMessages.filter(m => m.to === i);
                  }

                  const msg = signers[party].nextRound(prevRoundMsgs);
                  assert.notEqual(msg, null);
                  assert.strictEqual(msg.round, round);
                  assert.strictEqual(msg.partyId, i);
                  assert.strictEqual(msg.publicKey, authKeys[party].publicKey.toString());
                  assert.strictEqual(msg.p2pMessages.length, 0);
                  assert.strictEqual(msg.broadcastMessages.length, 1);
                  // set the payload for the next round
                  messages[`round${round}`][party] = msg;
                });

                it(`should export & restore the session after round ${round} for ${party}`, async function() {
                  const session = signers[party].export();
                  assert.strictEqual(typeof session, 'string');

                  const signer = await Sign.restore({
                    session,
                    keychain: keychains[party],
                    authKey: authKeys[party]
                  });
                  assert.notEqual(signer, null);
                  signers[party] = signer;
                });
              }
            });

            describe('round 4', function() {
              const round = 4;

              for (let i = 0; i < m; i++) {
                const party = `party${i}`;

                it(`should sign - round ${round} by ${party}`, async function() {
                  const otherSigners = Array.from({ length: m - 1 }, (_, idx) => idx < i ? idx : (i + Math.abs(i - idx - 1)));
                  const prevRound = round - 1;
                  const prevRoundMsgs = otherSigners.map(signer => 
                    JSON.parse(JSON.stringify(messages[`round${prevRound}`][`party${signer}`]))
                  );
                  for (const prevRoundMsg of prevRoundMsgs) {
                    prevRoundMsg.p2pMessages = prevRoundMsg.p2pMessages.filter(m => m.to === i);
                  }

                  const msg = signers[party].nextRound(prevRoundMsgs);
                  assert.notEqual(msg, null);
                  assert.strictEqual(msg.round, round);
                  assert.strictEqual(msg.partyId, i);
                  assert.strictEqual(msg.publicKey, authKeys[party].publicKey.toString());
                  assert.strictEqual(msg.p2pMessages.length, 0);
                  assert.strictEqual(msg.broadcastMessages.length, 0);
                });

                it(`should not export a completed session after round ${round} for ${party}`, async function() {
                  assert.throws(signers[party].export.bind(signers[party]), { message: 'Invalid state: Cannot export a completed session. The signature is ready with getSignature()' });
                });
              }
            });

            describe('getSignature', function() {
              for (let i = 0; i < m; i++) {
                const party = `party${i}`;

                it(`should get signature - ${party}`, async function() {
                  const sig = signers[party].getSignature();
                  assert.notEqual(sig, null);
                  assert.notEqual(sig.r, null);
                  assert.notEqual(sig.s, null);
                  assert.notEqual(sig.v, null);
                  assert.notEqual(sig.pubKey, null);
                  const signed = CWC.Transactions.applySignature({ chain: signingVector.chain, tx: signingVector.rawTx, signature: sig });
                  assert.notEqual(signed, null);
                });
              }
            });
          });
        }
      });
    });
  }
});