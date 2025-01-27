import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'assert';
import * as sinon from 'sinon';
import { MoralisStateProvider } from '../../../../src/modules/moralis/api/csp';
import { BaseEVMStateProvider } from '../../../../src/providers/chain-state/evm/api/csp';


describe('BASE Chain State Provider', function() {
  const network = 'sepolia';
  const sandbox = sinon.createSandbox();
  let BASE;

  before(() => {
    BASE = new MoralisStateProvider('BASE');
  });

  after(() => {
    console.log('BaseEVMStateProvider.rpcs', BaseEVMStateProvider.rpcs);
  });

  afterEach(function() {
    console.log(BaseEVMStateProvider.rpcs);
    sandbox.restore();
  });

  it('should be able to get web3', async () => {
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().resolves(1) } };
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ BASE: {[network]: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const { web3 } = await BASE.getWeb3(network);
    const block = await web3.eth.getBlockNumber();
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    assert.strictEqual(stub.callCount, 2);
    assert.strictEqual(block, 1);
  });

  it('should make a new web3 if getBlockNumber fails', async () => {
    const web3Stub = { eth: { getBlockNumber: sandbox.stub().rejects('Block number fails') } };
    sandbox.stub(BaseEVMStateProvider, 'rpcs').value({ BASE: {[network]: [{ web3: web3Stub, rpc: sinon.stub(), dataType: 'combined' }] } });
    const { web3 } = await BASE.getWeb3(network);
    const stub = web3.eth.getBlockNumber as sinon.SinonStub;
    assert.equal(stub.callCount, null, 'stub.callCount should not exist');
  });
});