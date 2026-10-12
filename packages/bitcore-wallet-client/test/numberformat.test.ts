import * as chai from 'chai';
import sinon from 'sinon';
import { API } from '../src/lib/api';
import { Utils } from '../src/lib/common/utils';
import { Verifier } from '../src/lib/verifier';

const should = chai.should();

describe('Transaction proposal number formats', function() {
  const sandbox = sinon.createSandbox();
  let client: API;
  let txp;

  beforeEach(function() {
    client = new API();
    client.credentials = {
      chain: 'eth',
      walletId: 'wallet',
      sharedEncryptingKey: 'test',
      isComplete: () => true
    } as any;
    txp = {
      id: 'proposal',
      version: 3,
      creatorId: 'creator',
      amount: 70000000000000010,
      nonce: 1,
      outputs: [{ toAddress: 'recipient', amount: '70000000000000010' }]
    };
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('should preserve create amounts without requesting a number conversion', async function() {
    const post = sandbox.stub(client.request, 'post').resolves({ body: txp });
    const check = sandbox.stub(Verifier, 'checkProposalCreation').returns(true);
    const args = { outputs: [{ ...txp.outputs[0] }] };

    const result = await client.createTxProposal(args);

    post.firstCall.args[0].should.equal('/v3/txproposals/');
    post.firstCall.args[1].outputs[0].amount.should.equal('70000000000000010');
    result.outputs[0].amount.should.equal('70000000000000010');
    check.calledOnce.should.equal(true);
  });

  it('should omit the format by default and pass an explicit one through', async function() {
    const post = sandbox.stub(client.request, 'post').resolves({ body: txp });
    const build = sandbox.stub(Utils, 'buildTx').returns({ uncheckedSerialize: () => 'unsigned-transaction' } as any);
    const sign = sandbox.stub(Utils, 'signMessage').returns('proposal-signature');

    for (const numberFormat of [undefined, 'number', 'string', 'hex'] as const) {
      const result = await client.publishTxProposal({ txp, numberFormat });

      post.lastCall.args[0].should.equal(`/v2/txproposals/proposal/publish${numberFormat ? `?numberFormat=${numberFormat}` : ''}`);
      post.lastCall.args[1].should.deep.equal({ proposalSignature: 'proposal-signature' });
      result.outputs[0].amount.should.equal('70000000000000010');
      build.lastCall.args[0].should.equal(txp);
      sign.lastCall.args[0].should.equal('unsigned-transaction');
    }
  });

  it('should verify proposals requested without a format or with an explicit one', async function() {
    const get = sandbox.stub(client.request, 'get').resolves({ body: [txp] });
    sandbox.stub(client, 'getPayProV2').resolves(null);
    const check = sandbox.stub(Verifier, 'checkTxProposal').returns(true);

    for (const numberFormat of [undefined, 'number', 'string', 'hex'] as const) {
      const result = await client.getTxProposals({ numberFormat });

      get.lastCall.args[0].should.equal(`/v2/txproposals${numberFormat ? `?numberFormat=${numberFormat}` : ''}`);
      result[0].outputs[0].amount.should.equal('70000000000000010');
      check.lastCall.args[1].should.equal(txp);
    }
  });

  it('should keep pending proposal amounts through getStatus and pushSignatures', async function() {
    const status = { wallet: { status: 'complete' }, pendingTxps: [txp] };
    const get = sandbox.stub(client.request, 'get').resolves({ body: status });
    const post = sandbox.stub(client.request, 'post').resolves({ body: txp });
    sandbox.stub(client, 'getPayProV2').resolves(null);
    const check = sandbox.stub(Verifier, 'checkTxProposal').returns(true);

    const result = await client.getStatus({});
    const pending = result.pendingTxps[0];
    should.exist(pending);
    await client.pushSignatures(pending, ['signature']);

    get.firstCall.args[0].should.equal('/v3/wallets/?includeExtendedInfo=0&twoStep=0&serverMessageArray=1');
    pending.outputs[0].amount.should.equal('70000000000000010');
    post.firstCall.args[0].should.equal('/v2/txproposals/proposal/signatures');
    post.firstCall.args[1].should.deep.equal({ signatures: ['signature'], nonce: 1 });
    check.calledOnce.should.equal(true);
  });

  it('should request pending proposals in bulk status without a format', async function() {
    const status = { wallet: { status: 'complete' }, pendingTxps: [txp] };
    const get = sandbox.stub(client.bulkClient, 'get').resolves({
      body: [{ walletId: 'wallet', success: true, status }]
    });

    const result = await client.bulkClient.getStatusAll([client.credentials], {});

    get.firstCall.args[0].should.equal('/v1/wallets/all/?includeExtendedInfo=0&twoStep=0&serverMessageArray=1&silentFailure=0');
    result[0].status.pendingTxps[0].outputs[0].amount.should.equal('70000000000000010');
  });

  it('should omit the format for prepare and signing regardless of the displayed total type', async function() {
    const post = sandbox.stub(client.request, 'post').resolves({ body: txp });
    sandbox.stub(client, 'getPayProV2').resolves(null);
    sandbox.stub(Verifier, 'checkTxProposal').returns(true);

    for (const amount of [70000000000000010, '70000000000000010', '0xf8b0a10e47000a', 0]) {
      txp.amount = amount;
      const prepared = await client.prepareTx({ txp });
      post.lastCall.args[0].should.equal('/v1/txproposals/proposal/prepare');
      prepared.outputs[0].amount.should.equal('70000000000000010');

      await client.pushSignatures(prepared, ['signature']);
      post.lastCall.args[0].should.equal('/v2/txproposals/proposal/signatures');
    }
  });
});
