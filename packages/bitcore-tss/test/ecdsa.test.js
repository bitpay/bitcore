// const { describe, it } = require('node:test');
const assert = require('assert');
const CWC = require('crypto-wallet-core');
const bitcoreLib = require('bitcore-lib');
const { KeyGen } = require('../ecdsa/keygen');
const { Sign } = require('../ecdsa/sign');
const { vectors } = require('./data/vectors.ecdsa');


describe('ECDSA', function() {
  this.timeout(5000);

  const onlys = vectors.reduce((arr, v, i) => {
    if (v.only || v.signing.some(s => s.only)) {
      arr.push(i);
    }
    return arr
  }, []);

  for (const vector of vectors) {
    if (vector.skip) { continue; }
    if (onlys.length && !onlys.includes(vectors.indexOf(vector))) { continue; }

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
              const chaincode = keychains[party].commonKeyChain.toString('hex').substring(66);
              const xPubKey = new bitcoreLib.HDPublicKey({
                network: 'livenet',
                depth: 0,
                parentFingerPrint: 0,
                childIndex: 0,
                publicKey: pubkey,
                chainCode: chaincode
              });
              assert.strictEqual(xPubKey.toString(), vector.xPubKey);
              for (const vectorAddress of vector.addresses) {
                const address = CWC.Deriver.deriveAddressWithPath(vectorAddress.chain, vectorAddress.network, xPubKey, vectorAddress.path, vectorAddress.addressType);
                assert.strictEqual(address, vectorAddress.address);
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
          if (!signingVector.only) { continue; }

          describe(signingVector.description, function() {
            describe('instantiation', function() {
              for (let i = 0; i < n; i++) {
                const party = `party${i}`;

                it('should validate bitcoin tx', function() {
                  // this test is mostly for documenting how the test data was built
                  if (signingVector.chain !== 'BTC') return;

                  const parsedTx = new bitcoreLib.Transaction(signingVector.rawTx);
                  // the change address could be any address. I usually use another address in vector.addresses[]
                  const change = parsedTx.outputs[1].script.toAddress('regtest').toString();
                  // the recipient address and amounts can also be anything. These are random values I chose.
                  const recipient = parsedTx.outputs[0].script.toAddress('regtest').toString();
                  const recipientAmt = parsedTx.outputs[0].satoshis;

                  const hdpk = new bitcoreLib.HDPublicKey(vector.xPubKey);
                  const pubkey = hdpk.deriveChild(signingVector.derivationPath).publicKey;
                  // The utxo could be any randomly generated txid, vout, and satoshis, but I'd recommend
                  //  sending some BTC to pubkey.toAddress('regtest', addressType) and then using that output
                  //  for the utxo. That way, you don't need to worry about creating a valid redeem script.
                  const utxo = new bitcoreLib.Transaction.UnspentOutput(signingVector.utxo);
                  const tx = new bitcoreLib.Transaction()
                    .from(utxo)
                    .change(change)
                    .to(recipient, recipientAmt);

                  assert.equal(tx.toString(), signingVector.rawTx);
                  const messageHash = tx.inputs[0].getSighash(tx, pubkey, 0).toString('hex');
                  assert.equal(messageHash, signingVector.messageHash);
                });

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
                  let signed;
                  if (signingVector.chain === 'ETH') {
                    signed = CWC.Transactions.applySignature({ chain: signingVector.chain, tx: signingVector.rawTx, signature: sig });
                    const parsedTx = CWC.ethers.Transaction.from(signed);
                    const address = vector.addresses.find(a => a.chain === signingVector.chain && (!signingVector.network || a.network == signingVector.network) && a.path === signingVector.derivationPath);
                    assert.strictEqual(parsedTx.from, address.address);
                  } else if (signingVector.chain === 'BTC') {
                    const tx = new CWC.BitcoreLib.Transaction(signingVector.rawTx);
                    const utxo = new CWC.BitcoreLib.Transaction.UnspentOutput(signingVector.utxo);
                    tx.associateInputs([utxo]);
                    assert.strictEqual(tx.inputs[signingVector.inputIndex].isFullySigned(), false);
                    signed = CWC.Transactions.applySignature({ chain: signingVector.chain, tx, signature: sig, index: signingVector.inputIndex });
                    assert.strictEqual(signed.inputs[signingVector.inputIndex].isFullySigned(), true);
                  }
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