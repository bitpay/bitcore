import sinon from 'sinon';
import * as chai from 'chai';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import request from 'supertest';
import * as twoOfThree from './data/tss/2of3';
import BWS from '../../src/index';
import helpers from './helpers';
import { TssKeyGen } from '../../src/lib/tss';
import { TssSigGenModel } from '../../src/lib/model/tsssign';
import { TssKeyGenModel } from '../../src/lib/model/tsskeygen';
import { WalletService } from '../../src/lib/server';
import { Common } from '../../src/lib/common/index';

const { Utils } = Common;
const should = chai.should();

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

        // The wrapper key must be the one the party enrolled with, so a missing or different key is refused
        //  by authentication before the payload is verified.

        it('should error if no publicKey', async function() {
          await createKeyGenSession();
          const message = round0Message(0);
          delete message.publicKey;
          const res = await post(path, { message }, partyAuth(0));
          expectError(res, 401, 'NOT_AUTHORIZED');
        });

        it('should error if publicKey is bogus', async function() {
          await createKeyGenSession();
          const message = { ...round0Message(0), publicKey: 'invalid' };
          const res = await post(path, { message }, partyAuth(0));
          expectError(res, 401, 'NOT_AUTHORIZED');
        });

        it('should error if publicKey cannot verify broadcast message signature', async function() {
          await createKeyGenSession();
          const message = round0Message(0);
          message.broadcastMessages[0].payload.signature = round0Message(1).broadcastMessages[0].payload.signature;
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
          for (const m of message.broadcastMessages) m.from = 2;
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
        const isSessionWrite = (collection: any, filter: any) =>
          collection.collectionName === BWS.Storage.collections.TSS_KEYGEN && filter?.id === SESSION_ID;

        /**
         * Make the first write to the session lose a race: before it runs, another copayer is written into
         * `concurrentPartyId`, so the original write's __v is stale. Independent of which storage method issues the write.
         */
        const stubJoinRaceCondition = (concurrentPartyId: number, concurrentCopayerId: string) => {
          const stub = sandbox.stub(Object.getPrototypeOf(storage.db.collection(BWS.Storage.collections.TSS_KEYGEN)), 'updateOne');
          const original = stub.wrappedMethod;
          let sessionWrites = 0;
          stub.callsFake(async function(this: any, filter: any, update: any, ...rest: any[]) {
            if (isSessionWrite(this, filter) && ++sessionWrites === 1) {
              const current = await this.findOne({ id: SESSION_ID });
              await original.call(this, { id: SESSION_ID, __v: current.__v }, {
                $set: { [`participants.${concurrentPartyId}`]: concurrentCopayerId },
                $inc: { __v: 1 }
              });
            }
            return original.call(this, filter, update, ...rest);
          });
          return { writes: () => sessionWrites };
        };

        it('should retry and join if another party joined concurrently', async function() {
          await createKeyGenSession({ registered: [1, 2] });
          const race = stubJoinRaceCondition(2, copayerIds[2]);

          const res = await post(path, { message: round0Message(1), version: 1.2 }, partyAuth(1));
          res.status.should.equal(200);
          race.writes().should.be.at.least(2); // the conflicted write, then the successful retry

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
          const stub = sandbox.stub(Object.getPrototypeOf(storage.db.collection(BWS.Storage.collections.TSS_KEYGEN)), 'updateOne');
          const original = stub.wrappedMethod;
          let sessionWrites = 0;
          stub.callsFake(function(this: any, filter: any, ...rest: any[]) {
            if (isSessionWrite(this, filter)) {
              sessionWrites++;
              return Promise.reject(new Error('boom'));
            }
            return original.call(this, filter, ...rest);
          });

          const res = await post(path, { message: round0Message(1), version: 1.2 }, partyAuth(1));
          res.status.should.equal(500);
          sessionWrites.should.equal(1);
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

      it('should not coerce a numeric string partyId', async function() {
        await createKeyGenSession();

        const res = await register('1', authPubKey(1));
        expectError(res, 400, 'TSS_INVALID_PARTY_DATA');

        const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
        session.authPublicKeys.should.deep.equal([authPubKey(0), null, null]);
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

  describe('/v1/tss/keygen/:id/join-delivery', function() {
    const path = `/v1/tss/keygen/${SESSION_ID}/join-delivery`;
    const rec = (partyId: number, tag = '') => ({ partyId, encryptedMessage: 'ct' + partyId + tag, signature: 'sig' + partyId + tag });
    const fullSet = (tag = '') => ({ version: 1, records: [rec(1, tag), rec(2, tag)] });

    // The query string is part of the signed URL
    const getDelivery = (partyId: number, query = '') => get(path + query, partyAuth(partyId));
    const postDelivery = (partyId: number, body: object) => post(path, body, partyAuth(partyId));
    const clearSessions = () => storage.db.collection(BWS.Storage.collections.TSS_KEYGEN).deleteMany({});
    const storedDelivery = async () => {
      const doc = await storage.db.collection(BWS.Storage.collections.TSS_KEYGEN).findOne({ id: SESSION_ID });
      return doc.bwsJoinDelivery;
    };

    beforeEach(async function() {
      await clearSessions();
      await createKeyGenSession({ joined: [1, 2] });
    });

    it('should reach the handlers rather than the generic /:round route', async function() {
      const pending = await getDelivery(1);
      pending.status.should.equal(400);
      pending.body.code.should.equal('TSS_JOIN_DELIVERY_PENDING');

      const res = await postDelivery(0, fullSet());
      res.status.should.equal(200);
      const delivered = await getDelivery(1);
      delivered.status.should.equal(200);
      delivered.body.should.deep.equal({ version: 1, encryptedMessage: 'ct1', signature: 'sig1' });
    });

    it('should let the creator publish and each recipient read only its own record, repeatedly', async function() {
      (await postDelivery(0, fullSet())).status.should.equal(200);

      for (let i = 0; i < 2; i++) {
        for (const partyId of [1, 2]) {
          const res = await getDelivery(partyId);
          res.status.should.equal(200);
          res.body.should.deep.equal({ version: 1, encryptedMessage: 'ct' + partyId, signature: 'sig' + partyId });
        }
      }
      (await storedDelivery()).should.deep.equal(fullSet());
    });

    it('should let the creator overwrite a published set', async function() {
      (await postDelivery(0, fullSet())).status.should.equal(200);
      (await postDelivery(0, fullSet('b'))).status.should.equal(200);

      const res = await getDelivery(2);
      res.body.should.deep.equal({ version: 1, encryptedMessage: 'ct2b', signature: 'sig2b' });
    });

    it('should not let a supplied recipient selector expand access', async function() {
      (await postDelivery(0, fullSet())).status.should.equal(200);

      for (const query of ['?partyId=2', '?recipient=2&copayerId=' + copayerIds[2], '?round=2']) {
        const res = await getDelivery(1, query);
        res.status.should.equal(200);
        res.body.should.deep.equal({ version: 1, encryptedMessage: 'ct1', signature: 'sig1' });
      }
    });

    it('should reject POST from a participant other than the creator', async function() {
      const res = await postDelivery(1, fullSet());
      res.status.should.equal(400);
      res.body.code.should.equal('TSS_GENERIC_ERROR');
      should.not.exist(await storedDelivery());
    });

    it('should give the creator no delivery to read', async function() {
      (await postDelivery(0, fullSet())).status.should.equal(200);
      const res = await getDelivery(0);
      res.status.should.equal(400);
      res.body.code.should.equal('TSS_GENERIC_ERROR');
    });

    it('should reject malformed sets without changing the stored delivery', async function() {
      (await postDelivery(0, fullSet())).status.should.equal(200);

      const bad = [
        { version: 2, records: fullSet().records },
        { version: 1, records: [rec(1)] },
        { version: 1, records: [rec(1), rec(1)] },
        { version: 1, records: [rec(0), rec(1)] },
        { version: 1, records: [rec(1), rec(3)] },
        { version: 1, records: [rec(1), { partyId: 2, encryptedMessage: 'ct' }] },
        { version: 1 }
      ];
      for (const body of bad) {
        const res = await postDelivery(0, body);
        res.status.should.equal(400);
        res.body.code.should.equal('TSS_GENERIC_ERROR');
      }
      (await storedDelivery()).should.deep.equal(fullSet());
    });

    it('should reject outsiders, missing signatures and invalid signatures', async function() {
      const body = fullSet();
      const outsider = { copayerId: 'notInSession', privKey: randomKey() };
      const outsiderPost = await post(path, body, outsider);
      outsiderPost.status.should.equal(401);
      outsiderPost.body.code.should.equal('NOT_AUTHORIZED');

      const outsiderGet = await get(path, { copayerId: outsider.copayerId, privKey: parties[1].authKey });
      outsiderGet.status.should.equal(401);

      const unsigned = await app.post(urlPrefix + path).set('x-identity', copayerIds[0]).send(body);
      unsigned.status.should.equal(401);
      const noIdentity = await app.get(urlPrefix + path);
      noIdentity.status.should.equal(401);

      // a signature from another participant, and a signature over a different body
      const wrongKey = await postDelivery(0, body).set('x-signature', signRequest('post', path, body, parties[1].authKey));
      wrongKey.status.should.equal(401);
      wrongKey.body.message.should.equal('Invalid signature');
      const wrongBody = await postDelivery(0, body).set('x-signature', signRequest('post', path, fullSet('x'), parties[0].authKey));
      wrongBody.status.should.equal(401);
      const impersonate = await getDelivery(1).set('x-identity', copayerIds[2]);
      impersonate.status.should.equal(401);
      impersonate.body.message.should.equal('Invalid signature');

      should.not.exist(await storedDelivery());
    });

    it('should reject POST and GET once the session has expired', async function() {
      (await postDelivery(0, fullSet())).status.should.equal(200);

      const later = Date.now() + 2 * 60 * 60 * 1000;
      sandbox.stub(Date, 'now').returns(later);

      const posted = await postDelivery(0, fullSet('b'));
      posted.status.should.equal(400);
      posted.body.code.should.equal('TSS_SESSION_EXPIRED');
      const fetched = await getDelivery(1);
      fetched.status.should.equal(400);
      fetched.body.code.should.equal('TSS_SESSION_EXPIRED');
      (await storedDelivery()).should.deep.equal(fullSet());
    });

    describe('legacy (v1.1) session', function() {
      it('should let the creator publish and a recipient read its own record', async function() {
        await clearSessions();
        await createKeyGenSession({ version: 1.1, joined: [1, 2] });

        (await postDelivery(0, fullSet())).status.should.equal(200);
        const res = await getDelivery(1);
        res.status.should.equal(200);
        res.body.should.deep.equal({ version: 1, encryptedMessage: 'ct1', signature: 'sig1' });
      });
    });
  });

  describe('GET /v1/tss/keygen/:id/:round validation', function() {
    const parties = [vector.party0, vector.party1];
    const pubKey = (partyId: number) => parties[partyId].authKey.publicKey.toString();

    const get = (url: string, partyId: number) => {
      const hash = Utils.hashMessage(`get|${url}|{}`, false);
      const xSignature = BitcoreLib.crypto.ECDSA.sign(hash, parties[partyId].authKey, { endian: 'little' }).toString();
      return app.get(urlPrefix + url).set('x-identity', pubKey(partyId)).set('x-signature', xSignature);
    };

    beforeEach(async function() {
      const storage = helpers.getStorage();
      await storage.db.collection(BWS.Storage.collections.TSS_KEYGEN).deleteMany({});
      const keyGen = TssKeyGenModel.create({
        id: 'test',
        message: { partyId: 0, publicKey: pubKey(0) } as any,
        n: 2,
        copayerId: pubKey(0),
        version: 1.1
      });
      keyGen.participants[1] = pubKey(1);
      keyGen.rounds[0].push({ fromPartyId: 1, messages: { partyId: 1, publicKey: pubKey(1) } as any });
      await storage.storeTssKeyGenSession({ doc: keyGen });
    });

    it('should reject a non-numeric round instead of answering with an empty round', async function() {
      for (const round of ['secret', '1abc', '-1', '1.5']) {
        const res = await get(`/v1/tss/keygen/test/${round}?maxWaitTime=0`, 1);
        res.status.should.equal(400);
        res.body.code.should.equal('TSS_GENERIC_ERROR');
      }
    });
  });

  describe('KeyGen admission', function() {
    const path = `/v1/tss/keygen/${SESSION_ID}`;
    const registerPath = `${path}/register`;
    const col = () => storage.db.collection(BWS.Storage.collections.TSS_KEYGEN);
    const rawDoc = () => col().findOne({ id: SESSION_ID });
    const bsonBytes = (doc: object): Buffer => new (require('bson'))().serialize(doc);
    const round2Messages = [vector.keygen.messages.round2.party0, vector.keygen.messages.round2.party1, vector.keygen.messages.round2.party2];
    const round3Messages = [vector.keygen.messages.round3.party0, vector.keygen.messages.round3.party1, vector.keygen.messages.round3.party2];
    const hashJoinPassword = (password: string) => BitcoreLib.crypto.Hash.sha256(Buffer.from(SESSION_ID + password)).toString('hex');
    let brokerSend: sinon.SinonSpy;

    /** Bounded wait so a request the server never answers fails an assertion instead of hanging the suite */
    const settled = (request: PromiseLike<any>, ms = 1500): Promise<any> => {
      let timer: NodeJS.Timeout;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no response within ${ms}ms`)), ms);
      });
      return Promise.race([Promise.resolve(request), timeout]).finally(() => clearTimeout(timer));
    };

    /** Send a request that must be refused, then require the stored document and the broker to be untouched */
    const expectRejected = async (send: () => PromiseLike<any>, expected: { status?: number; code?: string } = {}) => {
      const before = await rawDoc();
      const res = await settled(send());
      const after = await rawDoc();
      bsonBytes(after).equals(bsonBytes(before)).should.equal(true, 'stored session changed');
      brokerSend.callCount.should.equal(0, 'a notification was published');
      if (expected.code) {
        expectError(res, expected.status ?? 400, expected.code);
      } else {
        res.status.should.be.within(400, 499, `expected a 4xx response, got ${res.status}`);
      }
    };

    /** Mark the session with a join password, leaving __v alone */
    const setPassword = (password: string) =>
      col().updateOne({ id: SESSION_ID }, { $set: { joinPassword: hashJoinPassword(password) } });

    /** Complete rounds 0 through `upTo - 1` for every party so that round `upTo` is the open round */
    const completeRoundsBefore = async (upTo: number) => {
      const all = [round0Messages, round1Messages, round2Messages, round3Messages];
      const $set = {};
      for (let round = 1; round < upTo; round++) {
        $set[`rounds.${round}`] = [0, 1, 2].map(partyId => ({ fromPartyId: partyId, messages: keyGenMessage(all[round], partyId) }));
      }
      await col().updateOne({ id: SESSION_ID }, { $set });
    };

    /** A round 0 message from `copayer`'s own key, claiming `partyId` with consistent nested senders */
    const round0Claim = (copayer: number, partyId: number) => {
      const message = round0Message(copayer);
      message.partyId = partyId;
      for (const m of message.broadcastMessages) m.from = partyId;
      return message;
    };

    /** Re-sign a broadcast message with another key so that its payload verifies against that key */
    const resignBroadcast = (message: any, key: BitcoreLib.PrivateKey) => {
      for (const m of message.broadcastMessages) {
        const hash = BitcoreLib.crypto.Hash.sha256sha256(Buffer.from(m.payload.message, 'base64'));
        m.payload.signature = BitcoreLib.crypto.ECDSA.sign(hash, key).toString();
      }
      message.publicKey = key.publicKey.toString();
      return message;
    };

    /**
     * Hold the first `count` writes to the session document at a barrier until all of them have arrived
     * (so every holder has read the same version), then let them through one at a time.
     * `first` picks which held write goes first; by default it is arrival order.
     */
    const gateWrites = (count: number, first?: (update: any) => boolean) => {
      const proto = Object.getPrototypeOf(col());
      const stub = sandbox.stub(proto, 'updateOne');
      const original = stub.wrappedMethod;
      const held: Array<{ update: any; run: () => Promise<void> }> = [];
      let gated = 0;
      let timer: NodeJS.Timeout;
      const release = async () => {
        clearTimeout(timer);
        const order = first ? [...held].sort((a, b) => Number(first(b.update)) - Number(first(a.update))) : held;
        for (const h of order) {
          await h.run();
        }
      };
      stub.callsFake(function(this: any, filter: any, update: any, ...rest: any[]) {
        if (this.collectionName !== BWS.Storage.collections.TSS_KEYGEN || filter?.id !== SESSION_ID || gated >= count) {
          return original.call(this, filter, update, ...rest);
        }
        gated++;
        return new Promise((resolve, reject) => {
          held.push({ update, run: () => original.call(this, filter, update, ...rest).then(resolve, reject) });
          if (held.length === 1) {
            timer = setTimeout(release, 1500);
          }
          if (held.length === count) {
            release();
          }
        });
      });
      return { arrivals: () => held.length };
    };

    /** Fail every write that appends a message, as a database outage between two separate writes would */
    const failMessageWrites = () => {
      const stub = sandbox.stub(Object.getPrototypeOf(col()), 'updateOne');
      const original = stub.wrappedMethod;
      stub.callsFake(function(this: any, filter: any, update: any, ...rest: any[]) {
        if (this.collectionName === BWS.Storage.collections.TSS_KEYGEN && update?.$push) {
          return Promise.reject(new Error('injected failure'));
        }
        return original.call(this, filter, update, ...rest);
      });
    };

    const round0KeyFor = (doc: any, partyId: number) =>
      doc.rounds[0].filter(r => r.fromPartyId === partyId).map(r => r.messages.publicKey);

    beforeEach(async function() {
      await col().deleteMany({});
      brokerSend = sandbox.spy(WalletService.getMessageBroker(), 'send');
    });

    describe('malformed outer partyId', function() {
      const senders: Array<[string, () => Promise<{ message: () => any; auth: Auth; version: number }>]> = [
        ['an enrolled sender (v1.2)', async () => {
          await createKeyGenSession({ joined: [1, 2] });
          return { message: () => round1Message(1), auth: partyAuth(1), version: 1.2 };
        }],
        ['an enrolled sender (legacy)', async () => {
          await createKeyGenSession({ version: 1.1, joined: [1, 2] });
          return { message: () => round1Message(1), auth: partyAuth(1), version: 1.1 };
        }],
        ['a registered joiner (v1.2)', async () => {
          await createKeyGenSession({ registered: [1] });
          return { message: () => round0Message(1), auth: partyAuth(1), version: 1.2 };
        }],
        ['a legacy joiner', async () => {
          await createKeyGenSession({ version: 1.1 });
          return { message: () => round0Message(1), auth: partyAuth(1), version: 1.1 };
        }],
      ];
      const malformed: Array<[string, any]> = [
        ['"00"', '00'],
        ['"1"', '1'],
        ['null', null],
        ['omitted', undefined],
        ['-1', -1],
        ['an unsafe integer', 2 ** 53],
      ];
      const outOfRange: Array<[string, number]> = [['n', vector.n], ['n + 1', vector.n + 1]];

      for (const [senderName, setup] of senders) {
        describe(`from ${senderName}`, function() {
          for (const [valueName, value] of malformed) {
            it(`should reject partyId ${valueName} as an invalid message`, async function() {
              const { message, auth, version } = await setup();
              const body = { message: { ...message(), partyId: value }, version };
              await expectRejected(() => post(path, body, auth), { status: 400, code: 'TSS_INVALID_MESSAGE' });
            });
          }

          for (const [valueName, value] of outOfRange) {
            it(`should reject partyId ${valueName}`, async function() {
              const { message, auth, version } = await setup();
              const body = { message: { ...message(), partyId: value }, version };
              await expectRejected(() => post(path, body, auth));
            });
          }
        });
      }

      for (const [name, version, registered] of [['legacy', 1.1, []], ['v1.2 with a registered key', 1.2, [2]]] as Array<[string, number, number[]]>) {
        it(`should reject the "00" slot alias from an outsider in a ${name} session before authentication and keep the creator enrolled and readable`, async function() {
          await createKeyGenSession({ version, registered, joined: [1] });
          const body = { message: { ...round0Message(2), partyId: '00' }, version };
          await expectRejected(() => post(path, body, partyAuth(2)), { status: 400, code: 'TSS_INVALID_MESSAGE' });

          const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
          session.participants[0].should.equal(copayerIds[0]);
          const res = await get(`${path}/0?maxWaitTime=0`, partyAuth(0));
          res.status.should.equal(200);
        });
      }
    });

    describe('malformed round', function() {
      for (const [name, value] of [['omitted', undefined], ['the string "0"', '0'], ['4', 4], ['5', 5], ['-1', -1]] as Array<[string, any]>) {
        it(`should reject round ${name} from an enrolled sender`, async function() {
          await createKeyGenSession({ joined: [1, 2] });
          const body = { message: { ...round1Message(1), round: value }, version: 1.2 };
          await expectRejected(() => post(path, body, partyAuth(1)), { status: 400, code: 'TSS_INVALID_MESSAGE' });
        });
      }

      it('should reject the string round "0" from a legacy joiner', async function() {
        await createKeyGenSession({ version: 1.1 });
        const body = { message: { ...round0Message(1), round: '0' }, version: 1.1 };
        await expectRejected(() => post(path, body, partyAuth(1)), { status: 400, code: 'TSS_INVALID_MESSAGE' });
      });
    });

    describe('nested sender metadata', function() {
      const mutations: Array<[string, (message: any) => void]> = [
        ['a p2p message from another party', m => { m.p2pMessages[0].from = 0; }],
        ['a later p2p message from another party', m => { m.p2pMessages[1].from = 2; }],
        ['a p2p message addressed to its sender', m => { m.p2pMessages[0].to = 1; }],
        ['a p2p recipient equal to n', m => { m.p2pMessages[0].to = vector.n; }],
        ['a fractional p2p recipient', m => { m.p2pMessages[0].to = 0.5; }],
      ];
      for (const [name, mutate] of mutations) {
        it(`should reject ${name}`, async function() {
          await createKeyGenSession({ joined: [1, 2] });
          const message = round1Message(1);
          mutate(message);
          await expectRejected(() => post(path, { message, version: 1.2 }, partyAuth(1)), { status: 400, code: 'TSS_INVALID_MESSAGE' });
        });
      }

      it('should reject a broadcast whose nested sender differs from the outer partyId', async function() {
        await createKeyGenSession({ joined: [1, 2] });
        await completeRoundsBefore(3);
        const message = keyGenMessage(round3Messages, 2);
        message.broadcastMessages[0].from = 1;
        await expectRejected(() => post(path, { message, version: 1.2 }, partyAuth(2)), { status: 400, code: 'TSS_INVALID_MESSAGE' });
      });
    });

    describe('ownership and key binding', function() {
      it('should reject a non-party claiming an occupied legacy slot with the correct password', async function() {
        await createKeyGenSession({ version: 1.1, joined: [1] });
        await setPassword('pw');
        const body = { message: round0Claim(2, 1), password: 'pw', version: 1.1 };
        await expectRejected(() => post(path, body, partyAuth(2)));
      });

      it('should reject a non-party claiming an occupied v1.2 slot with the correct password', async function() {
        await createKeyGenSession({ joined: [1] });
        await setPassword('pw');
        const body = { message: round0Claim(2, 1), password: 'pw', version: 1.2 };
        await expectRejected(() => post(path, body, partyAuth(2)));
      });

      for (const [name, version] of [['legacy', 1.1], ['v1.2', 1.2]] as Array<[string, number]>) {
        it(`should reject an enrolled copayer claiming a second ${name} slot`, async function() {
          await createKeyGenSession({ version, registered: version >= 1.2 ? [1, 2] : [], joined: [1] });
          await setPassword('pw');
          const body = { message: round0Claim(1, 2), password: 'pw', version };
          await expectRejected(() => post(path, body, partyAuth(1)), { status: 401, code: 'NOT_AUTHORIZED' });
        });
      }

      it('should reject a vacant legacy slot whose round 0 message already exists', async function() {
        await createKeyGenSession({ version: 1.1, joined: [1] });
        await col().updateOne({ id: SESSION_ID }, { $set: { 'participants.1': null } });
        await expectRejected(() => post(path, { message: round0Message(1), version: 1.1 }, partyAuth(1)));
      });

      it('should reject a vacant v1.2 slot whose round 0 message already exists', async function() {
        await createKeyGenSession({ joined: [1] });
        await col().updateOne({ id: SESSION_ID }, { $set: { 'participants.1': null } });
        await expectRejected(() => post(path, { message: round0Message(1), version: 1.2 }, partyAuth(1)));
      });

      it('should reject a later-round message for a vacant slot', async function() {
        await createKeyGenSession({ version: 1.1 });
        await expectRejected(() => post(path, { message: round1Message(1), version: 1.1 }, partyAuth(1)));
      });

      it('should reject an enrolled legacy sender that changes its wrapper key on a p2p-only message', async function() {
        await createKeyGenSession({ version: 1.1, joined: [1, 2] });
        const message = { ...round1Message(1), publicKey: randomKey().publicKey.toString() };
        await expectRejected(() => post(path, { message, version: 1.1 }, partyAuth(1)));
      });

      it('should reject an enrolled v1.2 sender that changes its wrapper key on a p2p-only message', async function() {
        await createKeyGenSession({ joined: [1, 2] });
        const message = { ...round1Message(1), publicKey: randomKey().publicKey.toString() };
        await expectRejected(() => post(path, { message, version: 1.2 }, partyAuth(1)));
      });

      for (const [name, version] of [['legacy', 1.1], ['v1.2', 1.2]] as Array<[string, number]>) {
        it(`should reject an enrolled ${name} sender whose broadcast is signed by a different wrapper key`, async function() {
          await createKeyGenSession({ version, joined: [1, 2] });
          await completeRoundsBefore(3);
          const message = resignBroadcast(keyGenMessage(round3Messages, 2), randomKey());
          await expectRejected(() => post(path, { message, version }, partyAuth(2)));
        });
      }

      it('should reject an unregistered v1.2 key with the correct password and a valid self-signature', async function() {
        await createKeyGenSession({ registered: [1] });
        await setPassword('pw');
        const body = { message: round0Claim(2, 2), password: 'pw', version: 1.2 };
        await expectRejected(() => post(path, body, partyAuth(2)));
      });

      it('should reject a v1.2 key registered for another slot with the correct password and a valid self-signature', async function() {
        await createKeyGenSession({ registered: [1, 2] });
        await setPassword('pw');
        const body = { message: round0Claim(2, 1), password: 'pw', version: 1.2 };
        await expectRejected(() => post(path, body, partyAuth(2)));
      });

      describe('request authentication', function() {
        const postRaw = (body: object, headers: { identity?: string; signature?: string }) => {
          const req = app.post(urlPrefix + path).send(body);
          if (headers.identity) req.set('x-identity', headers.identity);
          if (headers.signature) req.set('x-signature', headers.signature);
          return req;
        };
        const body = () => ({ message: round1Message(1), version: 1.2 });

        beforeEach(async function() {
          await createKeyGenSession({ joined: [1, 2] });
        });

        it('should reject a forged signature', async function() {
          await expectRejected(() => post(path, body(), { copayerId: copayerIds[1], privKey: randomKey() }), { status: 401, code: 'NOT_AUTHORIZED' });
        });

        it('should reject a missing signature', async function() {
          await expectRejected(() => postRaw(body(), { identity: copayerIds[1] }), { status: 401, code: 'NOT_AUTHORIZED' });
        });

        it('should reject a missing identity', async function() {
          const signature = signRequest('post', path, body(), parties[1].authKey);
          await expectRejected(() => postRaw(body(), { signature }), { status: 401, code: 'NOT_AUTHORIZED' });
        });

        it('should reject a signature over a different body', async function() {
          const signature = signRequest('post', path, { ...body(), version: 1.1 }, parties[1].authKey);
          await expectRejected(() => postRaw(body(), { identity: copayerIds[1], signature }), { status: 401, code: 'NOT_AUTHORIZED' });
        });

        it('should reject a forged signature on the session-starting request', async function() {
          await col().deleteMany({});
          const res = await post(path, { message: round0Message(0), n: vector.n, version: 1.2 }, { copayerId: copayerIds[0], privKey: randomKey() });
          expectError(res, 401, 'NOT_AUTHORIZED');
          (await rawDoc() === null).should.equal(true);
        });
      });
    });

    describe('shape validation order', function() {
      const forged = (partyId: number) => ({ copayerId: copayerIds[partyId], privKey: randomKey() });

      it('should reject a malformed message before authentication and the service', async function() {
        await createKeyGenSession({ joined: [1, 2] });
        const processMessage = sandbox.spy(TssKeyGen, 'processMessage');
        // A forged signature would answer 401 if authentication ran first
        const body = { message: { ...round1Message(1), partyId: '1' }, version: 1.2 };
        await expectRejected(() => post(path, body, forged(1)), { status: 400, code: 'TSS_INVALID_MESSAGE' });
        processMessage.called.should.equal(false);
      });

      it('should reject a malformed message that starts a new session before authentication', async function() {
        const body = { message: { ...round0Message(0), partyId: '0' }, n: vector.n, version: 1.2 };
        const res = await post(path, body, forged(0));
        expectError(res, 400, 'TSS_INVALID_MESSAGE');
        (await rawDoc() === null).should.equal(true);
      });

      it('should reject a malformed registration before authentication and the service', async function() {
        await createKeyGenSession();
        const registerParty = sandbox.spy(TssKeyGen, 'registerParty');
        await expectRejected(() => post(registerPath, { partyId: 1.9, partyPubKey: authPubKey(1) }, forged(0)), { status: 400, code: 'TSS_INVALID_PARTY_DATA' });
        registerParty.called.should.equal(false);
      });

      it('should leave non-message routes on their authentication contract', async function() {
        await createKeyGenSession({ joined: [1, 2] });
        const res = await get(`${path}/0?maxWaitTime=0`, forged(1));
        expectError(res, 401, 'NOT_AUTHORIZED');
      });
    });

    describe('key binding', function() {
      const message1 = () => round1Message(1);

      it('should reject a new session whose proposed key is malformed', async function() {
        const body = { message: { ...round0Message(0), publicKey: 'not-a-key' }, n: vector.n, version: 1.2 };
        const res = await post(path, body, partyAuth(0));
        expectError(res, 401, 'NOT_AUTHORIZED');
        (await rawDoc() === null).should.equal(true);
      });

      it('should reject a legacy joiner whose proposed key is malformed', async function() {
        await createKeyGenSession({ version: 1.1 });
        const body = { message: { ...round0Message(1), publicKey: 'not-a-key' }, version: 1.1 };
        await expectRejected(() => post(path, body, partyAuth(1)), { status: 401, code: 'NOT_AUTHORIZED' });
      });

      it('should reject a v1.2 joiner that signs with its registered key but submits another registered key', async function() {
        await createKeyGenSession({ registered: [1, 2] });
        const body = { message: round0Claim(2, 1), version: 1.2 };
        await expectRejected(() => post(path, body, partyAuth(1)), { status: 401, code: 'NOT_AUTHORIZED' });
      });

      it('should reject an enrolled sender speaking for another slot even with consistent nested senders', async function() {
        await createKeyGenSession({ joined: [1, 2] });
        const message = { ...round1Message(1), partyId: 2 };
        message.p2pMessages = [0, 1].map(to => ({ ...message.p2pMessages[0], from: 2, to }));
        await expectRejected(() => post(path, { message, version: 1.2 }, partyAuth(1)), { status: 401, code: 'NOT_AUTHORIZED' });
      });

      it('should reject every request from a legacy party whose round 0 key is ambiguous', async function() {
        await createKeyGenSession({ version: 1.1, joined: [1, 2] });
        await col().updateOne({ id: SESSION_ID }, { $push: { 'rounds.0': { fromPartyId: 1, messages: round0Message(2) } } });
        await expectRejected(() => post(path, { message: message1(), version: 1.1 }, partyAuth(1)), { status: 401, code: 'NOT_AUTHORIZED' });
        await expectRejected(() => get(`${path}/0?maxWaitTime=0`, partyAuth(1)), { status: 401, code: 'NOT_AUTHORIZED' });
      });

      it('should reject a v1.2 message when the round 0 key disagrees with the registered key', async function() {
        await createKeyGenSession({ joined: [1, 2] });
        await col().updateOne({ id: SESSION_ID }, { $set: { 'rounds.0.1.messages.publicKey': authPubKey(2) } });
        await expectRejected(() => post(path, { message: message1(), version: 1.2 }, partyAuth(1)), { status: 401, code: 'NOT_AUTHORIZED' });
      });

      it('should keep authenticating a v1.2 party on non-message routes when its round 0 key disagrees', async function() {
        await createKeyGenSession({ joined: [1, 2] });
        await col().updateOne({ id: SESSION_ID }, { $set: { 'rounds.0.1.messages.publicKey': authPubKey(2) } });
        const res = await get(`${path}/0?maxWaitTime=0`, partyAuth(1));
        res.status.should.equal(200);
      });
    });

    describe('join password', function() {
      it('should reject a missing password for a vacant slot', async function() {
        await createKeyGenSession({ version: 1.1 });
        await setPassword('pw');
        await expectRejected(() => post(path, { message: round0Message(1), version: 1.1 }, partyAuth(1)), { status: 400, code: 'TSS_INVALID_PASSWORD' });
      });

      it('should reject a wrong password for a vacant slot', async function() {
        await createKeyGenSession({ registered: [1] });
        await setPassword('pw');
        await expectRejected(() => post(path, { message: round0Message(1), password: 'nope', version: 1.2 }, partyAuth(1)), { status: 400, code: 'TSS_INVALID_PASSWORD' });
      });

      it('should admit the correct password', async function() {
        await createKeyGenSession({ registered: [1] });
        await setPassword('pw');
        const res = await post(path, { message: round0Message(1), password: 'pw', version: 1.2 }, partyAuth(1));
        res.status.should.equal(200);
        (await storage.fetchTssKeyGenSession({ id: SESSION_ID })).participants[1].should.equal(copayerIds[1]);
      });

      it('should admit a passwordless registered v1.2 joiner', async function() {
        await createKeyGenSession({ registered: [1] });
        (await post(path, { message: round0Message(1), version: 1.2 }, partyAuth(1))).status.should.equal(200);
      });
    });

    describe('valid submissions', function() {
      it('should accept a valid p2p-only message from an enrolled sender', async function() {
        await createKeyGenSession({ joined: [1, 2] });
        const res = await post(path, { message: round1Message(1), version: 1.2 }, partyAuth(1));
        res.status.should.equal(200);
        const session = await storage.fetchTssKeyGenSession({ id: SESSION_ID });
        session.rounds[1].map(r => r.fromPartyId).should.deep.equal([1]);
      });

      it('should accept every round from 0 to 3', async function() {
        await createKeyGenSession({ joined: [1, 2] });
        for (const round of [1, 2, 3]) {
          const messages = [round1Messages, round2Messages, round3Messages][round - 1];
          for (const partyId of [0, 1, 2]) {
            const res = await post(path, { message: keyGenMessage(messages, partyId), version: 1.2 }, partyAuth(partyId));
            res.status.should.equal(200, `round ${round} party ${partyId}`);
          }
        }
      });
    });

    describe('atomic admission', function() {
      for (const [name, version] of [['legacy', 1.1], ['v1.2', 1.2]] as Array<[string, number]>) {
        it(`should leave a ${name} participant and first message absent when persistence fails`, async function() {
          await createKeyGenSession({ version, registered: version >= 1.2 ? [1] : [] });
          failMessageWrites();
          const before = await rawDoc();

          const res = await settled(post(path, { message: round0Message(1), version }, partyAuth(1)));
          res.status.should.not.equal(200);

          const after = await rawDoc();
          bsonBytes(after).equals(bsonBytes(before)).should.equal(true, 'stored session changed');
          brokerSend.callCount.should.equal(0);
        });
      }
    });

    describe('concurrency', function() {
      const joinSlot1As = (copayer: number, version = 1.1) =>
        settled(post(path, { message: round0Claim(copayer, 1), version }, partyAuth(copayer)));

      it('should let exactly one of two legacy joiners take a vacant slot', async function() {
        await createKeyGenSession({ version: 1.1 });
        const gate = gateWrites(2);

        const results = await Promise.all([joinSlot1As(1), joinSlot1As(2)]);
        gate.arrivals().should.equal(2, 'both requests must reach their first write');

        const winners = [1, 2].filter((_, i) => results[i].status === 200);
        winners.should.have.length(1);
        results[winners[0] === 1 ? 1 : 0].status.should.be.within(400, 499);

        const doc = await rawDoc();
        doc.participants[1].should.equal(copayerIds[winners[0]]);
        round0KeyFor(doc, 1).should.deep.equal([authPubKey(winners[0])]);
      });

      it('should commit one first message when one registered v1.2 identity is admitted twice at once', async function() {
        await createKeyGenSession({ registered: [1] });
        const gate = gateWrites(2);

        const results = await Promise.all([joinSlot1As(1, 1.2), joinSlot1As(1, 1.2)]);
        gate.arrivals().should.equal(2, 'both requests must reach their first write');

        results.filter(r => r.status === 200).should.have.length(1);
        results.find(r => r.status !== 200).status.should.be.within(400, 499);
        const doc = await rawDoc();
        doc.participants[1].should.equal(copayerIds[1]);
        round0KeyFor(doc, 1).should.deep.equal([authPubKey(1)]);
      });

      it('should let two registered v1.2 slots join concurrently', async function() {
        await createKeyGenSession({ registered: [1, 2] });
        const gate = gateWrites(2);

        const results = await Promise.all([1, 2].map(partyId =>
          settled(post(path, { message: round0Message(partyId), version: 1.2 }, partyAuth(partyId)))));
        gate.arrivals().should.equal(2, 'both requests must reach their first write');

        results.map(r => r.status).should.deep.equal([200, 200]);
        const doc = await rawDoc();
        doc.participants.should.deep.equal(copayerIds);
        for (const partyId of [1, 2]) {
          round0KeyFor(doc, partyId).should.deep.equal([authPubKey(partyId)]);
        }
      });

      it('should let two registrations for different slots both commit', async function() {
        await createKeyGenSession();
        const gate = gateWrites(2);

        const results = await Promise.all([1, 2].map(partyId =>
          settled(post(registerPath, { partyId, partyPubKey: authPubKey(partyId) }, partyAuth(0)))));
        gate.arrivals().should.equal(2, 'both requests must reach their first write');

        results.map(r => r.status).should.deep.equal([200, 200]);
        (await rawDoc()).authPublicKeys.should.deep.equal([authPubKey(0), authPubKey(1), authPubKey(2)]);
      });

      describe('creator key replacement during admission', function() {
        const replacementKey = () => authPubKey(2);
        const isRegistration = (update: any) => Object.keys(update?.$set || {}).some(k => k.startsWith('authPublicKeys.'));

        const race = async (firstWrite: 'registration' | 'admission') => {
          await createKeyGenSession({ registered: [1] });
          const gate = gateWrites(2, update => isRegistration(update) === (firstWrite === 'registration'));
          const [registration, admission] = await Promise.all([
            settled(post(registerPath, { partyId: 1, partyPubKey: replacementKey() }, partyAuth(0))),
            settled(post(path, { message: round0Message(1), version: 1.2 }, partyAuth(1)))
          ]);
          gate.arrivals().should.equal(2, 'both requests must reach their first write');
          return { registration, admission, doc: await rawDoc() };
        };

        it('should reject the stale key after retry when the registration commits first', async function() {
          const { registration, admission, doc } = await race('registration');
          registration.status.should.equal(200);
          admission.status.should.be.within(400, 499);
          doc.authPublicKeys[1].should.equal(replacementKey());
          (doc.participants[1] === null).should.equal(true);
          round0KeyFor(doc, 1).should.deep.equal([]);
        });

        it('should reject the replacement with a deliberate error when the admission commits first', async function() {
          const { registration, admission, doc } = await race('admission');
          admission.status.should.equal(200);
          registration.status.should.be.within(400, 499);
          doc.authPublicKeys[1].should.equal(authPubKey(1));
          doc.participants[1].should.equal(copayerIds[1]);
          round0KeyFor(doc, 1).should.deep.equal([authPubKey(1)]);
        });
      });
    });

    describe('POST /v1/tss/keygen/:id/register identifiers', function() {
      const register = (partyId: any, partyPubKey = authPubKey(1)) => post(registerPath, { partyId, partyPubKey }, partyAuth(0));
      const values: Array<[string, any]> = [
        ['fractional 1.9', 1.9],
        ['fractional 1.5', 1.5],
        ['a fractional string', '1.5'],
        ['a numeric string', '1'],
        ['a numeric string with leading zeros', '01'],
        ['null', null],
        ['omitted', undefined],
        ['negative', -1],
        ['zero', 0],
        ['n', vector.n],
        ['an unsafe integer', 2 ** 53],
      ];
      for (const [name, value] of values) {
        it(`should reject ${name} without registering any slot`, async function() {
          await createKeyGenSession();
          await expectRejected(() => register(value), { status: 400, code: 'TSS_INVALID_PARTY_DATA' });
        });
      }
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
