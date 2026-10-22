import sinon from 'sinon';
import 'chai/register-should';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import request from 'supertest';
import * as twoOfThree from './data/tss/2of3';
import BWS from '../../src/index';
import helpers from './helpers';
import { TssKeyGen } from '../../src/lib/tss';
import { TssSigGenModel } from '../../src/lib/model/tsssign';
import { TssKeyGenModel } from '../../src/lib/model/tsskeygen';
import { Common } from '../../src/lib/common/index';

const { Utils } = Common;

function xPubToCopayerId(chain: string, xpub: string): string {
  chain = chain.toLowerCase();
  const str = chain == 'btc' ? xpub : (chain + xpub);
  const hash = BitcoreLib.crypto.Hash.sha256(Buffer.from(str));
  return hash.toString('hex');
}

/** Each party has its own copayer ID (derived from its own seed, not the shared TSS key) */
function getXPubKey(seed: Buffer, network = 'testnet'): string {
  return BitcoreLib.HDPrivateKey.fromSeed(seed, network).hdPublicKey.toString();
}


describe('TSS', function() {
  this.timeout(Math.max(this['_timeout'], 2000));

  const vector = {
    m: 2,
    n: 3,
    evmAddress: {
      address: '0xD57cF5ac4CC763D83E0892a07a02fE1BBD123b27'
    },
    party0: {
      seed: Buffer.from('0d18dd84ff2e7e462bdca9fb362dce0590badac80438234a6be4b859d674355d', 'hex'),
      keychain: twoOfThree.party0Key,
      authKey: new BitcoreLib.PrivateKey('ae6101a4bfcae77c59c4c252d2004996e1f614e17feee932eff82d132d3c4cd1'),
    },
    party1: {
      seed: Buffer.from('1cb43de73873a349190d7d0ab5256aa4dba5e8ab1291885086d9db633134ac23', 'hex'),
      keychain: twoOfThree.party1Key,
      authKey: new BitcoreLib.PrivateKey('b45b008ffc057705f9119411c9fd2bad380b03d3295131834a798545fc5ed9da')
    },
    party2: {
      seed: Buffer.from('202b9dcd66c61bdcb523b65332e5bc4f17805ba991374dfb2a3e9347ec6bd170', 'hex'),
      keychain: twoOfThree.party2Key,
      authKey: new BitcoreLib.PrivateKey('c0ad56c56bfae6cad2bdba3d96be498515213eb62fdc4a0ee988514eb639841d')
    },
    keygen: {
      messages: {
        round0: {
          party0: {
            round: 0,
            partyId: 0,
            p2pMessages: [],
            broadcastMessages: [{
              from: 0,
              payload: {
                message: 'pGdmcm9tX2lkAGpzZXNzaW9uX2lkmCAYqwkFGO0YMhi6GJMY8RjZGKIYuBiMGHUYKBjjGFYYMhhkGK0GGOYYOBiDGMgYahj8GLoYbBiLGGwYRhgwamNvbW1pdG1lbnSYIBg6GCEYvhiuGNgGGGgYoBgxGHYY+xgcGDcHGH4YuhisGK0YZhi2GDQYqgUYwhgsGC0Yvhh6GJwYOhj+GD1jeF9pmCAY1hiNGMAYJhjPGCoYhBMYbBj7GPIYihgnGLsYsBhXGK4YsRhWAhg4GF8Y9hiaGNAY9xhoGGMYTBjXGJ4YSQ==',
                signature: '304402205ab3bd821993cae4be10abc13f459eec466ebf940c4164478f2c9c3686eaab460220693ece4ce558459241256d2f9109e8f3a6fcb9fbe34899ad919c44a1e0d3fb10'
              },
              signatureR: undefined
            }]
          },
          party1: {
            round: 0,
            partyId: 1,
            p2pMessages: [],
            broadcastMessages: [{
              from: 1,
              payload: {
                message: 'pGdmcm9tX2lkAWpzZXNzaW9uX2lkmCAYcA0YhBh1GKwY3hguExiSGKsY8xhZGIMYyRiDGPMYthiuGOMYcxj2GCAYlBjbGGAYHBhbGF8YjBjIGO0YKWpjb21taXRtZW50mCAYqBibGNAYHRisGO0Y0RglGLYYrBgsGLAYsBi+GE4YKRhmGCgYZRjNGPEY8RjUGPkYMRjPGN0YfhjeGFkYeQNjeF9pmCAPGGUYVgYYvBj6GKYYwhjfGHEYYxiAGLAY8xg8GCAYzBg2GIsYbQ4YIRgzGGMLGJMYdRi0Exj5GFMYxg==',
                signature: '3045022100c0c98bc13362a36ee0f7750f378a93717e1e8c820c1bb7b915ce39b3604861e402200781fc0140f84c4aa82d2ef0b8c475f85efa4228e8d0e4eb2c0fa5f012907df6'
              },
              signatureR: undefined
            }]
          },
          party2: {
            round: 0,
            partyId: 2,
            p2pMessages: [],
            broadcastMessages: [{
              from: 2,
              payload: {
                message: 'pGdmcm9tX2lkAmpzZXNzaW9uX2lkmCACGI8YJBiRGLIYWRjJGKsY5RhqFBi0GEAYYwEYbRjNGB8YOxiDGMAYRxitGEMYJhg6GN8YNRiVGI8YkBggamNvbW1pdG1lbnSYIBgxGJEYWRgjGPQY/hj3GLYYURg9GNgYjgcYSxjEGLEYWA0YhxgoGCgCGEkY7hjGGJUY/xgxGPkYKxiCGJ5jeF9pmCAYJRj1GLEYrhhmGCoY1hggGIMYORgbGBkY5xIYtBhcGLAYdRjfGIMYPhjCGB0Y5BglGIYRGNEYhBEYjhgs',
                signature: '304402200e21a04f466fbb3b79395a636adfbb0b457fa277bb6a6b03a8e0692d072a3e24022021f0b6da62772c5ac413abf017c7bbea4219ae6ef930215a7d73e7df13ed34c0'
              },
              signatureR: undefined
            }]
          },
        },
        round1: {
          party0: {
            round: 1,
            partyId: 0,
            p2pMessages: [{
              from: 0,
              to: 1,
              commitment: '8e5f056658224eb4e6de54bb495b003904dfc1b780f9c02cbf6613bd55df2bb8',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 0,
              to: 2,
              commitment: '8e5f056658224eb4e6de54bb495b003904dfc1b780f9c02cbf6613bd55df2bb8',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party1: {
            round: 1,
            partyId: 1,
            p2pMessages: [{
              from: 1,
              to: 0,
              commitment: 'b2520ea8672273bf0fb9b98f943ed9ac8a2b0402463dc6635b7ac9f5b3668099',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 1,
              to: 2,
              commitment: 'b2520ea8672273bf0fb9b98f943ed9ac8a2b0402463dc6635b7ac9f5b3668099',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party2: {
            round: 1,
            partyId: 2,
            p2pMessages: [{
              from: 2,
              to: 0,
              commitment: 'acb1ce48472da67719028bc962742f9fd5cf3c8ee77c217852e874ca7584d07e',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 2,
              to: 1,
              commitment: 'acb1ce48472da67719028bc962742f9fd5cf3c8ee77c217852e874ca7584d07e',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          }
        },
        round2: {
          party0: {
            round: 2,
            partyId: 0,
            p2pMessages: [{
              from: 0,
              to: 1,
              commitment: '8e5f056658224eb4e6de54bb495b003904dfc1b780f9c02cbf6613bd55df2bb8',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 0,
              to: 2,
              commitment: '8e5f056658224eb4e6de54bb495b003904dfc1b780f9c02cbf6613bd55df2bb8',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party1: {
            round: 2,
            partyId: 1,
            p2pMessages: [{
              from: 1,
              to: 0,
              commitment: 'b2520ea8672273bf0fb9b98f943ed9ac8a2b0402463dc6635b7ac9f5b3668099',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 1,
              to: 2,
              commitment: 'b2520ea8672273bf0fb9b98f943ed9ac8a2b0402463dc6635b7ac9f5b3668099',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          },
          party2: {
            round: 2,
            partyId: 2,
            p2pMessages: [{
              from: 2,
              to: 0,
              commitment: 'acb1ce48472da67719028bc962742f9fd5cf3c8ee77c217852e874ca7584d07e',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }, {
              from: 2,
              to: 1,
              commitment: 'acb1ce48472da67719028bc962742f9fd5cf3c8ee77c217852e874ca7584d07e',
              payload: { encryptedMessage: 'variable - test for existence', signature: 'variable - test for existence' }
            }],
            broadcastMessages: []
          }
        },
        round3: {
          party0: {
            round: 3,
            partyId: 0,
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 0,
                payload: {
                  message: 'pGdmcm9tX2lkAGpwdWJsaWNfa2V5mCEDGLIYNRjfGDMYzhiCGOAY4wAY6hgnGBgYtBg9GEQYmhigGN4YXRiaGHoYrxikGI4YRBjRGJQYwhiZFhjyGENnYmlnX3NfaZghAxi9GJ8YmhiqGGcYIBj2GKUYhxjpGDQYohhYGIAYWwwYpBjHGFkYxBiaGMoY6BjUGPwY2hgmGP0YgBgiExibZXByb29momF0mCEDGMkYQRgkGEcYMRhxGP0Y4xigGJAYSRgpGJAYnBhGGKUYkBifGJkY8Rh+GCsYsxirGIcMGPAYiBjjGLEY9xhMYXOYIBhKGOMYnhi7ERjrGKYYTBIYPRiQGHIYURhLGOkYixicGJMJGLEY7xisGF8YeBicGE0IFwoIGC8YVA==',
                  signature: '3045022100e7d1209ab8463ba6af71d0df953eaecd7cf1cbb06f7a5f4f0bacde9cd555cf310220220251083ea1d6453ff376a5520f87b9f6fe2c1fa099d034453aa41b81e54f9c',
                },
                signatureR: undefined,
              },
            ],
          },
          party1: {
            round: 3,
            partyId: 1,
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 1,
                payload: {
                  message: 'pGdmcm9tX2lkAWpwdWJsaWNfa2V5mCEDGLIYNRjfGDMYzhiCGOAY4wAY6hgnGBgYtBg9GEQYmhigGN4YXRiaGHoYrxikGI4YRBjRGJQYwhiZFhjyGENnYmlnX3NfaZghAxizGJsYlBjXGJkYzRiXGFQYuBg7GOwYVRiuGPkYOhhOGHUYaxgnGK8Y4xi2GCgY/xhWGEYHGOIYIBidGOkAZXByb29momF0mCEDGCgYVhioGKYYUQ0YnRj9GDIYQBiHGMAYvBjOFBhSGJwYohgrGBkYgRibGKsY0RjYGJYYGRjYGJ0YXBgbGCBhc5ggGLkY9hg7GEYYORjIARhwGNQYzhg/GEUYpxiGGOEY+hijGJgYthgjGOEYpRh0CxjRGCASGI8YghjDDxiF',
                  signature: '3045022100cde18dafab8cf3ced5a6df4374de498a41b273eeb929c9a5f2d316352cec7d2202200ab38847d3114321edd49a5ec2bb52ab6b27344d4719ef54ae48f98482061f0d',
                },
                signatureR: undefined,
              },
            ],
          },
          party2: {
            round: 3,
            partyId: 2,
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 2,
                payload: {
                  message: 'pGdmcm9tX2lkAmpwdWJsaWNfa2V5mCEDGLIYNRjfGDMYzhiCGOAY4wAY6hgnGBgYtBg9GEQYmhigGN4YXRiaGHoYrxikGI4YRBjRGJQYwhiZFhjyGENnYmlnX3NfaZghAxjvGIMYqhiPGI8YcRinGPYYXRjMGF0YegcYZxjJGMgKGHoYoRhnGNYYwBiHGOoYlBjvGN8YyBgsGEcYKhgqZXByb29momF0mCEDGPUYzxjiGLkYjxj+GEAYZgkYQxi+GLgYGxgyGEIKGLgYywwKGDEYxRhVGN0YUhigGL8Y+wYYSRguGPxhc5ggGCwYxRieGG0Y3xjwGIkQGDQY1hhJGJ0Y1xgsGNcY8hixGMQY+hiQGJ8Y9xgYGM8YtBhPGG0RGPgYcBgyGJs=',
                  signature: '304402203e9ca032e88a0c9e508a2b24fd421a9c84eb227cd9c82acf4f04f623e9318eba02201bb3b907b3a6b6023bed4198217dd9c42a1d9798aae475773a4d48e3870da625',
                },
                signatureR: undefined,
              },
            ],
          }
        }
      }
    },
    signing: [{
      description: 'Sign Ethereum transaction',
      derivationPath: 'm',
      chain: 'ETH',
      rawTx: '0xeb8083030d4782520894145938752bad526cb27f03ffb02775c43973ab8387038d7ea4c68000808205398080',
      messageHash: '516ab037171ee1a7787cbe07c28948dd0252ea60b7f40ee6ffbb7e1271f691ea'
    }]
  };

  let app;
  let storage;
  const urlPrefix = '/bws/api';
  const sandbox = sinon.createSandbox();
  const SESSION_ID = 'test';
  const copayer1 = xPubToCopayerId('btc', getXPubKey(vector.party0.seed));
  const copayer2 = xPubToCopayerId('btc', getXPubKey(vector.party1.seed));
  const copayer3 = xPubToCopayerId('btc', getXPubKey(vector.party2.seed));

  const parties = [vector.party0, vector.party1, vector.party2];
  const copayerIds = [copayer1, copayer2, copayer3];
  const { round0, round1 } = vector.keygen.messages;
  const round0Messages = [round0.party0, round0.party1, round0.party2];
  const round1Messages = [round1.party0, round1.party1, round1.party2];

  type Auth = { copayerId: string; privKey: BitcoreLib.PrivateKey };

  const authPubKey = (partyId: number): string => parties[partyId].authKey.publicKey.toString();
  const partyAuth = (partyId: number): Auth => ({ copayerId: copayerIds[partyId], privKey: parties[partyId].authKey });
  const randomKey = () => new BitcoreLib.PrivateKey();

  const keyGenMessage = (messages: any[], partyId: number) => ({
    ...JSON.parse(JSON.stringify(messages[partyId])),
    publicKey: authPubKey(partyId)
  });
  const round0Message = (partyId: number) => keyGenMessage(round0Messages, partyId);
  const round1Message = (partyId: number) => keyGenMessage(round1Messages, partyId);

  /** Sign a request the same way BWC does: hash with reversal, then sign little-endian */
  const signRequest = (method: string, path: string, body: object, privKey: BitcoreLib.PrivateKey): string => {
    const hash = Utils.hashMessage(`${method}|${path}|${JSON.stringify(body)}`, false);
    return BitcoreLib.crypto.ECDSA.sign(hash, privKey, { endian: 'little' }).toString();
  };

  const post = (path: string, body: object, auth: Auth) =>
    app.post(urlPrefix + path)
      .set('x-identity', auth.copayerId)
      .set('x-signature', signRequest('post', path, body, auth.privKey))
      .send(body);

  const get = (path: string, auth: Auth) =>
    app.get(urlPrefix + path)
      .set('x-identity', auth.copayerId)
      .set('x-signature', signRequest('get', path, {}, auth.privKey));

  const expectError = (res, status: number, code: string, message?: string) => {
    res.status.should.equal(status);
    res.body.code.should.equal(code);
    if (message) {
      res.body.message.should.equal(message);
    }
  };

  /** Advance Date.now() past a 1 minute session time limit */
  const expireSession = () => {
    const now = Date.now() + 2 * 60 * 1000;
    sandbox.stub(Date, 'now').returns(now);
  };

  /**
   * Store a keygen session initiated by party 0 directly in the db.
   * - `registered`: parties whose auth pub key was registered by the initiator (v1.2+)
   * - `joined`: parties that have also submitted their round 0 message
   */
  const createKeyGenSession = async (opts: { version?: number; registered?: number[]; joined?: number[]; timeLimit?: number } = {}) => {
    const { version = 1.2, registered = [], joined = [], timeLimit } = opts;
    const doc = TssKeyGenModel.create({
      id: SESSION_ID,
      message: round0Message(0),
      n: vector.n,
      copayerId: copayerIds[0],
      version,
      timeLimit
    });
    if (version <= 1.1) {
      // authPublicKeys did not exist before v1.2. Make sure the legacy path doesn't rely on it.
      delete doc.authPublicKeys;
    }
    for (const partyId of registered) {
      doc.authPublicKeys[partyId] = authPubKey(partyId);
    }
    for (const partyId of joined) {
      if (version > 1.1) {
        doc.authPublicKeys[partyId] = authPubKey(partyId);
      }
      doc.participants[partyId] = copayerIds[partyId];
      doc.rounds[0].push({ fromPartyId: partyId, messages: round0Message(partyId) });
    }
    await storage.storeTssKeyGenSession({ doc });
  };

  before(async function() {
    await helpers.before();
  });

  after(async function() {
    await helpers.after();
  });

  beforeEach(function(done) {
    storage = helpers.getStorage();
    const blockchainExplorerMock = helpers.getBlockchainExplorer();

    const expressApp = new BWS.ExpressApp();
    expressApp.start(
      {
        ignoreRateLimiter: true,
        storage: storage,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
        doNotCheckV8: true
      },
      () => {
        app = request(expressApp.app);
        done();
      }
    );
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('Key generation', function() {
    beforeEach(async function() {
      await storage.db.collection(BWS.Storage.collections.TSS_KEYGEN).deleteMany({});
    });

    describe('POST /v1/tss/keygen/:id', function() {
      const path = `/v1/tss/keygen/${SESSION_ID}`;

      describe('initiating a session', function() {
        it('should create a new session from party 0\'s round 0 message', async function() {
          const res = await post(path, { message: round0Message(0), n: vector.n, version: 1.2 }, partyAuth(0));
          res.status.should.equal(200);

          const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
          session.schemeVersion.should.equal(1.2);
          session.participants.should.deep.equal([copayerIds[0], null, null]);
          session.authPublicKeys.should.deep.equal([authPubKey(0), null, null]);
        });

        it('should error if x-identity is missing', async function() {
          const res = await app.post(urlPrefix + path).send({ message: round0Message(0), n: vector.n, version: 1.2 });
          expectError(res, 401, 'NOT_AUTHORIZED');
        });

        it('should error if a party other than 0 tries to start the session', async function() {
          const res = await post(path, { message: round0Message(1), n: vector.n, version: 1.2 }, partyAuth(1));
          expectError(res, 401, 'NOT_AUTHORIZED', 'Session not found');
        });

        it('should error if the request is not signed by the message\'s publicKey', async function() {
          const res = await post(path, { message: round0Message(0), n: vector.n, version: 1.2 }, { copayerId: copayerIds[0], privKey: randomKey() });
          expectError(res, 401, 'NOT_AUTHORIZED', 'Invalid signature');
        });

        it('should error if the message has no publicKey', async function() {
          const message = round0Message(0);
          delete message.publicKey;
          const res = await post(path, { message, n: vector.n, version: 1.2 }, partyAuth(0));
          expectError(res, 401, 'NOT_AUTHORIZED');
        });

        it('should error if party 0 tries to start the session with a non-round 0 message', async function() {
          const res = await post(path, { message: round1Message(0), n: vector.n, version: 1.2 }, partyAuth(0));
          expectError(res, 401, 'NOT_AUTHORIZED', 'Session not found');
        });
      });

      describe('message verification', function() {
        beforeEach(function() {
          sandbox.stub(TssKeyGen, 'processMessage').resolves();
        });

        it('should verify tss broadcast message', async function() {
          const res = await post(path, { message: round0Message(0) }, partyAuth(0));
          res.status.should.equal(200);
        });

        it('should verify tss p2p message', async function() {
          await createKeyGenSession({ joined: [1, 2] });
          const res = await post(path, { message: round1Message(0) }, partyAuth(0));
          res.status.should.equal(200);
        });

        // For an existing session, request auth uses the session's authPublicKeys rather than
        //  message.publicKey, so these reach verifyTssMessage instead of failing auth first.

        it('should error if no publicKey', async function() {
          await createKeyGenSession();
          const message = round0Message(0);
          delete message.publicKey;
          const res = await post(path, { message }, partyAuth(0));
          expectError(res, 400, 'TSS_PUBKEY_MISSING');
        });

        it('should error if publicKey is bogus', async function() {
          await createKeyGenSession();
          const message = { ...round0Message(0), publicKey: 'invalid' };
          const res = await post(path, { message }, partyAuth(0));
          expectError(res, 400, 'TSS_INVALID_MESSAGE');
        });

        it('should error if publicKey cannot verify broadcast message signature', async function() {
          await createKeyGenSession();
          const message = { ...round0Message(0), publicKey: randomKey().publicKey.toString() };
          const res = await post(path, { message }, partyAuth(0));
          expectError(res, 400, 'TSS_INVALID_MESSAGE_SIG');
        });

        it('should error if messages are empty arrays', async function() {
          const message = {
            round: 0,
            partyId: 0,
            broadcastMessages: [],
            p2pMessages: [],
            publicKey: authPubKey(0)
          };
          const res = await post(path, { message }, partyAuth(0));
          expectError(res, 400, 'TSS_INVALID_MESSAGE');
        });
      });

      describe('joining a v1.2 session', function() {
        it('should let a registered party join', async function() {
          await createKeyGenSession({ registered: [1] });

          const res = await post(path, { message: round0Message(1), version: 1.2 }, partyAuth(1));
          res.status.should.equal(200);

          const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
          session.participants[1].should.equal(copayerIds[1]);
          session.rounds[0].map(r => r.fromPartyId).should.deep.equal([0, 1]);
        });

        it('should let registered parties join out of partyId order', async function() {
          await createKeyGenSession({ registered: [1, 2] });

          for (const partyId of [2, 1]) {
            const res = await post(path, { message: round0Message(partyId), version: 1.2 }, partyAuth(partyId));
            res.status.should.equal(200);
          }

          const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
          session.participants.should.deep.equal(copayerIds);
        });

        it('should error if the party was not registered by the initiator', async function() {
          await createKeyGenSession({ registered: [1] });
          const res = await post(path, { message: round0Message(2), version: 1.2 }, partyAuth(2));
          expectError(res, 401, 'NOT_AUTHORIZED', 'Not authorized');
        });

        it('should error if the message has no publicKey', async function() {
          await createKeyGenSession({ registered: [1] });
          const message = round0Message(1);
          delete message.publicKey;
          const res = await post(path, { message, version: 1.2 }, partyAuth(1));
          expectError(res, 401, 'NOT_AUTHORIZED', 'Not authorized');
        });

        it('should error if the request is not signed by the registered key', async function() {
          await createKeyGenSession({ registered: [1] });
          const res = await post(path, { message: round0Message(1), version: 1.2 }, { copayerId: copayerIds[1], privKey: randomKey() });
          expectError(res, 401, 'NOT_AUTHORIZED', 'Invalid signature');
        });

        it('should error if the party joins at a partyId other than the one it was registered at', async function() {
          await createKeyGenSession({ registered: [1] });
          const message = { ...round0Message(1), partyId: 2 };
          const res = await post(path, { message, version: 1.2 }, partyAuth(1));
          expectError(res, 401, 'NOT_AUTHORIZED', 'Copayer not found in session');
        });

        it('should error if the registered party slot has already been taken', async function() {
          await createKeyGenSession({ joined: [1] });
          // A different copayer replaying party 1's join
          const res = await post(path, { message: round0Message(1), version: 1.2 }, { copayerId: copayerIds[2], privKey: parties[1].authKey });
          expectError(res, 401, 'NOT_AUTHORIZED', 'Not authorized');
        });

        it('should error if a registered party that has not joined sends a non-round 0 message', async function() {
          await createKeyGenSession({ registered: [1] });
          const res = await post(path, { message: round1Message(1), version: 1.2 }, partyAuth(1));
          expectError(res, 401, 'NOT_AUTHORIZED', 'Copayer not found in session');
        });

        it('should error if session is expired', async function() {
          await createKeyGenSession({ registered: [1], timeLimit: 1 });
          expireSession();
          const res = await post(path, { message: round0Message(1), version: 1.2 }, partyAuth(1));
          expectError(res, 400, 'TSS_SESSION_EXPIRED');
        });
      });

      describe('joining a legacy (v1.1) session', function() {
        it('should let a party join without being registered', async function() {
          await createKeyGenSession({ version: 1.1 });

          const res = await post(path, { message: round0Message(1), version: 1.1 }, partyAuth(1));
          res.status.should.equal(200);

          const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
          session.participants[1].should.equal(copayerIds[1]);
        });

        it('should authenticate a joined party with the publicKey from its round 0 message', async function() {
          sandbox.stub(TssKeyGen, 'processMessage').resolves();
          await createKeyGenSession({ version: 1.1, joined: [1, 2] });
          const res = await post(path, { message: round1Message(1), version: 1.1 }, partyAuth(1));
          res.status.should.equal(200);
        });

        it('should error if a joined party signs with a key other than its round 0 publicKey', async function() {
          await createKeyGenSession({ version: 1.1, joined: [1, 2] });
          const res = await post(path, { message: round1Message(1), version: 1.1 }, { copayerId: copayerIds[1], privKey: randomKey() });
          expectError(res, 401, 'NOT_AUTHORIZED', 'Invalid signature');
        });
      });

      describe('concurrent joins', function() {
        /**
         * Make the first storeTssKeyGenParticipant call lose a race: before it writes,
         * another copayer is written into `concurrentPartyId`, so the original call's __v is stale.
         */
        const stubJoinRaceCondition = (concurrentPartyId: number, concurrentCopayerId: string) => {
          const stub = sandbox.stub(BWS.Storage.prototype, 'storeTssKeyGenParticipant');
          stub.callThrough();
          stub.onFirstCall().callsFake(async function(params) {
            const current = await this.fetchTssKeyGenSession({ id: params.id });
            await stub.wrappedMethod.call(this, { id: params.id, partyId: concurrentPartyId, copayerId: concurrentCopayerId, __v: current.__v });
            return stub.wrappedMethod.call(this, params);
          });
          return stub;
        };

        it('should retry and join if another party joined concurrently', async function() {
          await createKeyGenSession({ registered: [1, 2] });
          const stub = stubJoinRaceCondition(2, copayerIds[2]);

          const res = await post(path, { message: round0Message(1), version: 1.2 }, partyAuth(1));
          res.status.should.equal(200);
          stub.callCount.should.equal(2);

          const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
          session.participants.should.deep.equal(copayerIds);
          session.rounds[0].map(r => r.fromPartyId).should.deep.equal([0, 1]);
        });

        it('should not join if another copayer took the same partyId concurrently', async function() {
          await createKeyGenSession({ version: 1.1 });
          stubJoinRaceCondition(1, copayerIds[2]);

          const res = await post(path, { message: round0Message(1), version: 1.1 }, partyAuth(1));
          res.status.should.not.equal(200);

          const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
          session.participants[1].should.equal(copayerIds[2]);
          session.rounds[0].map(r => r.fromPartyId).should.deep.equal([0]);
        });

        it('should not retry on other storage errors', async function() {
          await createKeyGenSession({ registered: [1] });
          const stub = sandbox.stub(BWS.Storage.prototype, 'storeTssKeyGenParticipant').rejects(new Error('boom'));

          const res = await post(path, { message: round0Message(1), version: 1.2 }, partyAuth(1));
          res.status.should.equal(500);
          stub.callCount.should.equal(1);
        });
      });

      describe('existing participants', function() {
        it('should error if the request signature is invalid', async function() {
          await createKeyGenSession({ joined: [1, 2] });
          const res = await post(path, { message: round1Message(0), version: 1.2 }, { copayerId: copayerIds[0], privKey: randomKey() });
          expectError(res, 401, 'NOT_AUTHORIZED', 'Invalid signature');
        });

        it('should error if session is expired', async function() {
          await createKeyGenSession({ joined: [1, 2], timeLimit: 1 });
          expireSession();
          const res = await post(path, { message: round1Message(0), version: 1.2 }, partyAuth(0));
          expectError(res, 400, 'TSS_SESSION_EXPIRED');
        });
      });
    });

    describe('POST /v1/tss/keygen/:id/register', function() {
      const path = `/v1/tss/keygen/${SESSION_ID}/register`;
      const register = (partyId: number | string, partyPubKey: string, auth: Auth = partyAuth(0)) =>
        post(path, { partyId, partyPubKey }, auth);

      it('should let the initiator register a party', async function() {
        await createKeyGenSession();

        const res = await register(1, authPubKey(1));
        res.status.should.equal(200);

        const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
        session.authPublicKeys.should.deep.equal([authPubKey(0), authPubKey(1), null]);
      });

      it('should be idempotent when re-registering the same key at the same partyId', async function() {
        await createKeyGenSession();

        (await register(1, authPubKey(1))).status.should.equal(200);
        (await register(1, authPubKey(1))).status.should.equal(200);

        const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
        session.authPublicKeys[1].should.equal(authPubKey(1));
        session.__v.should.equal(1); // second request did not write
      });

      it('should error if the key is already registered at a different partyId', async function() {
        await createKeyGenSession();
        (await register(1, authPubKey(1))).status.should.equal(200);

        const res = await register(2, authPubKey(1));
        expectError(res, 400, 'TSS_PARTY_ALREADY_REGISTERED');
      });

      it('should error if registering the initiator\'s own key', async function() {
        await createKeyGenSession();
        const res = await register(1, authPubKey(0));
        expectError(res, 400, 'TSS_PARTY_ALREADY_REGISTERED');
      });

      for (const [description, partyId, getPubKey] of [
        ['partyId is 0', 0, () => authPubKey(1)],
        ['partyId is negative', -1, () => authPubKey(1)],
        ['partyId is not a number', 'abc', () => authPubKey(1)],
        ['partyId is >= n', vector.n, () => authPubKey(1)],
        ['partyPubKey is missing', 1, () => undefined],
        ['partyPubKey is blank', 1, () => '  '],
        ['partyPubKey is the initiator\'s copayerId', 1, () => copayerIds[0]],
      ] as Array<[string, number | string, () => string]>) {
        it(`should error if ${description}`, async function() {
          await createKeyGenSession();
          const res = await register(partyId, getPubKey());
          expectError(res, 400, 'TSS_INVALID_PARTY_DATA');
        });
      }

      it('should accept a numeric string partyId', async function() {
        await createKeyGenSession();

        const res = await register('1', authPubKey(1));
        res.status.should.equal(200);

        const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
        session.authPublicKeys[1].should.equal(authPubKey(1));
      });

      for (const [description, partyId, expected] of [
        ['partyId is missing', undefined, 'undefined'],
        ['partyId is null', null, 'null'],
        ['partyId has a numeric prefix', '1abc', '1abc'],
      ] as Array<[string, any, string]>) {
        it(`should error with an invalid partyId message if ${description}`, async function() {
          await createKeyGenSession();
          const res = await register(partyId, authPubKey(1));
          expectError(res, 400, 'TSS_INVALID_PARTY_DATA', `Invalid partyId: ${expected}`);

          const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
          session.authPublicKeys.should.deep.equal([authPubKey(0), null, null]);
        });
      }

      it('should error if the party has already submitted its round 0 message', async function() {
        await createKeyGenSession({ joined: [1] });
        const res = await register(1, randomKey().publicKey.toString());
        expectError(res, 400, 'TSS_ROUNDS_ALREADY_STARTED');
      });

      it('should error if a joined participant other than the initiator tries to register a party', async function() {
        await createKeyGenSession({ joined: [1] });
        const res = await register(2, authPubKey(2), partyAuth(1));
        expectError(res, 400, 'TSS_NON_PARTICIPANT', 'Only the first participant can register a party');
      });

      it('should error if the requester is not in the session', async function() {
        await createKeyGenSession();
        const res = await register(1, authPubKey(1), partyAuth(1));
        expectError(res, 401, 'NOT_AUTHORIZED', 'Not authorized');
      });

      it('should error if the request signature is invalid', async function() {
        await createKeyGenSession();
        const res = await register(1, authPubKey(1), { copayerId: copayerIds[0], privKey: randomKey() });
        expectError(res, 401, 'NOT_AUTHORIZED', 'Invalid signature');
      });

      it('should error if the session does not exist', async function() {
        const res = await register(1, authPubKey(1));
        expectError(res, 401, 'NOT_AUTHORIZED', 'Session not found');
      });
    });

    describe('GET /v1/tss/keygen/:id/:round', function() {
      const path = `/v1/tss/keygen/${SESSION_ID}/0?maxWaitTime=0`;

      const expectRound0Messages = async (auth: Auth) => {
        const res = await get(path, auth);
        res.status.should.equal(200);
        JSON.parse(res.text).messages.length.should.equal(vector.n - 1);
      };

      /** Start, register, and join a v1.2 session through the API */
      const runRound0 = async (joinOrder: number[]) => {
        const keygenPath = `/v1/tss/keygen/${SESSION_ID}`;
        (await post(keygenPath, { message: round0Message(0), n: vector.n, version: 1.2 }, partyAuth(0))).status.should.equal(200);
        for (const partyId of [1, 2]) {
          (await post(`${keygenPath}/register`, { partyId, partyPubKey: authPubKey(partyId) }, partyAuth(0))).status.should.equal(200);
        }
        for (const partyId of joinOrder) {
          (await post(keygenPath, { message: round0Message(partyId), version: 1.2 }, partyAuth(partyId))).status.should.equal(200);
        }
      };

      it('should authenticate every party when round 0 messages arrive in partyId order', async function() {
        await runRound0([1, 2]);
        for (const partyId of [0, 1, 2]) {
          await expectRound0Messages(partyAuth(partyId));
        }
      });

      it('should authenticate every party when round 0 messages arrive out of partyId order', async function() {
        await runRound0([2, 1]);
        for (const partyId of [0, 1, 2]) {
          await expectRound0Messages(partyAuth(partyId));
        }
      });

      it('should reject another party identity', async function() {
        await createKeyGenSession({ joined: [1, 2] });
        for (const [partyId, otherPartyId] of [[1, 2], [2, 1]]) {
          const res = await get(path, { copayerId: copayerIds[otherPartyId], privKey: parties[partyId].authKey });
          expectError(res, 401, 'NOT_AUTHORIZED', 'Invalid signature');
        }
      });

      it('should error if a registered party has not joined yet', async function() {
        await createKeyGenSession({ registered: [2], joined: [1] });
        const res = await get(path, partyAuth(2));
        expectError(res, 401, 'NOT_AUTHORIZED', 'Not authorized');
      });

      it('should error if the copayer is not in the session', async function() {
        await createKeyGenSession({ joined: [1, 2] });
        const res = await get(path, { copayerId: 'notInSession', privKey: randomKey() });
        expectError(res, 401, 'NOT_AUTHORIZED', 'Not authorized');
      });

      it('should error if the session does not exist', async function() {
        const res = await get(path, partyAuth(0));
        expectError(res, 401, 'NOT_AUTHORIZED', 'Session not found');
      });

      it('should error if session is expired', async function() {
        await createKeyGenSession({ joined: [1, 2], timeLimit: 1 });
        expireSession();
        const res = await get(path, partyAuth(0));
        expectError(res, 400, 'TSS_SESSION_EXPIRED');
      });

      describe('legacy (v1.1) session', function() {
        it('should authenticate every party with the publicKey from its round 0 message', async function() {
          await createKeyGenSession({ version: 1.1, joined: [1, 2] });
          for (const partyId of [0, 1, 2]) {
            await expectRound0Messages(partyAuth(partyId));
          }
        });

        it('should reject another party identity', async function() {
          await createKeyGenSession({ version: 1.1, joined: [1, 2] });
          for (const [partyId, otherPartyId] of [[1, 2], [2, 1]]) {
            const res = await get(path, { copayerId: copayerIds[otherPartyId], privKey: parties[partyId].authKey });
            expectError(res, 401, 'NOT_AUTHORIZED', 'Invalid signature');
          }
        });

        it('should error if the copayer is not in the session', async function() {
          await createKeyGenSession({ version: 1.1, joined: [1, 2] });
          const res = await get(path, { copayerId: 'notInSession', privKey: randomKey() });
          expectError(res, 401, 'NOT_AUTHORIZED', 'Copayer not found in session');
        });
      });
    });
  });

  describe('Signing', function() {
    // party 0 & 1 are signing; party 2 is a wallet copayer who is not part of the signing session
    const sigMessage = (partyId: number) => ({
      round: 0,
      partyId,
      publicKey: authPubKey(partyId),
      broadcastMessages: [],
      p2pMessages: []
    });

    const createSigSession = async (opts: { timeLimit?: number } = {}) => {
      const doc = TssSigGenModel.create({
        id: SESSION_ID,
        message: sigMessage(0) as any,
        m: 2,
        copayerId: copayerIds[0],
        version: 1.1,
        timeLimit: opts.timeLimit
      });
      doc.participants.push({ partyId: 1, copayerId: copayerIds[1] });
      doc.rounds[0].push({ fromPartyId: 1, messages: sigMessage(1) as any });
      await storage.storeTssSigSession({ doc });
    };

    beforeEach(async function() {
      await storage.db.collection(BWS.Storage.collections.TSS_SIGN).deleteMany({});
      await storage.db.collection(BWS.Storage.collections.COPAYERS_LOOKUP).deleteMany({});
      await storage.db.collection(BWS.Storage.collections.COPAYERS_LOOKUP).insertMany([0, 1, 2].map(partyId => ({
        copayerId: copayerIds[partyId],
        walletId: 'test',
        requestPubKey: authPubKey(partyId),
      })));
    });

    describe('POST /v1/tss/sign/:id', function() {
      const path = `/v1/tss/sign/${SESSION_ID}`;

      it('should error if session is expired', async function() {
        await createSigSession({ timeLimit: 1 });
        expireSession();

        const message = { ...sigMessage(1), round: 1, p2pMessages: [{ payload: { encryptedMessage: 'encryptie', signature: 'siggie' } }] };
        const res = await post(path, { message }, partyAuth(1));
        expectError(res, 400, 'TSS_SESSION_EXPIRED');
      });
    });

    describe('GET /v1/tss/sign/:id/:round', function() {
      const path = `/v1/tss/sign/${SESSION_ID}/0?maxWaitTime=0`;

      it('should return round messages to a session participant', async function() {
        await createSigSession();
        const res = await get(path, partyAuth(0));
        res.status.should.equal(200);
        const body = JSON.parse(res.text);
        body.messages.length.should.equal(1);
        body.participants.should.deep.equal([copayerIds[1]]);
      });

      it('should error if the copayer is not registered', async function() {
        await createSigSession();
        const res = await get(path, { copayerId: 'unknownCopayer', privKey: randomKey() });
        expectError(res, 401, 'NOT_AUTHORIZED', 'Copayer not found');
      });

      it('should error if the copayer is not a session participant', async function() {
        await createSigSession();
        const res = await get(path, partyAuth(2));
        expectError(res, 401, 'NOT_AUTHORIZED', 'Copayer not found in session');
      });

      it('should error if the request signature is invalid', async function() {
        await createSigSession();
        const res = await get(path, { copayerId: copayerIds[0], privKey: randomKey() });
        expectError(res, 401, 'NOT_AUTHORIZED', 'Invalid signature');
      });

      it('should reject another participant identity', async function() {
        await createSigSession();
        const res = await get(path, { copayerId: copayerIds[1], privKey: parties[0].authKey });
        expectError(res, 401, 'NOT_AUTHORIZED', 'Invalid signature');
      });

      it('should error if the session does not exist', async function() {
        const res = await get(path, partyAuth(0));
        expectError(res, 400, 'TSS_SESSION_NOT_FOUND');
      });

      it('should error if session is expired', async function() {
        await createSigSession({ timeLimit: 1 });
        expireSession();
        const res = await get(path, partyAuth(0));
        expectError(res, 400, 'TSS_SESSION_EXPIRED');
      });
    });

    describe('POST /v1/tss/sign/:id/store', function() {
      const path = `/v1/tss/sign/${SESSION_ID}/store`;
      const signature = {
        r: '0x71a8fb6b23203f7ae7f5df7dac410204d8b8d8b74e31c3919e0c764a00925f74',
        s: '0x18048c9ce4a860f6354b4bb795178ff3cde858ed3afef6c2e2c51c8fac8b9257',
        v: 1,
        pubKey: '0267c2c572fcc1a5026d0e5d8e60a04ff6adeaf1a3a996c9c69f3b1714cff1db85',
      };
      const expectMismatch = res => expectError(res, 400, 'TSS_FINAL_SIGNATURE_MISMATCH', 'Final signature does not match the one generated by the session');

      /** Make the session look unsigned for the first 2 fetches (middleware + storeSignature) to simulate a concurrent store */
      const stubStoreRaceCondition = () => {
        const fetchSessionStub = sandbox.stub(BWS.Storage.prototype, 'fetchTssSigSession');
        fetchSessionStub.callsFake(async function({ id }) {
          const session = await fetchSessionStub.wrappedMethod.call(this, { id });
          session.signature = null;
          return session;
        });
        fetchSessionStub.onThirdCall().callsFake(async function({ id }) {
          return fetchSessionStub.wrappedMethod.call(this, { id });
        });
      };

      beforeEach(async function() {
        await createSigSession();
        await storage.storeTssSignature({ id: SESSION_ID, signature });
      });

      it('should accept a signature matching the session signature', async function() {
        const res = await post(path, { signature }, partyAuth(1));
        res.status.should.equal(200);
      });

      for (const [field, value] of [
        ['r', '0x71a8fb6b23203f7ae7f5df7dac410204d8b8d8b74e31c3919e0c764a00925f75'],
        ['s', '0x18048c9ce4a860f6354b4bb795178ff3cde858ed3afef6c2e2c51c8fac8b9256'],
        ['v', 123],
        ['pubKey', 'not-equal-pub-key'],
      ] as Array<[string, string | number]>) {
        it(`should throw a mismatch error for a mismatched signature: ${field}`, async function() {
          const res = await post(path, { signature: { ...signature, [field]: value } }, partyAuth(0));
          expectMismatch(res);
        });
      }

      it('should cleanly handle race condition when saving signature', async function() {
        stubStoreRaceCondition();
        const res = await post(path, { signature }, partyAuth(0));
        res.status.should.equal(200);
      });

      it('should handle race condition when saving signature but mismatched signature', async function() {
        stubStoreRaceCondition();
        const modifiedSignature = {
          ...signature,
          r: '0x71a8fb6b23203f7ae7f5df7dac410204d8b8d8b74e31c3919e0c764a00925f75', // modified r value to create a mismatch
        };
        const res = await post(path, { signature: modifiedSignature }, partyAuth(0));
        expectMismatch(res);
      });

      it('should error if the copayer is not registered', async function() {
        const res = await post(path, { signature }, { copayerId: 'unknownCopayer', privKey: randomKey() });
        expectError(res, 401, 'NOT_AUTHORIZED', 'Copayer not found');
      });

      it('should error if the copayer is not a session participant', async function() {
        const res = await post(path, { signature }, partyAuth(2));
        expectError(res, 401, 'NOT_AUTHORIZED', 'Copayer not found in session');
      });

      it('should error if the request signature is invalid', async function() {
        const res = await post(path, { signature }, { copayerId: copayerIds[0], privKey: randomKey() });
        expectError(res, 401, 'NOT_AUTHORIZED', 'Invalid signature');
      });
    });
  });
});
