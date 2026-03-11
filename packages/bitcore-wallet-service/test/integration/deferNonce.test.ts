'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import util from 'util';
import sinon from 'sinon';
import * as TestData from '../testdata';
import helpers from './helpers';

const should = chai.should();

describe('Deferred Nonce (JIT EVM Nonce)', function() {
  let blockchainExplorer;
  const ETH_ADDR = '0x37d7B3bBD88EFdE6a93cF74D2F5b0385D3E3B08A';

  before(async function() {
    const res = await helpers.before();
    blockchainExplorer = res.blockchainExplorer;
  });

  beforeEach(async function() {
    await helpers.beforeEach();
  });

  after(async function() {
    await helpers.after();
  });

  describe('#createTx with deferNonce', function() {
    let server, wallet, fromAddr;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
      const address = await util.promisify(server.createAddress).call(server, {});
      fromAddr = address.address;
      await helpers.stubUtxos(server, wallet, [1, 2], { coin: 'eth' });
    });

    it('should create txp with nonce=null when deferNonce is true', async function() {
      const txOpts = {
        outputs: [{ toAddress: ETH_ADDR, amount: 8000 }],
        feePerKb: 123e2,
        from: fromAddr,
        deferNonce: true
      };
      const txp = await util.promisify(server.createTx).call(server, txOpts);
      should.exist(txp);
      txp.deferNonce.should.be.true;
      should.not.exist(txp.nonce);
    });

    it('should create txp with nonce when deferNonce is false/absent', async function() {
      const txOpts = {
        outputs: [{ toAddress: ETH_ADDR, amount: 8000 }],
        feePerKb: 123e2,
        from: fromAddr
      };
      const txp = await util.promisify(server.createTx).call(server, txOpts);
      should.exist(txp);
      should.not.exist(txp.deferNonce);
      txp.nonce.should.equal('5'); // from default mock
    });
  });

  describe('#publishTx with deferNonce', function() {
    let server, wallet, fromAddr;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
      const address = await util.promisify(server.createAddress).call(server, {});
      fromAddr = address.address;
      await helpers.stubUtxos(server, wallet, [1, 2], { coin: 'eth' });
    });

    it('should publish a deferred-nonce txp and save prePublishRaw', async function() {
      const txOpts = {
        outputs: [{ toAddress: ETH_ADDR, amount: 8000 }],
        feePerKb: 123e2,
        from: fromAddr,
        deferNonce: true
      };
      const txp = await util.promisify(server.createTx).call(server, txOpts);
      should.not.exist(txp.nonce);

      const publishOpts = helpers.getProposalSignatureOpts(txp, TestData.copayers[0].privKey_1H_0);
      const published = await util.promisify(server.publishTx).call(server, publishOpts);
      should.exist(published);
      published.status.should.equal('pending');
      published.deferNonce.should.be.true;
      should.exist(published.prePublishRaw);
    });
  });

  describe('#assignNonce', function() {
    let server, wallet, fromAddr;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
      const address = await util.promisify(server.createAddress).call(server, {});
      fromAddr = address.address;
      await helpers.stubUtxos(server, wallet, [1, 2], { coin: 'eth' });
    });

    it('should assign nonce to a deferred-nonce txp', async function() {
      blockchainExplorer.getTransactionCount = sinon.stub().callsArgWith(1, null, '10');

      const txp = await helpers.createAndPublishTx(server, {
        outputs: [{ toAddress: ETH_ADDR, amount: 8000 }],
        feePerKb: 123e2,
        from: fromAddr,
        deferNonce: true
      }, TestData.copayers[0].privKey_1H_0);

      should.not.exist(txp.nonce);

      const result = await util.promisify(server.assignNonce).call(server, {
        txProposalId: txp.id
      });
      should.exist(result);
      result.nonce.should.equal(10);
    });

    it('should return txp as-is if deferNonce is not set', async function() {
      const txp = await helpers.createAndPublishTx(server, {
        outputs: [{ toAddress: ETH_ADDR, amount: 8000 }],
        feePerKb: 123e2,
        from: fromAddr
      }, TestData.copayers[0].privKey_1H_0);

      txp.nonce.should.equal('5');

      const result = await util.promisify(server.assignNonce).call(server, {
        txProposalId: txp.id
      });
      result.nonce.should.equal('5'); // unchanged
    });

    it('should fail for non-existent txp', function(done) {
      server.assignNonce({ txProposalId: 'nonexistent' }, function(err) {
        should.exist(err);
        err.message.should.contain('not found');
        done();
      });
    });

    it('should calculate gap-free nonce skipping pending txp nonces', async function() {
      blockchainExplorer.getTransactionCount = sinon.stub().callsArgWith(1, null, '5');

      // Create and publish first txp with normal nonce (nonce=5)
      const txp1 = await helpers.createAndPublishTx(server, {
        outputs: [{ toAddress: ETH_ADDR, amount: 1000 }],
        feePerKb: 123e2,
        from: fromAddr
      }, TestData.copayers[0].privKey_1H_0);
      txp1.nonce.should.equal('5');

      // Create second deferred-nonce txp
      const txp2 = await helpers.createAndPublishTx(server, {
        outputs: [{ toAddress: ETH_ADDR, amount: 2000 }],
        feePerKb: 123e2,
        from: fromAddr,
        deferNonce: true
      }, TestData.copayers[0].privKey_1H_0);
      should.not.exist(txp2.nonce);

      // assignNonce should skip nonce 5 (taken by txp1)
      const result = await util.promisify(server.assignNonce).call(server, {
        txProposalId: txp2.id
      });
      result.nonce.should.equal(6);
    });

    it('should assign sequential nonces for multiple deferred txps', async function() {
      blockchainExplorer.getTransactionCount = sinon.stub().callsArgWith(1, null, '0');

      // Create 3 deferred-nonce txps
      const txps = [];
      for (let i = 0; i < 3; i++) {
        const txp = await helpers.createAndPublishTx(server, {
          outputs: [{ toAddress: ETH_ADDR, amount: 1000 * (i + 1) }],
          feePerKb: 123e2,
          from: fromAddr,
          deferNonce: true
        }, TestData.copayers[0].privKey_1H_0);
        txps.push(txp);
      }

      // Assign nonces sequentially (simulates bulk sign)
      const results = [];
      for (const txp of txps) {
        const result = await util.promisify(server.assignNonce).call(server, {
          txProposalId: txp.id
        });
        results.push(result);
      }

      results[0].nonce.should.equal(0);
      results[1].nonce.should.equal(1);
      results[2].nonce.should.equal(2);
    });

    it('should handle mix of normal and deferred-nonce txps', async function() {
      blockchainExplorer.getTransactionCount = sinon.stub().callsArgWith(1, null, '3');

      // Normal txp gets nonce 3
      const normalTxp = await helpers.createAndPublishTx(server, {
        outputs: [{ toAddress: ETH_ADDR, amount: 1000 }],
        feePerKb: 123e2,
        from: fromAddr
      }, TestData.copayers[0].privKey_1H_0);
      normalTxp.nonce.should.equal('3');

      // Two deferred txps
      const deferred1 = await helpers.createAndPublishTx(server, {
        outputs: [{ toAddress: ETH_ADDR, amount: 2000 }],
        feePerKb: 123e2,
        from: fromAddr,
        deferNonce: true
      }, TestData.copayers[0].privKey_1H_0);

      const deferred2 = await helpers.createAndPublishTx(server, {
        outputs: [{ toAddress: ETH_ADDR, amount: 3000 }],
        feePerKb: 123e2,
        from: fromAddr,
        deferNonce: true
      }, TestData.copayers[0].privKey_1H_0);

      // First deferred should skip nonce 3 (used by normalTxp)
      const result1 = await util.promisify(server.assignNonce).call(server, {
        txProposalId: deferred1.id
      });
      result1.nonce.should.equal(4);

      // Second deferred should skip 3 and 4
      const result2 = await util.promisify(server.assignNonce).call(server, {
        txProposalId: deferred2.id
      });
      result2.nonce.should.equal(5);
    });
  });

  describe('#signTx with deferNonce', function() {
    let server, wallet, fromAddr;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
      const address = await util.promisify(server.createAddress).call(server, {});
      fromAddr = address.address;
      await helpers.stubUtxos(server, wallet, [1, 2], { coin: 'eth' });
    });

    it('should sign a deferred-nonce txp after assignNonce', async function() {
      blockchainExplorer.getTransactionCount = sinon.stub().callsArgWith(1, null, '7');
      helpers.stubBroadcast('txid123');

      const txp = await helpers.createAndPublishTx(server, {
        outputs: [{ toAddress: ETH_ADDR, amount: 8000 }],
        feePerKb: 123e2,
        from: fromAddr,
        deferNonce: true
      }, TestData.copayers[0].privKey_1H_0);

      // Assign nonce
      const withNonce = await util.promisify(server.assignNonce).call(server, {
        txProposalId: txp.id
      });
      withNonce.nonce.should.equal(7);

      // Re-fetch to get the stored txp with nonce (as client would receive)
      const fetched = await util.promisify(server.getTx).call(server, { txProposalId: txp.id });

      // Sign
      const signatures = helpers.clientSign(fetched, TestData.copayers[0].xPrivKey_44H_0H_0H);
      const signed = await util.promisify(server.signTx).call(server, {
        txProposalId: txp.id,
        signatures
      });
      signed.status.should.equal('accepted');
    });

    it('should not trigger nonce conflict for deferred txps with null nonce', async function() {
      blockchainExplorer.getTransactionCount = sinon.stub().callsArgWith(1, null, '5');

      // Normal txp with nonce 5
      const normalTxp = await helpers.createAndPublishTx(server, {
        outputs: [{ toAddress: ETH_ADDR, amount: 1000 }],
        feePerKb: 123e2,
        from: fromAddr
      }, TestData.copayers[0].privKey_1H_0);
      normalTxp.nonce.should.equal('5');

      // Deferred txp (nonce=null). Should not conflict with normalTxp
      const deferredTxp = await helpers.createAndPublishTx(server, {
        outputs: [{ toAddress: ETH_ADDR, amount: 2000 }],
        feePerKb: 123e2,
        from: fromAddr,
        deferNonce: true
      }, TestData.copayers[0].privKey_1H_0);

      // Assign nonce. Should get 6 (skipping 5)
      const withNonce = await util.promisify(server.assignNonce).call(server, {
        txProposalId: deferredTxp.id
      });
      withNonce.nonce.should.equal(6);

      // Sign both. Neither should fail with TX_NONCE_CONFLICT
      helpers.stubBroadcast('txid_normal');
      const sigs1 = helpers.clientSign(normalTxp, TestData.copayers[0].xPrivKey_44H_0H_0H);
      const signed1 = await util.promisify(server.signTx).call(server, {
        txProposalId: normalTxp.id,
        signatures: sigs1
      });
      signed1.status.should.equal('accepted');

      // Re-fetch deferred txp for signing
      const fetchedDeferred = await util.promisify(server.getTx).call(server, { txProposalId: deferredTxp.id });
      helpers.stubBroadcast('txid_deferred');
      const sigs2 = helpers.clientSign(fetchedDeferred, TestData.copayers[0].xPrivKey_44H_0H_0H);
      const signed2 = await util.promisify(server.signTx).call(server, {
        txProposalId: deferredTxp.id,
        signatures: sigs2
      });
      signed2.status.should.equal('accepted');
    });
  });

  describe('Full flow: create → publish → assignNonce → sign → broadcast', function() {
    let server, wallet, fromAddr;

    beforeEach(async function() {
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth' }));
      const address = await util.promisify(server.createAddress).call(server, {});
      fromAddr = address.address;
      await helpers.stubUtxos(server, wallet, [1, 2], { coin: 'eth' });
    });

    it('should complete full lifecycle for a deferred-nonce txp', async function() {
      blockchainExplorer.getTransactionCount = sinon.stub().callsArgWith(1, null, '42');
      helpers.stubBroadcast('0xabc123');

      // 1. Create
      const txOpts = {
        outputs: [{ toAddress: ETH_ADDR, amount: 8000 }],
        feePerKb: 123e2,
        from: fromAddr,
        deferNonce: true
      };
      const created = await util.promisify(server.createTx).call(server, txOpts);
      created.isTemporary().should.be.true;
      created.deferNonce.should.be.true;
      should.not.exist(created.nonce);

      // 2. Publish
      const publishOpts = helpers.getProposalSignatureOpts(created, TestData.copayers[0].privKey_1H_0);
      const published = await util.promisify(server.publishTx).call(server, publishOpts);
      published.status.should.equal('pending');
      should.exist(published.prePublishRaw);

      // 3. Assign nonce
      const withNonce = await util.promisify(server.assignNonce).call(server, {
        txProposalId: created.id
      });
      withNonce.nonce.should.equal(42);

      // 4. Sign
      const fetched = await util.promisify(server.getTx).call(server, { txProposalId: created.id });
      const signatures = helpers.clientSign(fetched, TestData.copayers[0].xPrivKey_44H_0H_0H);
      const signed = await util.promisify(server.signTx).call(server, {
        txProposalId: created.id,
        signatures
      });
      signed.status.should.equal('accepted');

      // 5. Broadcast
      const broadcasted = await util.promisify(server.broadcastTx).call(server, {
        txProposalId: created.id
      });
      broadcasted.status.should.equal('broadcasted');
      should.exist(broadcasted.txid);
    });

    it('should handle bulk sign scenario (3 deferred txps signed sequentially)', async function() {
      blockchainExplorer.getTransactionCount = sinon.stub().callsArgWith(1, null, '10');

      // Create and publish 3 deferred-nonce txps
      const txps = [];
      for (let i = 0; i < 3; i++) {
        const txp = await helpers.createAndPublishTx(server, {
          outputs: [{ toAddress: ETH_ADDR, amount: 1000 * (i + 1) }],
          feePerKb: 123e2,
          from: fromAddr,
          deferNonce: true
        }, TestData.copayers[0].privKey_1H_0);
        txps.push(txp);
      }

      // Sign each sequentially: assignNonce → sign → next
      for (let i = 0; i < txps.length; i++) {
        const withNonce = await util.promisify(server.assignNonce).call(server, {
          txProposalId: txps[i].id
        });
        withNonce.nonce.should.equal(10 + i);

        const fetched = await util.promisify(server.getTx).call(server, { txProposalId: txps[i].id });
        helpers.stubBroadcast(`txid_${i}`);
        const signatures = helpers.clientSign(fetched, TestData.copayers[0].xPrivKey_44H_0H_0H);
        const signed = await util.promisify(server.signTx).call(server, {
          txProposalId: txps[i].id,
          signatures
        });
        signed.status.should.equal('accepted');
      }

      // Verify all 3 have sequential nonces
      const pending = await util.promisify(server.getPendingTxs).call(server, {});
      const nonces = pending.map(t => t.nonce).sort();
      nonces.should.deep.equal([10, 11, 12]);
    });
  });
});
