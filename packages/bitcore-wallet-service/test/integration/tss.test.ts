import sinon from 'sinon';
import chai from 'chai';
import 'chai/register-should';
import { BitcoreLib } from 'crypto-wallet-core';
import request from 'supertest';
import * as twoOfThree from './data/tss/2of3';
import BWS from '../../src/index';
import helpers from './helpers';
import { TssKeyGen } from '../../src/lib/tss';

const should = chai.should();

describe('TSS', function() {
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
            p2pMessages: [],
            broadcastMessages: [
              {
                from: 0,
                payload: {
                  message: "pGdmcm9tX2lkAGpwdWJsaWNfa2V5mCEDGLIYNRjfGDMYzhiCGOAY4wAY6hgnGBgYtBg9GEQYmhigGN4YXRiaGHoYrxikGI4YRBjRGJQYwhiZFhjyGENnYmlnX3NfaZghAxi9GJ8YmhiqGGcYIBj2GKUYhxjpGDQYohhYGIAYWwwYpBjHGFkYxBiaGMoY6BjUGPwY2hgmGP0YgBgiExibZXByb29momF0mCEDGMkYQRgkGEcYMRhxGP0Y4xigGJAYSRgpGJAYnBhGGKUYkBifGJkY8Rh+GCsYsxirGIcMGPAYiBjjGLEY9xhMYXOYIBhKGOMYnhi7ERjrGKYYTBIYPRiQGHIYURhLGOkYixicGJMJGLEY7xisGF8YeBicGE0IFwoIGC8YVA==",
                  signature: "3045022100e7d1209ab8463ba6af71d0df953eaecd7cf1cbb06f7a5f4f0bacde9cd555cf310220220251083ea1d6453ff376a5520f87b9f6fe2c1fa099d034453aa41b81e54f9c",
                },
                signatureR: undefined,
              },
            ],
          },
          party1: {
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
  const n = 2;
  const m = 3;

  let app;
  const urlPrefix = '/bws/api';
  const sandbox = sinon.createSandbox();

  before(async function() {
    await helpers.before();
  });

  after(async function() {
    await helpers.after();
  });

  beforeEach(function(done) {
    const storage = helpers.getStorage();
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

  describe('POST /v1/tss/keygen/:id', function() {
    const url = id => `${urlPrefix}/v1/tss/keygen/${id}`;

    describe('middleware', function() {
      beforeEach(function() {
        sandbox.stub(TssKeyGen, 'processMessage').resolves();
      });

      it('should verify tss broadcast message', function(done) {
        const message = JSON.parse(JSON.stringify(vector.keygen.messages.round0.party0));
        message.publicKey = vector.party0.authKey.publicKey.toString();
        app.post(url('test'))
          .send({ message })
          .expect(200)
          .end((err, res) => {
            should.not.exist(err);
            done();
          });
      });

      it('should verify tss p2p message', function(done) {
        const message = JSON.parse(JSON.stringify(vector.keygen.messages.round1.party0));
        message.publicKey = vector.party0.authKey.publicKey.toString();
        app.post(url('test'))
          .send({ message })
          .expect(200)
          .end((err, res) => {
            should.not.exist(err);
            done();
          });
      });

      it('should error if no publicKey', function(done) {
        app.post(url('test'))
          .send({})
          .expect(200)
          .end((err, res) => {
            should.exist(err);
            res.status.should.equal(400);
            res.body.code.should.equal('TSS_PUBKEY_MISSING');
            done();
          });
      });

      it('should error if publicKey is bogus', function(done) {
        const message = JSON.parse(JSON.stringify(vector.keygen.messages.round0.party0));
        message.publicKey = 'invalid';
        app.post(url('test'))
          .send({ message })
          .expect(200)
          .end((err, res) => {
            should.exist(err);
            res.status.should.equal(400);
            res.body.code.should.equal('TSS_INVALID_MESSAGE');
            done();
          });
      });

      it('should error if publicKey cannot verify broadcast message signature', function(done) {
        const message = JSON.parse(JSON.stringify(vector.keygen.messages.round0.party0));
        message.publicKey = new BitcoreLib.PrivateKey().publicKey.toString();
        app.post(url('test'))
          .send({ message })
          .expect(200)
          .end((err, res) => {
            should.exist(err);
            res.status.should.equal(400);
            res.body.code.should.equal('TSS_INVALID_MESSAGE_SIG');
            done();
          });
      });

      it('should error if messages are empty arrays', function(done) {
        const message = {
          broadcastMessages: [],
          p2pMessages: [],
          publicKey: new BitcoreLib.PrivateKey().publicKey.toString()
        };
        app.post(url('test'))
          .send({ message })
          .expect(200)
          .end((err, res) => {
            should.exist(err);
            res.status.should.equal(400);
            res.body.code.should.equal('TSS_INVALID_MESSAGE');
            done();
          });
      });
    });
  });
});